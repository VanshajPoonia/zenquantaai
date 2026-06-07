import 'server-only'

import { SQL, and, desc, eq, gte, inArray, lte } from 'drizzle-orm'
import { AssistantFamily, ImageGenerationEvent, UsageEvent } from '@/types'
import { getDatabaseClient } from '../client'
import { zenImageGenerationEvents, zenUsageEvents } from '../schema'
import { toIsoString, toJsonArray, toNumber } from './helpers'
import { neonUsersRepository } from './users'

type UsageEventRow = typeof zenUsageEvents.$inferSelect
type ImageEventRow = typeof zenImageGenerationEvents.$inferSelect

type UsageEventListFilters = {
  userId?: string
  userIds?: string[]
  subscriptionId?: string
  assistantFamily?: AssistantFamily | null
  from?: Date | null
  to?: Date | null
  limit?: number | null
}

type ImageEventListFilters = UsageEventListFilters & {
  model?: string | null
  messageIds?: string[]
}

const MAX_EVENT_LIST_LIMIT = 10000

function normalizeLimit(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.max(1, Math.min(MAX_EVENT_LIST_LIMIT, Math.floor(value)))
}

function rowToUsageEvent(row: UsageEventRow): UsageEvent {
  return {
    id: row.id,
    userId: row.userId,
    subscriptionId: row.subscriptionId,
    conversationId: row.conversationId,
    messageId: row.messageId,
    assistantFamily: row.assistantFamily as UsageEvent['assistantFamily'],
    mode: row.mode as UsageEvent['mode'],
    model: row.model,
    walletType: row.walletType as UsageEvent['walletType'],
    promptTokens: row.promptTokens,
    completionTokens: row.completionTokens,
    totalTokens: row.totalTokens,
    rawCostUsd: toNumber(row.rawCostUsd),
    displayedCostUsd: toNumber(row.displayedCostUsd),
    displayMultiplier: toNumber(row.displayMultiplier),
    marginUsd: toNumber(row.marginUsd),
    creditsConsumed: row.creditsConsumed,
    createdAt: toIsoString(row.createdAt),
  }
}

function rowToImageEvent(row: ImageEventRow): ImageGenerationEvent {
  return {
    id: row.id,
    userId: row.userId,
    subscriptionId: row.subscriptionId,
    conversationId: row.conversationId,
    messageId: row.messageId,
    assistantFamily: 'prism',
    model: row.model,
    prompt: row.prompt,
    negativePrompt: row.negativePrompt,
    size: row.size,
    aspectRatio: row.aspectRatio,
    imageCount: row.imageCount,
    imageCreditsConsumed: row.imageCreditsConsumed,
    rawCostUsd: toNumber(row.rawCostUsd),
    displayedCostUsd: toNumber(row.displayedCostUsd),
    displayMultiplier: toNumber(row.displayMultiplier),
    marginUsd: toNumber(row.marginUsd),
    outputUrls: toJsonArray<string>(row.outputUrls),
    createdAt: toIsoString(row.createdAt),
  }
}

class NeonUsageEventsRepository {
  async list(filters: UsageEventListFilters = {}): Promise<UsageEvent[]> {
    if (filters.userIds && filters.userIds.length === 0) return []

    const conditions: SQL[] = []

    if (filters.userId) {
      conditions.push(eq(zenUsageEvents.userId, filters.userId))
    }
    if (filters.userIds?.length) {
      conditions.push(inArray(zenUsageEvents.userId, filters.userIds))
    }
    if (filters.subscriptionId) {
      conditions.push(eq(zenUsageEvents.subscriptionId, filters.subscriptionId))
    }
    if (filters.assistantFamily) {
      conditions.push(eq(zenUsageEvents.assistantFamily, filters.assistantFamily))
    }
    if (filters.from) {
      conditions.push(gte(zenUsageEvents.createdAt, filters.from))
    }
    if (filters.to) {
      conditions.push(lte(zenUsageEvents.createdAt, filters.to))
    }

    const limit = normalizeLimit(filters.limit)
    const query = getDatabaseClient()
      .select()
      .from(zenUsageEvents)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(zenUsageEvents.createdAt))
    const rows = limit ? await query.limit(limit) : await query

