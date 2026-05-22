import { ImageGenerationEvent, UsageEvent } from '@/types'
import { neonQuery, toNumber } from './neon'

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
  raw_cost_usd: number | string
  displayed_cost_usd: number | string
  display_multiplier: number | string
  margin_usd: number | string
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
  raw_cost_usd: number | string
  displayed_cost_usd: number | string
  display_multiplier: number | string
  margin_usd: number | string
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
    rawCostUsd: toNumber(row.raw_cost_usd),
    displayedCostUsd: toNumber(row.displayed_cost_usd),
    displayMultiplier: toNumber(row.display_multiplier),
    marginUsd: toNumber(row.margin_usd),
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
    rawCostUsd: toNumber(row.raw_cost_usd),
    displayedCostUsd: toNumber(row.displayed_cost_usd),
    displayMultiplier: toNumber(row.display_multiplier),
    marginUsd: toNumber(row.margin_usd),
    outputUrls: row.output_urls ?? [],
    createdAt: row.created_at,
  }
}

class UsageEventsStore {
  async list(): Promise<UsageEvent[]> {
    const rows = await neonQuery<UsageEventRow>(
      'select * from public.zen_usage_events order by created_at desc'
    )

    return rows.map(rowToUsageEvent)
  }

  async listByUser(userId: string): Promise<UsageEvent[]> {
    const rows = await neonQuery<UsageEventRow>(
      `
        select *
        from public.zen_usage_events
        where user_id = $1
        order by created_at desc
      `,
      [userId]
    )

    return rows.map(rowToUsageEvent)
  }

  async create(event: Omit<UsageEvent, 'id' | 'createdAt'>): Promise<UsageEvent> {
    const rows = await neonQuery<UsageEventRow>(
      `
        insert into public.zen_usage_events (
          user_id,
          subscription_id,
          conversation_id,
          message_id,
          assistant_family,
          mode,
          model,
          wallet_type,
          prompt_tokens,
          completion_tokens,
          total_tokens,
          raw_cost_usd,
          displayed_cost_usd,
          display_multiplier,
          margin_usd,
          credits_consumed
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        returning *
      `,
      [
        event.userId,
        event.subscriptionId,
        event.conversationId ?? null,
        event.messageId ?? null,
        event.assistantFamily,
        event.mode,
        event.model,
        event.walletType,
        event.promptTokens,
        event.completionTokens,
        event.totalTokens,
        event.rawCostUsd,
        event.displayedCostUsd,
        event.displayMultiplier,
        event.marginUsd,
        event.creditsConsumed,
      ]
    )

    return rowToUsageEvent(rows[0])
  }
}

class ImageGenerationEventsStore {
  async listByUser(userId: string): Promise<ImageGenerationEvent[]> {
    const rows = await neonQuery<ImageEventRow>(
      `
        select *
        from public.zen_image_generation_events
        where user_id = $1
        order by created_at desc
      `,
      [userId]
    )

    return rows.map(rowToImageEvent)
  }

  async list(): Promise<ImageGenerationEvent[]> {
    const rows = await neonQuery<ImageEventRow>(
      'select * from public.zen_image_generation_events order by created_at desc'
    )

    return rows.map(rowToImageEvent)
  }

  async create(
    event: Omit<ImageGenerationEvent, 'id' | 'createdAt'>
  ): Promise<ImageGenerationEvent> {
    const rows = await neonQuery<ImageEventRow>(
      `
        insert into public.zen_image_generation_events (
          user_id,
          subscription_id,
          conversation_id,
          message_id,
          assistant_family,
          model,
          prompt,
          negative_prompt,
          size,
          aspect_ratio,
          image_count,
          image_credits_consumed,
          raw_cost_usd,
          displayed_cost_usd,
          display_multiplier,
          margin_usd,
          output_urls
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb)
        returning *
      `,
      [
        event.userId,
        event.subscriptionId,
        event.conversationId ?? null,
        event.messageId ?? null,
        event.assistantFamily,
        event.model,
        event.prompt,
        event.negativePrompt ?? null,
        event.size ?? null,
        event.aspectRatio ?? null,
        event.imageCount,
        event.imageCreditsConsumed,
        event.rawCostUsd,
        event.displayedCostUsd,
        event.displayMultiplier,
        event.marginUsd,
        JSON.stringify(event.outputUrls),
      ]
    )

    return rowToImageEvent(rows[0])
  }
}

export const usageEventsStore = new UsageEventsStore()
export const imageGenerationEventsStore = new ImageGenerationEventsStore()
