import 'server-only'

import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { normalizeFileKnowledge } from '@/lib/files/intelligence'
import { createPrivateFileUrl } from '@/lib/storage/object-store'
import { FileIntelligence } from '@/types'
import { getDatabaseClient } from '../client'
import { zenFileChunks, zenFiles } from '../schema'
import { compactObject, toIsoString } from './helpers'
import { neonUsersRepository } from './users'

type FileRow = typeof zenFiles.$inferSelect
type FileInsert = typeof zenFiles.$inferInsert
type FileIntelligenceFilters = {
  ids?: string[]
  projectId?: string | null
  conversationId?: string | null
  embeddingsAvailable: boolean
}

export type NeonFileProvider = 'external' | 'local'
export type NeonFileVisibility = 'private' | 'public'

export interface NeonFileMetadata {
  id: string
  userId: string
  conversationId: string | null
  projectId: string | null
  messageId: string | null
  provider: NeonFileProvider
  bucket: string | null
  storagePath: string | null
  publicUrl: string | null
  fileName: string
  mimeType: string | null
  byteSize: number | null
  checksum: string | null
  visibility: NeonFileVisibility
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

type CreateFileMetadataInput = Omit<
  NeonFileMetadata,
  'id' | 'createdAt' | 'updatedAt'
> & {
  id?: string
}

type PatchFileMetadataInput = Partial<
  Omit<NeonFileMetadata, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
>

function rowToFile(row: FileRow): NeonFileMetadata {
  return {
    id: row.id,
    userId: row.userId,
    conversationId: row.conversationId,
    projectId: row.projectId,
    messageId: row.messageId,
    provider: row.provider as NeonFileProvider,
    bucket: row.bucket,
    storagePath: row.storagePath,
    publicUrl: row.publicUrl,
    fileName: row.fileName,
    mimeType: row.mimeType,
    byteSize: row.byteSize,
    checksum: row.checksum,
    visibility: row.visibility as NeonFileVisibility,
    metadata:
      row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  }
}

function protectedObjectUrl(
  bucket: string | null,
  storagePath: string | null,
  download = false
): string | null {
  if (!bucket || !storagePath) return null
  return createPrivateFileUrl({ bucket, storagePath, download })
}

function fileToIntelligence(
  file: NeonFileMetadata,
  chunkCount: number,
  embeddingsAvailable: boolean
): FileIntelligence {
  const knowledge = normalizeFileKnowledge(file.metadata)

  return {
    id: file.id,
    fileName: file.fileName,
    mimeType: file.mimeType,
    byteSize: file.byteSize,
    projectId: file.projectId,
    conversationId: file.conversationId,
    messageId: file.messageId,
    visibility: file.visibility,
    viewUrl: protectedObjectUrl(file.bucket, file.storagePath),
    downloadUrl: protectedObjectUrl(file.bucket, file.storagePath, true),
    ...knowledge,
    chunkCount: knowledge.chunkCount || chunkCount,
    embeddingsAvailable,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
    metadata: {
      private: file.visibility === 'private',
      provider: file.provider,
    },
  }
}

class NeonFilesRepository {
  private async chunkCountsByFileId(fileIds: string[]): Promise<Map<string, number>> {
    if (fileIds.length === 0) return new Map()

    const rows = await getDatabaseClient()
      .select({
        fileId: zenFileChunks.fileId,
        chunkCount: sql<number>`count(*)::int`,
      })
      .from(zenFileChunks)
      .where(inArray(zenFileChunks.fileId, fileIds))
      .groupBy(zenFileChunks.fileId)

    return new Map(rows.map((row) => [row.fileId, Number(row.chunkCount) || 0]))
  }

  async listIntelligence(
    userId: string,
    filters: FileIntelligenceFilters
  ): Promise<FileIntelligence[]> {
    const conditions = [eq(zenFiles.userId, userId)]

    if (filters.ids?.length) {
      conditions.push(inArray(zenFiles.id, filters.ids))
    }
    if (filters.projectId) {
      conditions.push(eq(zenFiles.projectId, filters.projectId))
    }
    if (filters.conversationId) {
      conditions.push(eq(zenFiles.conversationId, filters.conversationId))
    }

    const rows = await getDatabaseClient()
      .select()
      .from(zenFiles)
      .where(and(...conditions))
      .orderBy(desc(zenFiles.createdAt))

    const files = rows.map(rowToFile)
    const chunkCounts = await this.chunkCountsByFileId(files.map((file) => file.id))

    return files.map((file) =>
      fileToIntelligence(
        file,
        chunkCounts.get(file.id) ?? 0,
        filters.embeddingsAvailable
      )
    )
  }

