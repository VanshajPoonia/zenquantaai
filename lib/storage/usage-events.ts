import { ImageGenerationEvent, UsageEvent } from '@/types'
import { supabaseRequest } from './supabase'

const USAGE_EVENTS_TABLE = 'zen_usage_events'
const IMAGE_EVENTS_TABLE = 'zen_image_generation_events'

type UsageEventRow = {
  id: string
  user_id: string
  subscription_id: string
  conversation_id: string | null
  message_id: string | null
  assistant_family: UsageEvent['assistantFamily']
  mode: UsageEvent['mode']
  model: string
  wallet_type: UsageEvent['walletType']
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  raw_cost_usd: number
  displayed_cost_usd: number
  display_multiplier: number
  margin_usd: number
  credits_consumed: number
  created_at: string
}

type ImageEventRow = {
  id: string
  user_id: string
  subscription_id: string
  conversation_id: string | null
  message_id: string | null
  assistant_family: 'prism'
  model: string
  prompt: string
  negative_prompt: string | null
  size: string | null
  aspect_ratio: string | null
  image_count: number
  image_credits_consumed: number
  raw_cost_usd: number
  displayed_cost_usd: number
  display_multiplier: number
  margin_usd: number
  output_urls: string[] | null
  created_at: string
}

function rowToUsageEvent(row: UsageEventRow): UsageEvent {
  return {
    id: row.id,
    userId: row.user_id,
    subscriptionId: row.subscription_id,
    conversationId: row.conversation_id,
    messageId: row.message_id,
    assistantFamily: row.assistant_family,
    mode: row.mode,
    model: row.model,
    walletType: row.wallet_type,
    promptTokens: row.prompt_tokens,
    completionTokens: row.completion_tokens,
    totalTokens: row.total_tokens,
    rawCostUsd: row.raw_cost_usd,
    displayedCostUsd: row.displayed_cost_usd,
    displayMultiplier: row.display_multiplier,
    marginUsd: row.margin_usd,
    creditsConsumed: row.credits_consumed,
    createdAt: row.created_at,
  }
}

function rowToImageEvent(row: ImageEventRow): ImageGenerationEvent {
  return {
    id: row.id,
    userId: row.user_id,
    subscriptionId: row.subscription_id,
    conversationId: row.conversation_id,
    messageId: row.message_id,
    assistantFamily: 'prism',
    model: row.model,
    prompt: row.prompt,
    negativePrompt: row.negative_prompt,
    size: row.size,
    aspectRatio: row.aspect_ratio,
    imageCount: row.image_count,
    imageCreditsConsumed: row.image_credits_consumed,
    rawCostUsd: row.raw_cost_usd,
    displayedCostUsd: row.displayed_cost_usd,
    displayMultiplier: row.display_multiplier,
    marginUsd: row.margin_usd,
    outputUrls: row.output_urls ?? [],
    createdAt: row.created_at,
  }
}

class UsageEventsStore {
  async list(): Promise<UsageEvent[]> {
    const rows = await supabaseRequest<UsageEventRow[]>(USAGE_EVENTS_TABLE, {
      query: {
        select: '*',
        order: 'created_at.desc',
      },
    })

    return rows.map(rowToUsageEvent)
  }

  async listByUser(userId: string): Promise<UsageEvent[]> {
    const rows = await supabaseRequest<UsageEventRow[]>(USAGE_EVENTS_TABLE, {
      query: {
        user_id: `eq.${userId}`,
        select: '*',
        order: 'created_at.desc',
      },
    })

    return rows.map(rowToUsageEvent)
  }

  async create(event: Omit<UsageEvent, 'id' | 'createdAt'>): Promise<UsageEvent> {
    const rows = await supabaseRequest<UsageEventRow[]>(USAGE_EVENTS_TABLE, {
      method: 'POST',
      body: {
        user_id: event.userId,
        subscription_id: event.subscriptionId,
        conversation_id: event.conversationId ?? null,
        message_id: event.messageId ?? null,
        assistant_family: event.assistantFamily,
        mode: event.mode,
        model: event.model,
        wallet_type: event.walletType,
        prompt_tokens: event.promptTokens,
        completion_tokens: event.completionTokens,
        total_tokens: event.totalTokens,
        raw_cost_usd: event.rawCostUsd,
        displayed_cost_usd: event.displayedCostUsd,
        display_multiplier: event.displayMultiplier,
        margin_usd: event.marginUsd,
        credits_consumed: event.creditsConsumed,
      },
      prefer: 'return=representation',
    })

    return rowToUsageEvent(rows[0])
  }
}

class ImageGenerationEventsStore {
  async listByUser(userId: string): Promise<ImageGenerationEvent[]> {
    const rows = await supabaseRequest<ImageEventRow[]>(IMAGE_EVENTS_TABLE, {
      query: {
        user_id: `eq.${userId}`,
        select: '*',
        order: 'created_at.desc',
      },
    })

    return rows.map(rowToImageEvent)
  }

  async list(): Promise<ImageGenerationEvent[]> {
    const rows = await supabaseRequest<ImageEventRow[]>(IMAGE_EVENTS_TABLE, {
      query: {
        select: '*',
        order: 'created_at.desc',
      },
    })

    return rows.map(rowToImageEvent)
  }

  async create(
    event: Omit<ImageGenerationEvent, 'id' | 'createdAt'>
  ): Promise<ImageGenerationEvent> {
    const rows = await supabaseRequest<ImageEventRow[]>(IMAGE_EVENTS_TABLE, {
      method: 'POST',
      body: {
        user_id: event.userId,
        subscription_id: event.subscriptionId,
        conversation_id: event.conversationId ?? null,
        message_id: event.messageId ?? null,
        assistant_family: event.assistantFamily,
        model: event.model,
        prompt: event.prompt,
        negative_prompt: event.negativePrompt ?? null,
        size: event.size ?? null,
        aspect_ratio: event.aspectRatio ?? null,
        image_count: event.imageCount,
        image_credits_consumed: event.imageCreditsConsumed,
        raw_cost_usd: event.rawCostUsd,
        displayed_cost_usd: event.displayedCostUsd,
        display_multiplier: event.displayMultiplier,
        margin_usd: event.marginUsd,
        output_urls: event.outputUrls,
      },
      prefer: 'return=representation',
    })

    return rowToImageEvent(rows[0])
  }
}

export const usageEventsStore = new UsageEventsStore()
export const imageGenerationEventsStore = new ImageGenerationEventsStore()
