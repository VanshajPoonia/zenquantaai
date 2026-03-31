import { Conversation, UsageEstimate } from '@/types'
import { MODEL_ROUTE_CONFIGS } from '@/lib/config'

function estimateTokens(text: string): number {
  if (!text.trim()) return 0
  return Math.max(1, Math.ceil(text.length / 4))
}

export function estimateUsage(input: {
  mode: Conversation['mode']
  promptText: string
  completionText: string
}): UsageEstimate {
  const config = MODEL_ROUTE_CONFIGS[input.mode]
  const promptTokens = estimateTokens(input.promptText)
  const completionTokens = estimateTokens(input.completionText)
  const totalTokens = promptTokens + completionTokens
  const estimatedCostUsd =
    (promptTokens / 1_000_000) * config.inputCostPerMillion +
    (completionTokens / 1_000_000) * config.outputCostPerMillion

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
