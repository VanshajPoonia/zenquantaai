import { Conversation, ModelRouteConfig, UsageEstimate } from '@/types'
import { calculateTextUsageEstimate, estimateTokens } from '@/lib/billing/costs'

export function estimateUsage(input: {
  config: Pick<ModelRouteConfig, 'model' | 'walletType'>
  promptText: string
  completionText: string
}): UsageEstimate {
  return calculateTextUsageEstimate({
    tier: 'free',
    walletType: input.config.walletType,
    model: input.config.model,
    promptText: input.promptText,
    completionText: input.completionText,
  })
}

export function estimatePromptTokens(text: string): number {
  return estimateTokens(text)
}

export function sumConversationUsage(conversation: Conversation): UsageEstimate {
  return conversation.messages.reduce<UsageEstimate>(
    (totals, message) => {
      if (!message.usage) return totals

      return {
        promptTokens: totals.promptTokens + message.usage.promptTokens,
        completionTokens: totals.completionTokens + message.usage.completionTokens,
        totalTokens: totals.totalTokens + message.usage.totalTokens,
        rawCostUsd: totals.rawCostUsd + message.usage.rawCostUsd,
        displayedCostUsd:
          totals.displayedCostUsd + message.usage.displayedCostUsd,
        estimatedCostUsd:
          totals.estimatedCostUsd + message.usage.estimatedCostUsd,
        displayMultiplier: message.usage.displayMultiplier,
        marginUsd: totals.marginUsd + message.usage.marginUsd,
        creditsConsumed:
          (totals.creditsConsumed ?? 0) + (message.usage.creditsConsumed ?? 0),
      }
    },
    {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      rawCostUsd: 0,
      displayedCostUsd: 0,
      estimatedCostUsd: 0,
      displayMultiplier: 1,
      marginUsd: 0,
      creditsConsumed: 0,
    }
  )
}

export function sumUsageEstimates(
  usages: Array<UsageEstimate | undefined>
): UsageEstimate {
  return usages.reduce<UsageEstimate>(
    (totals, usage) => {
      if (!usage) return totals

      return {
        promptTokens: totals.promptTokens + usage.promptTokens,
        completionTokens: totals.completionTokens + usage.completionTokens,
        totalTokens: totals.totalTokens + usage.totalTokens,
        rawCostUsd: totals.rawCostUsd + usage.rawCostUsd,
        displayedCostUsd: totals.displayedCostUsd + usage.displayedCostUsd,
        estimatedCostUsd: totals.estimatedCostUsd + usage.estimatedCostUsd,
        displayMultiplier: usage.displayMultiplier,
        marginUsd: totals.marginUsd + usage.marginUsd,
        creditsConsumed:
          (totals.creditsConsumed ?? 0) + (usage.creditsConsumed ?? 0),
      }
    },
    {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      rawCostUsd: 0,
      displayedCostUsd: 0,
      estimatedCostUsd: 0,
      displayMultiplier: 1,
      marginUsd: 0,
      creditsConsumed: 0,
    }
  )
}

export function formatEstimatedCostUsd(value: number): string {
  if (value <= 0) return '$0.00'
  if (value < 0.01) return '<$0.01'
  if (value < 100) return `$${value.toFixed(2)}`

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}