  async getIntelligence(
    userId: string,
    id: string,
    embeddingsAvailable: boolean
  ): Promise<FileIntelligence | null> {
    const file = await this.get(userId, id)
    if (!file) return null

    const chunkCounts = await this.chunkCountsByFileId([file.id])
    return fileToIntelligence(
      file,
      chunkCounts.get(file.id) ?? 0,
      embeddingsAvailable
    )
  }

  async listByUser(userId: string): Promise<NeonFileMetadata[]> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenFiles)
      .where(eq(zenFiles.userId, userId))
      .orderBy(desc(zenFiles.createdAt))

    return rows.map(rowToFile)
  }

  async listByConversation(
    userId: string,
    conversationId: string
  ): Promise<NeonFileMetadata[]> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenFiles)
      .where(
        and(
          eq(zenFiles.userId, userId),
          eq(zenFiles.conversationId, conversationId)
        )
      )
      .orderBy(desc(zenFiles.createdAt))

    return rows.map(rowToFile)
  }

  async get(userId: string, id: string): Promise<NeonFileMetadata | null> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenFiles)
      .where(and(eq(zenFiles.userId, userId), eq(zenFiles.id, id)))
      .limit(1)

    return rows[0] ? rowToFile(rows[0]) : null
  }

  async getByObjectRef(input: {
    userId: string
    bucket: string
    storagePath: string
  }): Promise<NeonFileMetadata | null> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenFiles)
      .where(
        and(
          eq(zenFiles.userId, input.userId),
          eq(zenFiles.bucket, input.bucket),
          eq(zenFiles.storagePath, input.storagePath)
        )
      )
      .limit(1)

    return rows[0] ? rowToFile(rows[0]) : null
  }

  async create(input: CreateFileMetadataInput): Promise<NeonFileMetadata> {
    await neonUsersRepository.ensureUserReference(input.userId)

    const values = compactObject<FileInsert>({
      id: input.id,
      userId: input.userId,
      conversationId: input.conversationId,
      projectId: input.projectId,
      messageId: input.messageId,
      provider: input.provider,
      bucket: input.bucket,
      storagePath: input.storagePath,
      publicUrl: input.publicUrl,
      fileName: input.fileName,
      mimeType: input.mimeType,
      byteSize: input.byteSize,
      checksum: input.checksum,
      visibility: input.visibility,
      metadata: input.metadata,
    }) as FileInsert

    const rows = await getDatabaseClient()
      .insert(zenFiles)
      .values(values)
      .returning()

    return rowToFile(rows[0])
  }

  async patch(
    userId: string,
    id: string,
    patch: PatchFileMetadataInput
  ): Promise<NeonFileMetadata | null> {
    const values = compactObject<Partial<FileInsert>>({
      conversationId: patch.conversationId,
      projectId: patch.projectId,
      messageId: patch.messageId,
      provider: patch.provider,
      bucket: patch.bucket,
      storagePath: patch.storagePath,
      publicUrl: patch.publicUrl,
      fileName: patch.fileName,
      mimeType: patch.mimeType,
      byteSize: patch.byteSize,
      checksum: patch.checksum,
      visibility: patch.visibility,
      metadata: patch.metadata,
      updatedAt: new Date(),
    })

    const rows = await getDatabaseClient()
      .update(zenFiles)
      .set(values)
      .where(and(eq(zenFiles.userId, userId), eq(zenFiles.id, id)))
      .returning()

    return rows[0] ? rowToFile(rows[0]) : null
  }

  async updateScopeForFiles(
    userId: string,
    fileIds: string[],
    scope: {
      projectId?: string | null
      conversationId?: string | null
      messageId?: string | null
    }
  ): Promise<void> {
    if (fileIds.length === 0) return

    await getDatabaseClient()
      .update(zenFiles)
      .set({
        projectId: scope.projectId ?? null,
        conversationId: scope.conversationId ?? null,
        messageId: scope.messageId ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(zenFiles.userId, userId), inArray(zenFiles.id, fileIds)))
  }

  async delete(userId: string, id: string): Promise<void> {
    await getDatabaseClient()
      .delete(zenFiles)
      .where(and(eq(zenFiles.userId, userId), eq(zenFiles.id, id)))
  }
}

export const neonFilesRepository = new NeonFilesRepository()
