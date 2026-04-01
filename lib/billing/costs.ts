import {
  AssistantFamily,
  ImageModelConfig,
  Subscription,
  SubscriptionTier,
  UsageEstimate,
  UsageWallet,
} from '@/types'
import { DISPLAY_MULTIPLIERS, MODEL_PRICING_CONFIG, usdToDisplayedCredits } from '@/lib/config'

export function estimateTokens(text: string): number {
  if (!text.trim()) return 0
  return Math.max(1, Math.ceil(text.length / 4))
}

export function resolveDisplayMultiplier(tier: SubscriptionTier): number {
  return DISPLAY_MULTIPLIERS[tier]
}

export function calculateTextUsageEstimate(input: {
  tier: SubscriptionTier
  walletType: UsageWallet
  model: string
  promptText: string
  completionText: string
}): UsageEstimate {
  const promptTokens = estimateTokens(input.promptText)
  const completionTokens = estimateTokens(input.completionText)
  const totalTokens = promptTokens + completionTokens
  const pricing = MODEL_PRICING_CONFIG.textModels[input.model]
  const rawCostUsd =
    (promptTokens / 1_000_000) * (pricing?.inputCostPerMillion ?? 0) +
    (completionTokens / 1_000_000) * (pricing?.outputCostPerMillion ?? 0)
  const displayMultiplier = resolveDisplayMultiplier(input.tier)
  const displayedCostUsd = rawCostUsd * displayMultiplier

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    rawCostUsd,
    displayedCostUsd,
    estimatedCostUsd: displayedCostUsd,
    displayMultiplier,
    marginUsd: displayedCostUsd - rawCostUsd,
    walletType: input.walletType,
    creditsConsumed: usdToDisplayedCredits(displayedCostUsd),
  }
}

export function calculateImageUsageEstimate(input: {
  tier: SubscriptionTier
  modelConfig: ImageModelConfig
  imageCount: number
  providerRawCostUsd?: number | null
}): UsageEstimate {
  const rawCostUsd =
    input.providerRawCostUsd ??
    input.modelConfig.rawCostPerImageUsd * input.imageCount
  const displayMultiplier = resolveDisplayMultiplier(input.tier)
  const displayedCostUsd = rawCostUsd * displayMultiplier

  return {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    rawCostUsd,
    displayedCostUsd,
    estimatedCostUsd: displayedCostUsd,
    displayMultiplier,
    marginUsd: displayedCostUsd - rawCostUsd,
    walletType: 'image_credits',
    creditsConsumed:
      input.modelConfig.defaultImageCreditsPerImage * input.imageCount,
    imageCount: input.imageCount,
  }
}

export function getRemainingWallets(subscription: Subscription) {
  return {
    coreTokens: Math.max(
      0,
      subscription.coreTokensIncluded - subscription.coreTokensUsed
    ),
    tierTokens: Math.max(
      0,
      subscription.tierTokensIncluded - subscription.tierTokensUsed
    ),
    imageCredits: Math.max(
      0,
      subscription.imageCreditsIncluded - subscription.imageCreditsUsed
    ),
  }
}

export function getDisplayedCreditsSnapshot(subscription: Subscription) {
  const totalDisplayedUsdBudget =
    subscription.planPriceUsd * subscription.displayMultiplier
  const totalDisplayedCredits = usdToDisplayedCredits(totalDisplayedUsdBudget)

  return {
    totalDisplayedCredits,
  }
}

export function getAssistantUsageBreakdown(input: {
  textEvents: Array<{ assistantFamily: AssistantFamily; displayedCostUsd: number }>
  imageEvents: Array<{ assistantFamily: AssistantFamily; displayedCostUsd: number; imageCount: number }>
}) {
  const breakdown = new Map<
    AssistantFamily,
    { family: AssistantFamily; events: number; displayedCostUsd: number }
  >()

  for (const event of input.textEvents) {
    const current = breakdown.get(event.assistantFamily) ?? {
      family: event.assistantFamily,
      events: 0,
      displayedCostUsd: 0,
    }
    current.events += 1
    current.displayedCostUsd += event.displayedCostUsd
    breakdown.set(event.assistantFamily, current)
  }

  for (const event of input.imageEvents) {
    const current = breakdown.get(event.assistantFamily) ?? {
      family: event.assistantFamily,
      events: 0,
      displayedCostUsd: 0,
    }
    current.events += event.imageCount
    current.displayedCostUsd += event.displayedCostUsd
    breakdown.set(event.assistantFamily, current)
  }

  return [...breakdown.values()].sort(
    (a, b) => b.displayedCostUsd - a.displayedCostUsd
  )
}
