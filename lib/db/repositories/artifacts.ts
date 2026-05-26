import 'server-only'

import { SQL, and, desc, eq, ilike, or, sql } from 'drizzle-orm'
import {
  Artifact,
  ArtifactInput,
  ArtifactListFilters,
  ArtifactPatch,
  ArtifactSourceType,
  ArtifactType,
} from '@/types'
import { getDatabaseClient } from '../client'
import {
  zenArtifacts,
  zenConversations,
  zenMessages,
  zenProjects,
} from '../schema'
import { compactObject, toIsoString, toJsonObject } from './helpers'
import { neonUsersRepository } from './users'

const ARTIFACT_LIST_LIMIT = 100
const MAX_QUERY_LENGTH = 120

type ArtifactRow = typeof zenArtifacts.$inferSelect

export class ArtifactReferenceNotFoundError extends Error {
  constructor(message = 'Artifact reference not found.') {
    super(message)
    this.name = 'ArtifactReferenceNotFoundError'
  }
}

function normalizeQuery(query: string | null | undefined): string {
  return (query ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_LENGTH)
}

function toPattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, (match) => `\\${match}`)}%`
}

function normalizeNullableId(value: string | null | undefined): string | null {
  return value?.trim() || null
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function rowToArtifact(row: ArtifactRow): Artifact {
  return {
    id: row.id,
    userId: row.userId,
    projectId: row.projectId,
    conversationId: row.conversationId,
    sourceMessageId: row.sourceMessageId,
    sourceType: row.sourceType as ArtifactSourceType,
    title: row.title,
    artifactType: row.artifactType as ArtifactType,
    content: row.content,
    metadata: toJsonObject<Record<string, unknown>>(row.metadata, {}),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  }
}

class NeonArtifactsRepository {
  async list(
    userId: string,
    filters: ArtifactListFilters = {}
  ): Promise<Artifact[]> {
    const conditions: SQL[] = [eq(zenArtifacts.userId, userId)]
    const projectId = normalizeNullableId(filters.projectId)
    const query = normalizeQuery(filters.q)

    if (projectId) {
      conditions.push(eq(zenArtifacts.projectId, projectId))
    }

    if (filters.artifactType) {
      conditions.push(eq(zenArtifacts.artifactType, filters.artifactType))
    }

    if (filters.sourceType) {
      conditions.push(eq(zenArtifacts.sourceType, filters.sourceType))
    }

    if (query) {
      const pattern = toPattern(query)
      conditions.push(
        or(
          ilike(zenArtifacts.title, pattern),
          ilike(zenArtifacts.content, pattern),
          ilike(zenArtifacts.artifactType, pattern),
          ilike(zenArtifacts.sourceType, pattern),
          sql`${zenArtifacts.metadata}::text ILIKE ${pattern}`
        ) as SQL
      )
    }

    const rows = await getDatabaseClient()
      .select()
      .from(zenArtifacts)
      .where(and(...conditions))
      .orderBy(desc(zenArtifacts.updatedAt))
      .limit(ARTIFACT_LIST_LIMIT)

    return rows.map(rowToArtifact)
  }

  async get(userId: string, artifactId: string): Promise<Artifact | null> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenArtifacts)
      .where(and(eq(zenArtifacts.userId, userId), eq(zenArtifacts.id, artifactId)))
      .limit(1)

    return rows[0] ? rowToArtifact(rows[0]) : null
  }

  async create(userId: string, input: ArtifactInput): Promise<Artifact> {
    await neonUsersRepository.ensureUserReference(userId)

    const references = await this.resolveReferences(userId, {
      projectId: input.projectId,
      conversationId: input.conversationId,
      sourceMessageId: input.sourceMessageId,
    })
    const rows = await getDatabaseClient()
      .insert(zenArtifacts)
      .values({
        userId,
        projectId: references.projectId,
        conversationId: references.conversationId,
        sourceMessageId: references.sourceMessageId,
        sourceType: input.sourceType,
        title: input.title,
        artifactType: input.artifactType,
        content: input.content,
        metadata: normalizeMetadata(input.metadata),
      })
      .returning()

    if (!rows[0]) {
      throw new Error('Unable to create artifact.')
    }

    return rowToArtifact(rows[0])
  }

  async update(
    userId: string,
    artifactId: string,
    patch: ArtifactPatch
  ): Promise<Artifact | null> {
    const values: Partial<typeof zenArtifacts.$inferInsert> = {
      ...compactObject({
        title: patch.title,
        artifactType: patch.artifactType,
        content: patch.content,
      }),
      updatedAt: new Date(),
    }

    if (typeof patch.projectId !== 'undefined') {
      const projectId = normalizeNullableId(patch.projectId)
      if (projectId) {
        await this.assertProjectOwned(userId, projectId)
      }
      values.projectId = projectId
    }

    if (typeof patch.metadata !== 'undefined') {
      values.metadata = normalizeMetadata(patch.metadata)
    }

    const rows = await getDatabaseClient()
      .update(zenArtifacts)
      .set(values)
      .where(and(eq(zenArtifacts.userId, userId), eq(zenArtifacts.id, artifactId)))
      .returning()

    return rows[0] ? rowToArtifact(rows[0]) : null
  }

  async delete(userId: string, artifactId: string): Promise<boolean> {
    const rows = await getDatabaseClient()
      .delete(zenArtifacts)
      .where(and(eq(zenArtifacts.userId, userId), eq(zenArtifacts.id, artifactId)))
      .returning({ id: zenArtifacts.id })

    return rows.length > 0
  }

  private async resolveReferences(
    userId: string,
    input: {
      projectId?: string | null
      conversationId?: string | null
      sourceMessageId?: string | null
    }
  ): Promise<{
    projectId: string | null
    conversationId: string | null
    sourceMessageId: string | null
  }> {
    let projectId = normalizeNullableId(input.projectId)
    let conversationId = normalizeNullableId(input.conversationId)
    const sourceMessageId = normalizeNullableId(input.sourceMessageId)

    if (projectId) {
      await this.assertProjectOwned(userId, projectId)
    }

    if (conversationId) {
      const conversation = await this.getConversationScope(userId, conversationId)
      if (!conversation) {
        throw new ArtifactReferenceNotFoundError('Conversation not found.')
      }
      if (!projectId) {
        projectId = conversation.projectId
      }
    }

    if (sourceMessageId) {
      const source = await this.getSourceMessageScope(userId, sourceMessageId)
      if (!source) {
        throw new ArtifactReferenceNotFoundError('Source message not found.')
      }
      if (conversationId && conversationId !== source.conversationId) {
        throw new ArtifactReferenceNotFoundError('Source message not found.')
      }
      conversationId = source.conversationId
      if (!projectId) {
        projectId = source.projectId
      }
    }

    return {
      projectId,
      conversationId,
      sourceMessageId,
    }
  }

  private async assertProjectOwned(userId: string, projectId: string) {
    const rows = await getDatabaseClient()
      .select({ id: zenProjects.id })
      .from(zenProjects)
      .where(and(eq(zenProjects.userId, userId), eq(zenProjects.id, projectId)))
      .limit(1)

    if (!rows[0]) {
      throw new ArtifactReferenceNotFoundError('Project not found.')
    }
  }

  private async getConversationScope(userId: string, conversationId: string) {
    const rows = await getDatabaseClient()
      .select({
        id: zenConversations.id,
        projectId: zenConversations.projectId,
      })
      .from(zenConversations)
      .where(
        and(
          eq(zenConversations.userId, userId),
          eq(zenConversations.id, conversationId)
        )
      )
      .limit(1)

    return rows[0] ?? null
  }

  private async getSourceMessageScope(userId: string, sourceMessageId: string) {
    const rows = await getDatabaseClient()
      .select({
        id: zenMessages.id,
        conversationId: zenMessages.conversationId,
        projectId: zenConversations.projectId,
      })
      .from(zenMessages)
      .innerJoin(
        zenConversations,
        eq(zenMessages.conversationId, zenConversations.id)
      )
      .where(
        and(
          eq(zenConversations.userId, userId),
          eq(zenMessages.id, sourceMessageId)
        )
      )
      .limit(1)

    return rows[0] ?? null
  }
}

export const neonArtifactsRepository = new NeonArtifactsRepository()
