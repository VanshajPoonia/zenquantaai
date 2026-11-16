import type { StepUsage } from './types'

export interface OpenRouterUsage {
  prompt_tokens?: number
  completion_tokens?: number
  cost?: number
  prompt_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number }
}

/** OpenRouter's prompt_tokens include cached and cache-write tokens; split them out. */
export function stepUsageFromOpenRouter(usage: OpenRouterUsage): StepUsage {
  const cacheRead = usage.prompt_tokens_details?.cached_tokens ?? 0
  const cacheWrite = usage.prompt_tokens_details?.cache_write_tokens ?? 0
  return {
    inputTokens: Math.max((usage.prompt_tokens ?? 0) - cacheRead - cacheWrite, 0),
    outputTokens: usage.completion_tokens ?? 0,
    cacheReadTokens: cacheRead,
    cacheWriteTokens: cacheWrite,
    rawCostUsd: typeof usage.cost === 'number' ? usage.cost : 0,
    costFromProvider: typeof usage.cost === 'number',
  }
}