    return rows.map(rowToUsageEvent)
  }

  async listByUser(
    userId: string,
    filters: Omit<UsageEventListFilters, 'userId' | 'userIds'> = {}
  ): Promise<UsageEvent[]> {
    return await this.list({ ...filters, userId })
  }

  async create(event: Omit<UsageEvent, 'id' | 'createdAt'>): Promise<UsageEvent> {
    await neonUsersRepository.ensureUserReference(event.userId)

    const rows = await getDatabaseClient()
      .insert(zenUsageEvents)
      .values({
        userId: event.userId,
        subscriptionId: event.subscriptionId,
        conversationId: event.conversationId ?? null,
        messageId: event.messageId ?? null,
        assistantFamily: event.assistantFamily,
        mode: event.mode,
        model: event.model,
        walletType: event.walletType,
        promptTokens: event.promptTokens,
        completionTokens: event.completionTokens,
        totalTokens: event.totalTokens,
        rawCostUsd: String(event.rawCostUsd),
        displayedCostUsd: String(event.displayedCostUsd),
        displayMultiplier: String(event.displayMultiplier),
        marginUsd: String(event.marginUsd),
        creditsConsumed: event.creditsConsumed,
      })
      .returning()

    return rowToUsageEvent(rows[0])
  }
}

class NeonImageGenerationEventsRepository {
  async listByUser(
    userId: string,
    filters: Omit<ImageEventListFilters, 'userId' | 'userIds'> = {}
  ): Promise<ImageGenerationEvent[]> {
    return await this.list({ ...filters, userId })
  }

  async list(filters: ImageEventListFilters = {}): Promise<ImageGenerationEvent[]> {
    if (filters.userIds && filters.userIds.length === 0) return []
    if (filters.messageIds && filters.messageIds.length === 0) return []
    if (
      filters.assistantFamily &&
      filters.assistantFamily !== 'prism'
    ) {
      return []
    }

    const conditions: SQL[] = []

    if (filters.userId) {
      conditions.push(eq(zenImageGenerationEvents.userId, filters.userId))
    }
    if (filters.userIds?.length) {
      conditions.push(inArray(zenImageGenerationEvents.userId, filters.userIds))
    }
    if (filters.subscriptionId) {
      conditions.push(
        eq(zenImageGenerationEvents.subscriptionId, filters.subscriptionId)
      )
    }
    if (filters.model) {
      conditions.push(eq(zenImageGenerationEvents.model, filters.model))
    }
    if (filters.messageIds?.length) {
      conditions.push(inArray(zenImageGenerationEvents.messageId, filters.messageIds))
    }
    if (filters.from) {
      conditions.push(gte(zenImageGenerationEvents.createdAt, filters.from))
    }
    if (filters.to) {
      conditions.push(lte(zenImageGenerationEvents.createdAt, filters.to))
    }

    const limit = normalizeLimit(filters.limit)
    const query = getDatabaseClient()
      .select()
      .from(zenImageGenerationEvents)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(zenImageGenerationEvents.createdAt))
    const rows = limit ? await query.limit(limit) : await query

    return rows.map(rowToImageEvent)
  }

  async listByUserMessageIds(
    userId: string,
    messageIds: string[]
  ): Promise<ImageGenerationEvent[]> {
    return await this.list({ userId, messageIds, limit: messageIds.length })
  }

  async create(
    event: Omit<ImageGenerationEvent, 'id' | 'createdAt'>
  ): Promise<ImageGenerationEvent> {
    await neonUsersRepository.ensureUserReference(event.userId)

    const rows = await getDatabaseClient()
      .insert(zenImageGenerationEvents)
      .values({
        userId: event.userId,
        subscriptionId: event.subscriptionId,
        conversationId: event.conversationId ?? null,
        messageId: event.messageId ?? null,
        assistantFamily: event.assistantFamily,
        model: event.model,
        prompt: event.prompt,
        negativePrompt: event.negativePrompt ?? null,
        size: event.size ?? null,
        aspectRatio: event.aspectRatio ?? null,
        imageCount: event.imageCount,
        imageCreditsConsumed: event.imageCreditsConsumed,
        rawCostUsd: String(event.rawCostUsd),
        displayedCostUsd: String(event.displayedCostUsd),
        displayMultiplier: String(event.displayMultiplier),
        marginUsd: String(event.marginUsd),
        outputUrls: event.outputUrls,
      })
      .returning()

    return rowToImageEvent(rows[0])
  }
}

export const neonUsageEventsRepository = new NeonUsageEventsRepository()
export const neonImageGenerationEventsRepository =
  new NeonImageGenerationEventsRepository()
