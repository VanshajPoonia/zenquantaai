import 'server-only'

import {
  neonFileChunksRepository,
  neonFilesRepository,
  type NeonFileMetadata,
} from '@/lib/db/repositories'
import {
  chunkExtractedText,
  extractTextFromFileBytes,
} from './extraction'
import {
  createEmbeddings,
  getEmbeddingModel,
  hasEmbeddingConfig,
} from './embeddings'

type KnowledgeStatus =
  | 'indexed'
  | 'unsupported'
  | 'empty'
  | 'skipped_not_configured'
  | 'failed'

function withKnowledgeMetadata(
  file: NeonFileMetadata,
  status: KnowledgeStatus,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    ...file.metadata,
    knowledgeBase: {
      status,
      updatedAt: new Date().toISOString(),
      ...extra,
    },
  }
}

export async function indexUploadedFileForKnowledge(input: {
  userId: string
  file: NeonFileMetadata
  fileName: string
  mimeType: string
  bytes: Buffer
  projectId?: string | null
  conversationId?: string | null
  messageId?: string | null
}): Promise<void> {
  try {
    if (!hasEmbeddingConfig()) {
      await neonFilesRepository.patch(input.userId, input.file.id, {
        metadata: withKnowledgeMetadata(input.file, 'skipped_not_configured', {
          reason: 'Embedding provider is not configured.',
        }),
      })
      return
    }

    const extracted = await extractTextFromFileBytes({
      bytes: input.bytes,
      fileName: input.fileName,
      mimeType: input.mimeType,
    })

    if (extracted.status !== 'extracted') {
      await neonFileChunksRepository.replaceForFile(
        input.userId,
        input.file.id,
        []
      )
      await neonFilesRepository.patch(input.userId, input.file.id, {
        metadata: withKnowledgeMetadata(input.file, extracted.status, {
          reason: extracted.reason,
        }),
      })
      return
    }

    const chunks = chunkExtractedText(extracted.text)
    if (chunks.length === 0) {
      await neonFileChunksRepository.replaceForFile(
        input.userId,
        input.file.id,
        []
      )
      await neonFilesRepository.patch(input.userId, input.file.id, {
        metadata: withKnowledgeMetadata(input.file, 'empty', {
          reason: 'No chunks were produced from the extracted text.',
        }),
      })
      return
    }

    const embeddings = await createEmbeddings(chunks.map((chunk) => chunk.content))
    const embeddingModel = getEmbeddingModel()
    await neonFileChunksRepository.replaceForFile(
      input.userId,
      input.file.id,
      chunks.map((chunk, index) => ({
        userId: input.userId,
        projectId: input.projectId ?? input.file.projectId,
        conversationId: input.conversationId ?? input.file.conversationId,
        messageId: input.messageId ?? input.file.messageId,
        fileId: input.file.id,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        contentHash: chunk.contentHash,
        tokenCountEstimate: chunk.tokenCountEstimate,
        embeddingModel,
        embedding: embeddings[index],
        metadata: {
          charStart: chunk.charStart,
          charEnd: chunk.charEnd,
        },
      }))
    )

    await neonFilesRepository.patch(input.userId, input.file.id, {
      metadata: withKnowledgeMetadata(input.file, 'indexed', {
        chunkCount: chunks.length,
        embeddingModel,
      }),
    })
  } catch {
    await neonFilesRepository.patch(input.userId, input.file.id, {
      metadata: withKnowledgeMetadata(input.file, 'failed', {
        reason: 'Indexing failed. Try re-indexing this file.',
      }),
    })
  }
}
