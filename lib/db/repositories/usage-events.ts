import 'server-only'

import { desc, eq } from 'drizzle-orm'
import { ImageGenerationEvent, UsageEvent } from '@/types'
import { getDatabaseClient } from '../client'
import { zenImageGenerationEvents, zenUsageEvents } from '../schema'
import { toIsoString, toJsonArray, toNumber } from './helpers'
import { neonUsersRepository } from './users'

type UsageEventRow = typeof zenUsageEvents.$inferSelect
type ImageEventRow = typeof zenImageGenerationEvents.$inferSelect

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
  async list(): Promise<UsageEvent[]> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenUsageEvents)
      .orderBy(desc(zenUsageEvents.createdAt))

    return rows.map(rowToUsageEvent)
  }

  async listByUser(userId: string): Promise<UsageEvent[]> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenUsageEvents)
      .where(eq(zenUsageEvents.userId, userId))
      .orderBy(desc(zenUsageEvents.createdAt))

    return rows.map(rowToUsageEvent)
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
  async listByUser(userId: string): Promise<ImageGenerationEvent[]> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenImageGenerationEvents)
      .where(eq(zenImageGenerationEvents.userId, userId))
      .orderBy(desc(zenImageGenerationEvents.createdAt))

    return rows.map(rowToImageEvent)
  }

  async list(): Promise<ImageGenerationEvent[]> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenImageGenerationEvents)
      .orderBy(desc(zenImageGenerationEvents.createdAt))

    return rows.map(rowToImageEvent)
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
