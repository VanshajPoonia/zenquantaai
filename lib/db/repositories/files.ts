import 'server-only'

import { and, desc, eq, inArray } from 'drizzle-orm'
import { getDatabaseClient } from '../client'
import { zenFiles } from '../schema'
import { compactObject, toIsoString } from './helpers'
import { neonUsersRepository } from './users'

type FileRow = typeof zenFiles.$inferSelect
type FileInsert = typeof zenFiles.$inferInsert

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

class NeonFilesRepository {
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
