import 'server-only'

import { and, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import {
  FeedbackEntityType,
  FeedbackEvent,
  FeedbackRating,
} from '@/types'
import {
  normalizeFeedbackReason,
  sanitizeFeedbackMetadata,
} from '@/lib/feedback/validation'
import { getDatabaseClient } from '../client'
import {
  zenArtifacts,
  zenConversations,
  zenFeedbackEvents,
  zenGeneratedImages,
  zenMessages,
  zenModelComparisonCandidates,
  zenModelComparisons,
  zenPromptWorkflowRuns,
} from '../schema'
import { toIsoString, toJsonObject } from './helpers'
import { neonUsersRepository } from './users'

type FeedbackRow = typeof zenFeedbackEvents.$inferSelect

export class FeedbackEntityNotFoundError extends Error {
  constructor(message = 'Feedback target not found.') {
    super(message)
    this.name = 'FeedbackEntityNotFoundError'
  }
}

export interface CreateFeedbackInput {
  entityType: FeedbackEntityType
  entityId: string
  rating: FeedbackRating
  reason?: string | null
  metadata?: Record<string, unknown> | null
}

export interface FeedbackListFilters {
  entityType?: FeedbackEntityType | null
  entityId?: string | null
  rating?: FeedbackRating | null
  from?: Date | null
  to?: Date | null
  userIds?: string[] | null
  limit?: number | null
}

const DEFAULT_FEEDBACK_LIST_LIMIT = 100
const MAX_FEEDBACK_LIST_LIMIT = 1000

function normalizeLimit(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_FEEDBACK_LIST_LIMIT
  }
  return Math.max(1, Math.min(MAX_FEEDBACK_LIST_LIMIT, Math.floor(value)))
}

function rowToFeedback(row: FeedbackRow): FeedbackEvent {
  return {
    id: row.id,
    userId: row.userId,
    entityType: row.entityType as FeedbackEntityType,
    entityId: row.entityId,
    rating: row.rating as FeedbackRating,
    reason: row.reason,
    metadata: toJsonObject<Record<string, unknown>>(row.metadata, {}),
    createdAt: toIsoString(row.createdAt),
  }
}

class NeonFeedbackRepository {
  async create(
    userId: string,
    input: CreateFeedbackInput
  ): Promise<FeedbackEvent> {
    await neonUsersRepository.ensureUserReference(userId)
    await this.assertOwnedEntity(userId, input.entityType, input.entityId)

    const rows = await getDatabaseClient()
      .insert(zenFeedbackEvents)
      .values({
        userId,
        entityType: input.entityType,
        entityId: input.entityId,
        rating: input.rating,
        reason: normalizeFeedbackReason(input.reason),
        metadata: sanitizeFeedbackMetadata(input.metadata),
      })
      .returning()

    if (!rows[0]) {
      throw new Error('Unable to save feedback.')
    }

    return rowToFeedback(rows[0])
  }

  async listByUser(
    userId: string,
    filters: FeedbackListFilters = {}
  ): Promise<FeedbackEvent[]> {
    const conditions = [eq(zenFeedbackEvents.userId, userId)]

    if (filters.entityType) {
      conditions.push(eq(zenFeedbackEvents.entityType, filters.entityType))
    }
    if (filters.entityId) {
      conditions.push(eq(zenFeedbackEvents.entityId, filters.entityId))
    }
    if (filters.rating) {
      conditions.push(eq(zenFeedbackEvents.rating, filters.rating))
    }
    if (filters.from) {
      conditions.push(gte(zenFeedbackEvents.createdAt, filters.from))
    }
    if (filters.to) {
      conditions.push(lte(zenFeedbackEvents.createdAt, filters.to))
    }

    const rows = await getDatabaseClient()
      .select()
      .from(zenFeedbackEvents)
      .where(and(...conditions))
      .orderBy(desc(zenFeedbackEvents.createdAt))
      .limit(normalizeLimit(filters.limit))

    return rows.map(rowToFeedback)
  }

  async listForAdminAnalytics(
    filters: FeedbackListFilters = {}
  ): Promise<FeedbackEvent[]> {
    const conditions = []

    if (filters.userIds?.length) {
      conditions.push(inArray(zenFeedbackEvents.userId, filters.userIds))
    }
    if (filters.entityType) {
      conditions.push(eq(zenFeedbackEvents.entityType, filters.entityType))
    }
    if (filters.rating) {
      conditions.push(eq(zenFeedbackEvents.rating, filters.rating))
    }
    if (filters.from) {
      conditions.push(gte(zenFeedbackEvents.createdAt, filters.from))
    }
    if (filters.to) {
      conditions.push(lte(zenFeedbackEvents.createdAt, filters.to))
    }

    const db = getDatabaseClient()
    const rows =
      conditions.length > 0
        ? await db
            .select()
            .from(zenFeedbackEvents)
            .where(and(...conditions))
            .orderBy(desc(zenFeedbackEvents.createdAt))
            .limit(normalizeLimit(filters.limit ?? 1000))
        : await db
            .select()
            .from(zenFeedbackEvents)
            .orderBy(desc(zenFeedbackEvents.createdAt))
            .limit(normalizeLimit(filters.limit ?? 1000))

    return rows.map(rowToFeedback)
  }

  private async assertOwnedEntity(
    userId: string,
    entityType: FeedbackEntityType,
    entityId: string
  ): Promise<void> {
    if (entityType === 'search_result') return

    const db = getDatabaseClient()
    let rows: unknown[] = []

    if (entityType === 'message') {
      rows = await db
        .select({ id: zenMessages.id })
        .from(zenMessages)
        .innerJoin(
          zenConversations,
          eq(zenMessages.conversationId, zenConversations.id)
        )
        .where(
          and(
            eq(zenConversations.userId, userId),
            eq(zenMessages.id, entityId),
            eq(zenMessages.role, 'assistant'),
            eq(zenMessages.status, 'complete')
          )
        )
        .limit(1)
    }

    if (entityType === 'model_candidate') {
      rows = await db
        .select({ id: zenModelComparisonCandidates.id })
        .from(zenModelComparisonCandidates)
        .innerJoin(
          zenModelComparisons,
          eq(
            zenModelComparisonCandidates.comparisonId,
            zenModelComparisons.id
          )
        )
        .where(
          and(
            eq(zenModelComparisons.userId, userId),
            eq(zenModelComparisonCandidates.id, entityId),
            eq(zenModelComparisonCandidates.status, 'complete')
          )
        )
        .limit(1)
    }

    if (entityType === 'artifact_action') {
      rows = await db
        .select({ id: zenArtifacts.id })
        .from(zenArtifacts)
        .where(and(eq(zenArtifacts.userId, userId), eq(zenArtifacts.id, entityId)))
        .limit(1)
    }

    if (entityType === 'playbook_run') {
      rows = await db
        .select({ id: zenPromptWorkflowRuns.id })
        .from(zenPromptWorkflowRuns)
        .where(
          and(
            eq(zenPromptWorkflowRuns.userId, userId),
            eq(zenPromptWorkflowRuns.id, entityId)
          )
        )
        .limit(1)
    }

    if (entityType === 'image_generation') {
      rows = await db
        .select({ id: zenGeneratedImages.id })
        .from(zenGeneratedImages)
        .where(
          and(
            eq(zenGeneratedImages.userId, userId),
            eq(zenGeneratedImages.id, entityId)
          )
        )
        .limit(1)
    }

    if (rows.length === 0) {
      throw new FeedbackEntityNotFoundError()
    }
  }
}

export const neonFeedbackRepository = new NeonFeedbackRepository()
