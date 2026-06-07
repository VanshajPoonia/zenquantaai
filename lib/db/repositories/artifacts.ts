import 'server-only'

import { SQL, and, desc, eq, ilike, lt, or, sql } from 'drizzle-orm'
import {
  Artifact,
  ArtifactInput,
  ArtifactListFilters,
  ArtifactPatch,
  ArtifactSourceType,
  ArtifactType,
  ArtifactVersion,
} from '@/types'
import {
  RESTORE_ARTIFACT_VERSION_ACTION,
  getArtifactVersionAction,
} from '@/lib/artifacts/versions'
import { getDatabaseClient } from '../client'
import {
  zenArtifactVersions,
  zenArtifacts,
  zenConversations,
  zenMessages,
  zenProjects,
} from '../schema'
import { compactObject, toIsoString, toJsonObject } from './helpers'
import { neonUsersRepository } from './users'

const ARTIFACT_LIST_LIMIT = 100
const MAX_QUERY_LENGTH = 120

function normalizeLimit(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return ARTIFACT_LIST_LIMIT
  }
  return Math.max(1, Math.min(ARTIFACT_LIST_LIMIT, Math.floor(value)))
}

type ArtifactRow = typeof zenArtifacts.$inferSelect
type ArtifactVersionRow = typeof zenArtifactVersions.$inferSelect

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

function rowToArtifactVersion(row: ArtifactVersionRow): ArtifactVersion {
  return {
    id: row.id,
    artifactId: row.artifactId,
    userId: row.userId,
    title: row.title,
    artifactType: row.artifactType as ArtifactType,
    content: row.content,
    metadata: toJsonObject<Record<string, unknown>>(row.metadata, {}),
    createdAt: toIsoString(row.createdAt),
    createdByAction: row.createdByAction,
  }
}

function buildVersionValues(
  artifact: ArtifactRow,
  createdByAction: string | null
): typeof zenArtifactVersions.$inferInsert {
  return {
    artifactId: artifact.id,
    userId: artifact.userId,
    title: artifact.title,
    artifactType: artifact.artifactType,
    content: artifact.content,
    metadata: normalizeMetadata(artifact.metadata),
    createdByAction,
  }
}

function getDuplicateTitle(title: string): string {
  const normalized = title.trim() || 'Untitled artifact'
  return `Copy of ${normalized}`
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

    if (filters.beforeUpdatedAt) {
      const before = new Date(filters.beforeUpdatedAt)
      if (!Number.isNaN(before.getTime())) {
        conditions.push(lt(zenArtifacts.updatedAt, before))
      }
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
      .limit(normalizeLimit(filters.limit))

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
    const db = getDatabaseClient()
    const rows = await db.transaction(async (tx) => {
      const artifactRows = await tx
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

      if (artifactRows[0]) {
        await tx
          .insert(zenArtifactVersions)
          .values(buildVersionValues(artifactRows[0], null))
      }

      return artifactRows
    })

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

    const db = getDatabaseClient()
    const rows = await db.transaction(async (tx) => {
      const artifactRows = await tx
        .update(zenArtifacts)
        .set(values)
        .where(and(eq(zenArtifacts.userId, userId), eq(zenArtifacts.id, artifactId)))
        .returning()

      if (artifactRows[0]) {
        await tx
          .insert(zenArtifactVersions)
          .values(
            buildVersionValues(
              artifactRows[0],
              getArtifactVersionAction(
                toJsonObject<Record<string, unknown>>(artifactRows[0].metadata, {})
              )
            )
          )
      }

      return artifactRows
    })

    return rows[0] ? rowToArtifact(rows[0]) : null
  }

  async listVersions(
    userId: string,
    artifactId: string
  ): Promise<ArtifactVersion[] | null> {
    const artifact = await this.get(userId, artifactId)
    if (!artifact) return null

    const rows = await getDatabaseClient()
      .select()
      .from(zenArtifactVersions)
      .where(
        and(
          eq(zenArtifactVersions.userId, userId),
          eq(zenArtifactVersions.artifactId, artifactId)
        )
      )
      .orderBy(desc(zenArtifactVersions.createdAt))

    return rows.map(rowToArtifactVersion)
  }

  async restoreVersion(
    userId: string,
    artifactId: string,
    versionId: string
  ): Promise<{ artifact: Artifact; version: ArtifactVersion } | null> {
    const db = getDatabaseClient()
    const result = await db.transaction(async (tx) => {
      const versionRows = await tx
        .select()
        .from(zenArtifactVersions)
        .where(
          and(
            eq(zenArtifactVersions.userId, userId),
            eq(zenArtifactVersions.artifactId, artifactId),
            eq(zenArtifactVersions.id, versionId)
          )
        )
        .limit(1)
      const version = versionRows[0]

      if (!version) return null

      const artifactRows = await tx
        .update(zenArtifacts)
        .set({
          title: version.title,
          artifactType: version.artifactType,
          content: version.content,
          metadata: normalizeMetadata(version.metadata),
          updatedAt: new Date(),
        })
        .where(and(eq(zenArtifacts.userId, userId), eq(zenArtifacts.id, artifactId)))
        .returning()
      const artifact = artifactRows[0]

      if (!artifact) return null

      const restoredVersionRows = await tx
        .insert(zenArtifactVersions)
        .values(buildVersionValues(artifact, RESTORE_ARTIFACT_VERSION_ACTION))
        .returning()

      return {
        artifact,
        version: restoredVersionRows[0],
      }
    })

    if (!result?.artifact || !result.version) return null

    return {
      artifact: rowToArtifact(result.artifact),
      version: rowToArtifactVersion(result.version),
    }
  }

  async duplicateVersion(
    userId: string,
    artifactId: string,
    versionId: string
  ): Promise<Artifact | null> {
    const db = getDatabaseClient()
    const result = await db.transaction(async (tx) => {
      const versionRows = await tx
        .select()
        .from(zenArtifactVersions)
        .where(
          and(
            eq(zenArtifactVersions.userId, userId),
            eq(zenArtifactVersions.artifactId, artifactId),
            eq(zenArtifactVersions.id, versionId)
          )
        )
        .limit(1)
      const version = versionRows[0]

      if (!version) return null

      const sourceArtifactRows = await tx
        .select()
        .from(zenArtifacts)
        .where(and(eq(zenArtifacts.userId, userId), eq(zenArtifacts.id, artifactId)))
        .limit(1)
      const sourceArtifact = sourceArtifactRows[0]

      if (!sourceArtifact) return null

      const artifactRows = await tx
        .insert(zenArtifacts)
        .values({
          userId,
          projectId: sourceArtifact.projectId,
          conversationId: sourceArtifact.conversationId,
          sourceMessageId: sourceArtifact.sourceMessageId,
          sourceType: sourceArtifact.sourceType,
          title: getDuplicateTitle(version.title),
          artifactType: version.artifactType,
          content: version.content,
          metadata: normalizeMetadata(version.metadata),
        })
        .returning()
      const artifact = artifactRows[0]

      if (!artifact) return null

      await tx
        .insert(zenArtifactVersions)
        .values(buildVersionValues(artifact, version.createdByAction))

      return artifact
    })

    return result ? rowToArtifact(result) : null
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
