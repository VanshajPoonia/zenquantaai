import { Conversation, ModelRouteConfig, UsageEstimate } from '@/types'

function estimateTokens(text: string): number {
  if (!text.trim()) return 0
  return Math.max(1, Math.ceil(text.length / 4))
}

export function estimateUsage(input: {
  config: ModelRouteConfig
  promptText: string
  completionText: string
}): UsageEstimate {
  const promptTokens = estimateTokens(input.promptText)
  const completionTokens = estimateTokens(input.completionText)
  const totalTokens = promptTokens + completionTokens
  const estimatedCostUsd =
    (promptTokens / 1_000_000) * input.config.inputCostPerMillion +
    (completionTokens / 1_000_000) * input.config.outputCostPerMillion

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCostUsd,
  }
}

export function sumConversationUsage(conversation: Conversation): UsageEstimate {
  return conversation.messages.reduce<UsageEstimate>(
    (totals, message) => {
      if (!message.usage) return totals

      return {
        promptTokens: totals.promptTokens + message.usage.promptTokens,
        completionTokens: totals.completionTokens + message.usage.completionTokens,
        totalTokens: totals.totalTokens + message.usage.totalTokens,
        estimatedCostUsd:
          totals.estimatedCostUsd + message.usage.estimatedCostUsd,
      }
    },
    {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
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
        estimatedCostUsd: totals.estimatedCostUsd + usage.estimatedCostUsd,
      }
    },
    {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
    }
  )
}

export function formatEstimatedCostUsd(value: number): string {
  if (value <= 0) return '$0.00'
  if (value < 0.01) return '<$0.01'
  if (value < 1) return `$${value.toFixed(2)}`
  if (value < 100) return `$${value.toFixed(2)}`

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}
