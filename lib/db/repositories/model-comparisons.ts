import 'server-only'

import { and, asc, eq } from 'drizzle-orm'
import {
  MessageSource,
  ModelComparison,
  ModelComparisonCandidate,
  SessionSettings,
  UsageEstimate,
} from '@/types'
import { getDatabaseClient } from '../client'
import {
  zenModelComparisonCandidates,
  zenModelComparisons,
} from '../schema'
import {
  toIsoString,
  toJsonArray,
  toJsonObject,
  toNullableIsoString,
} from './helpers'
import { neonUsersRepository } from './users'

type ComparisonRow = typeof zenModelComparisons.$inferSelect
type CandidateRow = typeof zenModelComparisonCandidates.$inferSelect

function scrubUsageForClient(value: unknown): UsageEstimate | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const usage = value as UsageEstimate

  return {
    ...usage,
    rawCostUsd: 0,
    marginUsd: 0,
  }
}

function rowToCandidate(row: CandidateRow): ModelComparisonCandidate {
  return {
    id: row.id,
    comparisonId: row.comparisonId,
    mode: row.mode as ModelComparisonCandidate['mode'],
    assistantFamily: row.assistantFamily as ModelComparisonCandidate['assistantFamily'],
    model: row.model,
    label: row.label,
    content: row.content,
    status: row.status as ModelComparisonCandidate['status'],
    error: row.error,
    latencyMs: row.latencyMs,
    usage: scrubUsageForClient(row.usage),
    sources: toJsonArray<MessageSource>(row.sources),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  }
}

function rowToComparison(
  row: ComparisonRow,
  candidates: CandidateRow[]
): ModelComparison {
  return {
    id: row.id,
    userId: row.userId,
    conversationId: row.conversationId,
    promptMessageId: row.promptMessageId,
    projectId: row.projectId,
    prompt: row.prompt,
    status: row.status as ModelComparison['status'],
    selectedCandidateId: row.selectedCandidateId,
    settings: toJsonObject<SessionSettings>(row.settings, {} as SessionSettings),
    candidates: candidates.map(rowToCandidate),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  }
}

export type CreateModelComparisonInput = {
  conversationId: string
  promptMessageId: string
  projectId?: string | null
  prompt: string
  status: ModelComparison['status']
  settings: SessionSettings
  candidates: Array<{
    id?: string
    mode: ModelComparisonCandidate['mode']
    assistantFamily: ModelComparisonCandidate['assistantFamily']
    model: string
    label: string
    content: string
    status: ModelComparisonCandidate['status']
    error?: string | null
    latencyMs?: number | null
    usage?: UsageEstimate
    sources?: MessageSource[]
  }>
}

class NeonModelComparisonsRepository {
  async create(
    userId: string,
    input: CreateModelComparisonInput
  ): Promise<ModelComparison> {
    await neonUsersRepository.ensureUserReference(userId)

    const db = getDatabaseClient()
    const rows = await db
      .insert(zenModelComparisons)
      .values({
        userId,
        conversationId: input.conversationId,
        promptMessageId: input.promptMessageId,
        projectId: input.projectId ?? null,
        prompt: input.prompt,
        status: input.status,
        settings: input.settings,
      })
      .returning()

    const comparison = rows[0]
    if (!comparison) {
      throw new Error('Unable to create model comparison.')
    }

    if (input.candidates.length > 0) {
      await db.insert(zenModelComparisonCandidates).values(
        input.candidates.map((candidate) => ({
          id: candidate.id,
          comparisonId: comparison.id,
          mode: candidate.mode,
          assistantFamily: candidate.assistantFamily,
          model: candidate.model,
          label: candidate.label,
          content: candidate.content,
          status: candidate.status,
          error: candidate.error ?? null,
          latencyMs: candidate.latencyMs ?? null,
          usage: candidate.usage ?? null,
          sources: candidate.sources ?? [],
        }))
      )
    }

    const saved = await this.get(userId, comparison.id)
    if (!saved) {
      throw new Error('Unable to load saved model comparison.')
    }

    return saved
  }

  async get(userId: string, id: string): Promise<ModelComparison | null> {
    const db = getDatabaseClient()
    const rows = await db
      .select()
      .from(zenModelComparisons)
      .where(and(eq(zenModelComparisons.userId, userId), eq(zenModelComparisons.id, id)))
      .limit(1)

    if (!rows[0]) return null

    const candidates = await db
      .select()
      .from(zenModelComparisonCandidates)
      .where(eq(zenModelComparisonCandidates.comparisonId, id))
      .orderBy(asc(zenModelComparisonCandidates.createdAt))

    return rowToComparison(rows[0], candidates)
  }

  async selectCandidate(
    userId: string,
    comparisonId: string,
    candidateId: string
  ): Promise<ModelComparison | null> {
    const db = getDatabaseClient()
    await db
      .update(zenModelComparisons)
      .set({
        selectedCandidateId: candidateId,
        status: 'complete',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(zenModelComparisons.userId, userId),
          eq(zenModelComparisons.id, comparisonId)
        )
      )

    return await this.get(userId, comparisonId)
  }
}

export const neonModelComparisonsRepository =
  new NeonModelComparisonsRepository()
