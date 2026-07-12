import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TOTAL_INPUT_TOKENS,
  MAX_MESSAGE_TOKENS,
  MAX_RECENT_MESSAGES,
  MIN_RECENT_MESSAGE_TOKENS,
  computeMessageSelectionBudget,
  estimateBlockTokens,
} from '@/lib/context/token-budget'

const CHARS_PER_TOKEN = 4

describe('context engine — token governor', () => {
  it('sums block tokens (~len/4) and ignores empty blocks', () => {
    // 400 chars => 100 tokens; 8 chars => 2 tokens; null/undefined ignored.
    expect(
      estimateBlockTokens(['a'.repeat(400), undefined, 'bbbbbbbb', null, ''])
    ).toBe(102)
  })

  it('gives the message window the remainder after context blocks', () => {
    const budget = computeMessageSelectionBudget({
      contextBlockTexts: ['a'.repeat(400)], // 100 tokens
      totalBudgetTokens: 5_000,
    })
    // 5000 - 100 = 4900 tokens for messages.
    expect(budget.maxTotalChars).toBe(4_900 * CHARS_PER_TOKEN)
    expect(budget.maxMessageChars).toBe(MAX_MESSAGE_TOKENS * CHARS_PER_TOKEN)
    expect(budget.maxMessages).toBe(MAX_RECENT_MESSAGES)
  })

  it('never squeezes the message window below the floor', () => {
    const budget = computeMessageSelectionBudget({
      contextBlockTexts: ['a'.repeat(8_000)], // 2000 tokens, exceeds the budget
      totalBudgetTokens: 1_000,
    })
    expect(budget.maxTotalChars).toBe(MIN_RECENT_MESSAGE_TOKENS * CHARS_PER_TOKEN)
  })

  it('defaults to the module input-token budget when none is passed', () => {
    const budget = computeMessageSelectionBudget({ contextBlockTexts: [] })
    expect(budget.maxTotalChars).toBe(DEFAULT_TOTAL_INPUT_TOKENS * CHARS_PER_TOKEN)
  })
})
