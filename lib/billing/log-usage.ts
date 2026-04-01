import {
  ImageGenerationEvent,
  Subscription,
  UsageEstimate,
  UsageEvent,
} from '@/types'
import { subscriptionsStore } from '@/lib/storage/subscriptions'
import { imageGenerationEventsStore, usageEventsStore } from '@/lib/storage/usage-events'

export async function logTextUsage(input: {
  subscription: Subscription
  event: {
    userId: string
    conversationId?: string | null
    messageId?: string | null
    assistantFamily: UsageEvent['assistantFamily']
    mode: UsageEvent['mode']
    model: string
    walletType: UsageEvent['walletType']
    usage: UsageEstimate
  }
}): Promise<UsageEvent> {
  const subscription = await subscriptionsStore.updateManual(input.subscription.userId, {
    ...(input.event.usage.walletType === 'tier_tokens'
      ? {
          tierTokensUsed:
            input.subscription.tierTokensUsed + input.event.usage.totalTokens,
        }
      : {
          coreTokensUsed:
            input.subscription.coreTokensUsed + input.event.usage.totalTokens,
        }),
    dailyMessageCount: input.subscription.dailyMessageCount + 1,
  })

  return await usageEventsStore.create({
    userId: input.event.userId,
    subscriptionId: subscription.id,
    conversationId: input.event.conversationId,
    messageId: input.event.messageId,
    assistantFamily: input.event.assistantFamily,
    mode: input.event.mode,
    model: input.event.model,
    walletType: input.event.walletType,
    promptTokens: input.event.usage.promptTokens,
    completionTokens: input.event.usage.completionTokens,
    totalTokens: input.event.usage.totalTokens,
    rawCostUsd: input.event.usage.rawCostUsd,
    displayedCostUsd: input.event.usage.displayedCostUsd,
    displayMultiplier: input.event.usage.displayMultiplier,
    marginUsd: input.event.usage.marginUsd,
    creditsConsumed: input.event.usage.creditsConsumed ?? 0,
  })
}

export async function logImageUsage(input: {
  subscription: Subscription
  event: Omit<ImageGenerationEvent, 'id' | 'createdAt' | 'subscriptionId'>
}): Promise<ImageGenerationEvent> {
  const subscription = await subscriptionsStore.updateManual(input.subscription.userId, {
    imageCreditsUsed:
      input.subscription.imageCreditsUsed + input.event.imageCreditsConsumed,
    dailyImageCount: input.subscription.dailyImageCount + input.event.imageCount,
  })

  return await imageGenerationEventsStore.create({
    ...input.event,
    subscriptionId: subscription.id,
  })
}
