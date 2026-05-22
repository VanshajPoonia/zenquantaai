import 'server-only'

import { and, asc, eq, inArray, or, sql, type SQL } from 'drizzle-orm'
import { createPrivateFileUrl } from '@/lib/storage/object-store'
import { FileKnowledgeSource } from '@/types'
import { getDatabaseClient } from '../client'
import { zenFileChunks, zenFiles } from '../schema'
import { compactObject, toIsoString } from './helpers'
import { neonUsersRepository } from './users'

type FileChunkInsert = typeof zenFileChunks.$inferInsert
type RetrievedFileChunkRow = {
  id: string
  userId: string
  projectId: string | null
  conversationId: string | null
  messageId: string | null
  fileId: string
  chunkIndex: number
  content: string
  createdAt: Date
  fileName: string
  bucket: string | null
  storagePath: string | null
  score: number
}

export interface FileKnowledgeChunkInput {
  userId: string
  projectId?: string | null
  conversationId?: string | null
  messageId?: string | null
  fileId: string
  chunkIndex: number
  content: string
  contentHash: string
  tokenCountEstimate: number
  embeddingModel: string
  embedding: number[]
  metadata?: Record<string, unknown>
}

export interface RetrievedFileKnowledgeChunk {
  id: string
  userId: string
  projectId: string | null
  conversationId: string | null
  messageId: string | null
  fileId: string
  fileName: string
  content: string
  chunkIndex: number
  score: number
  source: FileKnowledgeSource
  createdAt: string
}

function rowToRetrievedChunk(row: RetrievedFileChunkRow): RetrievedFileKnowledgeChunk {
  const url =
    row.bucket && row.storagePath
      ? createPrivateFileUrl({ bucket: row.bucket, storagePath: row.storagePath })
      : '#'

  return {
    id: row.id,
    userId: row.userId,
    projectId: row.projectId,
    conversationId: row.conversationId,
    messageId: row.messageId,
    fileId: row.fileId,
    fileName: row.fileName,
    content: row.content,
    chunkIndex: row.chunkIndex,
    score: row.score,
    createdAt: toIsoString(row.createdAt),
    source: {
      id: `F${row.chunkIndex + 1}`,
      kind: 'file',
      title: row.fileName,
      url,
      domain: 'Uploaded file',
      snippet: row.content.slice(0, 700),
      score: row.score,
      fileId: row.fileId,
      chunkId: row.id,
      chunkIndex: row.chunkIndex,
    },
  }
}

function vectorLiteral(embedding: number[]): string {
  return `[${embedding.map((value) => Number(value).toFixed(8)).join(',')}]`
}

class NeonFileChunksRepository {
  async replaceForFile(
    userId: string,
    fileId: string,
    chunks: FileKnowledgeChunkInput[]
  ): Promise<void> {
    await neonUsersRepository.ensureUserReference(userId)

    const db = getDatabaseClient()
    await db
      .delete(zenFileChunks)
      .where(and(eq(zenFileChunks.userId, userId), eq(zenFileChunks.fileId, fileId)))

    if (chunks.length === 0) return

    await db.insert(zenFileChunks).values(
      chunks.map((chunk) =>
        compactObject<FileChunkInsert>({
          userId: chunk.userId,
          projectId: chunk.projectId ?? null,
          conversationId: chunk.conversationId ?? null,
          messageId: chunk.messageId ?? null,
          fileId: chunk.fileId,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          contentHash: chunk.contentHash,
          tokenCountEstimate: chunk.tokenCountEstimate,
          embeddingModel: chunk.embeddingModel,
          embedding: chunk.embedding,
          metadata: chunk.metadata ?? {},
        }) as FileChunkInsert
      )
    )
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
      .update(zenFileChunks)
      .set({
        projectId: scope.projectId ?? null,
        conversationId: scope.conversationId ?? null,
        messageId: scope.messageId ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(zenFileChunks.userId, userId),
          inArray(zenFileChunks.fileId, fileIds)
        )
      )
  }

  async listByFile(
    userId: string,
    fileId: string
  ): Promise<Array<typeof zenFileChunks.$inferSelect>> {
    return await getDatabaseClient()
      .select()
      .from(zenFileChunks)
      .where(and(eq(zenFileChunks.userId, userId), eq(zenFileChunks.fileId, fileId)))
      .orderBy(asc(zenFileChunks.chunkIndex))
  }

  async search(input: {
    userId: string
    embedding: number[]
    projectId?: string | null
    conversationId?: string | null
    fileIds?: string[]
    limit?: number
  }): Promise<RetrievedFileKnowledgeChunk[]> {
    const scopedConditions: SQL[] = []

    if (input.fileIds?.length) {
      scopedConditions.push(inArray(zenFileChunks.fileId, input.fileIds))
    }

    if (input.conversationId) {
      scopedConditions.push(eq(zenFileChunks.conversationId, input.conversationId))
    }

    if (input.projectId) {
      scopedConditions.push(eq(zenFileChunks.projectId, input.projectId))
    }

    if (scopedConditions.length === 0) return []

    const distance = sql<number>`${zenFileChunks.embedding} <=> ${vectorLiteral(
      input.embedding
    )}::vector`
    const rows = await getDatabaseClient()
      .select({
        id: zenFileChunks.id,
        userId: zenFileChunks.userId,
        projectId: zenFileChunks.projectId,
        conversationId: zenFileChunks.conversationId,
        messageId: zenFileChunks.messageId,
        fileId: zenFileChunks.fileId,
        chunkIndex: zenFileChunks.chunkIndex,
        content: zenFileChunks.content,
        createdAt: zenFileChunks.createdAt,
        fileName: zenFiles.fileName,
        bucket: zenFiles.bucket,
        storagePath: zenFiles.storagePath,
        score: sql<number>`1 - (${distance})`,
      })
      .from(zenFileChunks)
      .innerJoin(zenFiles, eq(zenFileChunks.fileId, zenFiles.id))
      .where(
        and(
          eq(zenFileChunks.userId, input.userId),
          or(...scopedConditions)
        )
      )
      .orderBy(distance)
      .limit(input.limit ?? 5)

    return rows.map(rowToRetrievedChunk)
  }
}

export const neonFileChunksRepository = new NeonFileChunksRepository()
