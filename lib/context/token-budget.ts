import { estimatePromptTokens } from '@/lib/utils/cost'

// Context Engine Phase 2 — the token governor. Owns how many tokens the recent
// verbatim messages may consume, given how much the fixed context blocks
// (system prompt, memory, web search, file knowledge) already cost. Blocks
// degrade gracefully: a large memory/RAG payload squeezes the message window,
// but never below MIN_RECENT_MESSAGE_TOKENS. See AI_CONTEXT_ENGINE.md §4.3.
//
// Pure + framework-free so it is unit-testable and consistent between the
// generation path and the usage-estimation path (both go through
// buildOpenRouterMessages, so they share one budget).

const CHARS_PER_TOKEN = 4

// Total input-token budget for a request's prompt (excluding the model's output
// reservation). Deliberately not tier-aware yet — a single conservative ceiling
// keeps generation and billing estimation identical without threading tier
// through every buildPromptTextForUsage caller. Tier-scaling is a documented
// follow-up.
export const DEFAULT_TOTAL_INPUT_TOKENS = 8_000

// Recent turns always keep at least this much room, even when context blocks are
// large, so a conversation never loses its immediate thread.
export const MIN_RECENT_MESSAGE_TOKENS = 1_500

// Per-message ceiling before truncation, so one huge pasted message cannot eat
// the entire window.
export const MAX_MESSAGE_TOKENS = 1_500

// Hard cap on how many recent messages to consider, independent of size.
export const MAX_RECENT_MESSAGES = 40

export interface MessageSelectionBudget {
  maxMessages: number
  maxMessageChars: number
  maxTotalChars: number
}

export function estimateBlockTokens(texts: Array<string | undefined | null>): number {
  return texts.reduce<number>(
    (sum, text) => (text ? sum + estimatePromptTokens(text) : sum),
    0
  )
}

/**
 * Given the fixed context blocks already allocated for this request, compute the
 * budget left for recent verbatim messages, expressed in the char-based shape
 * that `selectBoundedContextMessages` (lib/ai/memory.ts) consumes. Reusing that
 * already-tested selector keeps the "always include the latest user message +
 * truncate oversized messages" semantics in one place.
 */
export function computeMessageSelectionBudget(input: {
  contextBlockTexts: Array<string | undefined | null>
  totalBudgetTokens?: number
}): MessageSelectionBudget {
  const totalBudget = input.totalBudgetTokens ?? DEFAULT_TOTAL_INPUT_TOKENS
  const contextTokens = estimateBlockTokens(input.contextBlockTexts)
  const messageTokens = Math.max(
    MIN_RECENT_MESSAGE_TOKENS,
    totalBudget - contextTokens
  )

  return {
    maxMessages: MAX_RECENT_MESSAGES,
    maxMessageChars: MAX_MESSAGE_TOKENS * CHARS_PER_TOKEN,
    maxTotalChars: messageTokens * CHARS_PER_TOKEN,
  }
}
