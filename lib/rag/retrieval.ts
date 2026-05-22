import 'server-only'

import {
  neonFileChunksRepository,
  neonFilesRepository,
} from '@/lib/db/repositories'
import { FileKnowledgeContext } from '@/types'
import { createEmbeddings, hasEmbeddingConfig } from './embeddings'

const DEFAULT_RETRIEVAL_LIMIT = 5
const MAX_RETRIEVAL_LIMIT = 8

function normalizeQuery(query: string): string {
  return query.replace(/\s+/g, ' ').trim().slice(0, 1_000)
}

function uniqueFileIds(fileIds: Array<string | undefined>): string[] {
  return [...new Set(fileIds.filter(Boolean) as string[])]
}

export async function linkAttachmentKnowledgeScope(input: {
  userId: string
  attachments?: Array<{ fileId?: string }>
  projectId?: string | null
  conversationId?: string | null
  messageId?: string | null
}): Promise<string[]> {
  const fileIds = uniqueFileIds((input.attachments ?? []).map((item) => item.fileId))
  if (fileIds.length === 0) return []

  await Promise.all([
    neonFilesRepository.updateScopeForFiles(input.userId, fileIds, {
      projectId: input.projectId,
      conversationId: input.conversationId,
      messageId: input.messageId,
    }),
    neonFileChunksRepository.updateScopeForFiles(input.userId, fileIds, {
      projectId: input.projectId,
      conversationId: input.conversationId,
      messageId: input.messageId,
    }),
  ])

  return fileIds
}

export async function retrieveFileKnowledgeContext(input: {
  userId: string
  query: string
  projectId?: string | null
  conversationId?: string | null
  fileIds?: string[]
  limit?: number
}): Promise<FileKnowledgeContext | undefined> {
  const query = normalizeQuery(input.query)
  if (!query || !hasEmbeddingConfig()) return undefined

  const hasScope =
    Boolean(input.projectId) ||
    Boolean(input.conversationId) ||
    Boolean(input.fileIds?.length)

  if (!hasScope) return undefined

  const [embedding] = await createEmbeddings([query])
  if (!embedding) return undefined

  const chunks = await neonFileChunksRepository.search({
    userId: input.userId,
    embedding,
    projectId: input.projectId,
    conversationId: input.conversationId,
    fileIds: input.fileIds,
    limit: Math.min(MAX_RETRIEVAL_LIMIT, input.limit ?? DEFAULT_RETRIEVAL_LIMIT),
  })

  if (chunks.length === 0) return undefined

  return {
    query,
    retrievedAt: new Date().toISOString(),
    sources: chunks.map((chunk, index) => ({
      ...chunk.source,
      id: `F${index + 1}`,
    })),
  }
}
