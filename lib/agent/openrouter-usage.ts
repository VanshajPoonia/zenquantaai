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

interface CompletionOutput {
  content?: unknown
  reasoning?: unknown
  tool_calls?: unknown
}

/** Characters of model output in a chat completion or one stream chunk. */
export function completionOutputChars(body: Record<string, unknown>): number {
  if (!Array.isArray(body.choices)) return 0
  let total = 0
  for (const choice of body.choices as Array<{ delta?: CompletionOutput; message?: CompletionOutput }>) {
    const output = choice?.delta ?? choice?.message
    if (!output) continue
    if (typeof output.content === 'string') total += output.content.length
    if (typeof output.reasoning === 'string') total += output.reasoning.length
    const calls = Array.isArray(output.tool_calls) ? output.tool_calls : []
    for (const call of calls as Array<{ function?: { arguments?: unknown } }>) {
      if (typeof call?.function?.arguments === 'string') total += call.function.arguments.length
    }
  }
  return total
}
