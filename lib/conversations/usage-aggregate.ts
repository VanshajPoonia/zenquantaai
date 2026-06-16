import { UsageEstimate } from '@/types'

export interface ConversationUsageAggregateRow {
  promptTokens: number | string | null
  completionTokens: number | string | null
  totalTokens: number | string | null
  rawCostUsd: number | string | null
  displayedCostUsd: number | string | null
  estimatedCostUsd: number | string | null
  displayMultiplier: number | string | null
  marginUsd: number | string | null
  creditsConsumed: number | string | null
  imageCount: number | string | null
}

function toFiniteNumber(
  value: number | string | null | undefined,
  fallback = 0
): number {
  const numeric = typeof value === 'number' ? value : Number(value ?? fallback)
  return Number.isFinite(numeric) ? numeric : fallback
}

export function conversationUsageAggregateToEstimate(
  row: ConversationUsageAggregateRow | null | undefined
): UsageEstimate {
  return {
    promptTokens: Math.trunc(toFiniteNumber(row?.promptTokens)),
    completionTokens: Math.trunc(toFiniteNumber(row?.completionTokens)),
    totalTokens: Math.trunc(toFiniteNumber(row?.totalTokens)),
    rawCostUsd: toFiniteNumber(row?.rawCostUsd),
    displayedCostUsd: toFiniteNumber(row?.displayedCostUsd),
    estimatedCostUsd: toFiniteNumber(row?.estimatedCostUsd),
    displayMultiplier: toFiniteNumber(row?.displayMultiplier, 1),
    marginUsd: toFiniteNumber(row?.marginUsd),
    creditsConsumed: Math.trunc(toFiniteNumber(row?.creditsConsumed)),
    imageCount: Math.trunc(toFiniteNumber(row?.imageCount)),
  }
}
