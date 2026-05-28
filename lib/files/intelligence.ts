import { FileKnowledgeStatus } from '@/types'

type KnowledgeBaseMetadata = {
  status?: unknown
  reason?: unknown
  chunkCount?: unknown
  embeddingModel?: unknown
  updatedAt?: unknown
}

export interface NormalizedFileKnowledge {
  knowledgeStatus: FileKnowledgeStatus
  knowledgeStatusLabel: string
  knowledgeReason: string | null
  chunkCount: number
  embeddingModel: string | null
  knowledgeUpdatedAt: string | null
}

function knowledgeBaseMetadata(
  metadata: Record<string, unknown>
): KnowledgeBaseMetadata | null {
  const value = metadata.knowledgeBase
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as KnowledgeBaseMetadata
}

function safeReason(
  status: FileKnowledgeStatus,
  rawStatus: string | null,
  reason: unknown
): string | null {
  if (status === 'indexed') return null
  if (status === 'pending') return 'Indexing state has not been recorded yet.'
  if (status === 'failed') return 'Indexing failed. Try re-indexing this file.'
  if (rawStatus === 'skipped_not_configured') {
    return 'Embedding provider is not configured.'
  }
  if (typeof reason !== 'string' || !reason.trim()) return null
  return reason.replace(/\s+/g, ' ').trim().slice(0, 220)
}

function mapKnowledgeStatus(rawStatus: unknown): FileKnowledgeStatus {
  if (rawStatus === 'indexed') return 'indexed'
  if (rawStatus === 'unsupported') return 'unsupported'
  if (rawStatus === 'failed') return 'failed'
  if (rawStatus === 'empty' || rawStatus === 'skipped_not_configured') {
    return 'skipped'
  }
  return 'pending'
}

function statusLabel(status: FileKnowledgeStatus): string {
  switch (status) {
    case 'indexed':
      return 'Indexed'
    case 'skipped':
      return 'Skipped'
    case 'unsupported':
      return 'Unsupported'
    case 'failed':
      return 'Failed'
    case 'pending':
      return 'Pending'
  }
}

export function normalizeFileKnowledge(
  metadata: Record<string, unknown>
): NormalizedFileKnowledge {
  const knowledge = knowledgeBaseMetadata(metadata)
  const rawStatus = typeof knowledge?.status === 'string' ? knowledge.status : null
  const knowledgeStatus = mapKnowledgeStatus(rawStatus)

  return {
    knowledgeStatus,
    knowledgeStatusLabel: statusLabel(knowledgeStatus),
    knowledgeReason: safeReason(knowledgeStatus, rawStatus, knowledge?.reason),
    chunkCount:
      typeof knowledge?.chunkCount === 'number' && Number.isFinite(knowledge.chunkCount)
        ? knowledge.chunkCount
        : 0,
    embeddingModel:
      typeof knowledge?.embeddingModel === 'string' ? knowledge.embeddingModel : null,
    knowledgeUpdatedAt:
      typeof knowledge?.updatedAt === 'string' ? knowledge.updatedAt : null,
  }
}
