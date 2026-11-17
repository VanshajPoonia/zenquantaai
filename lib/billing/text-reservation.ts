import 'server-only'

import { neonSubscriptionsRepository } from '@/lib/db/repositories'
import type { UsageEstimate, UsageEvent } from '@/types'
import { recordTextUsageEvent } from './log-usage'

type TokenWallet = 'core_tokens' | 'tier_tokens'

export const TEXT_USAGE_LIMIT_MESSAGE =
  'You have reached your usage limit for this plan. Please try again shortly.'

export interface TextUsageEventInput {
  userId: string
  conversationId?: string | null
  messageId?: string | null
  assistantFamily: UsageEvent['assistantFamily']
  mode: UsageEvent['mode']
  model: string
  walletType: UsageEvent['walletType']
  usage: UsageEstimate
}

/**
 * Claims tokens and one daily message before a model call, like `/api/chat`.
 * Settle it with the real usage afterwards, or release it if the call fails.
 */
export class TextUsageReservation {
  private open = true

  private constructor(
    private readonly userId: string,
    private readonly walletType: TokenWallet,
    private readonly reservedTokens: number
  ) {}

  static async reserve(input: {
    userId: string
    walletType: UsageEvent['walletType']
    estimatedPromptTokens: number
    maxOutputTokens: number
    effective: { coreTokensIncluded: number; tierTokensIncluded: number; dailyMessageLimit: number }
  }): Promise<TextUsageReservation> {
    const walletType: TokenWallet = input.walletType === 'tier_tokens' ? 'tier_tokens' : 'core_tokens'
    const reservedTokens = input.estimatedPromptTokens + input.maxOutputTokens
    const reserved = await neonSubscriptionsRepository.reserveTextUsage({
      userId: input.userId,
      walletType,
      estimatedTokens: reservedTokens,
      effectiveIncluded:
        walletType === 'tier_tokens'
          ? input.effective.tierTokensIncluded
          : input.effective.coreTokensIncluded,
      effectiveDailyMessageLimit: input.effective.dailyMessageLimit,
    })
    if (!reserved) throw new Error(TEXT_USAGE_LIMIT_MESSAGE)
    return new TextUsageReservation(input.userId, walletType, reservedTokens)
  }

  /** Moves the claim to the real usage and records the usage event. */
  async settle(event: TextUsageEventInput): Promise<UsageEvent> {
    if (!this.open) throw new Error('This usage reservation was already closed.')
    const subscription = await neonSubscriptionsRepository.finalizeTextUsage({
      userId: this.userId,
      walletType: this.walletType,
      reservedTokens: this.reservedTokens,
      actualTokens: event.usage.totalTokens,
    })
    this.open = false
    return recordTextUsageEvent({ subscriptionId: subscription.id, event })
  }

  /** Gives the claim back. Does nothing once settled. */
  async release(): Promise<void> {
    if (!this.open) return
    this.open = false
    await neonSubscriptionsRepository.releaseTextUsage({
      userId: this.userId,
      walletType: this.walletType,
      reservedTokens: this.reservedTokens,
    })
  }
}
