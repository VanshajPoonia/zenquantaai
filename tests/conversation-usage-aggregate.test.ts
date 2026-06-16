import { describe, expect, it } from 'vitest'
import { conversationUsageAggregateToEstimate } from '@/lib/conversations/usage-aggregate'

describe('conversation usage aggregate helpers', () => {
  it('maps database aggregate rows to the existing usage estimate shape', () => {
    expect(
      conversationUsageAggregateToEstimate({
        promptTokens: '10',
        completionTokens: 5,
        totalTokens: '15',
        rawCostUsd: '0.001',
        displayedCostUsd: '0.003',
        estimatedCostUsd: '0.003',
        displayMultiplier: '3',
        marginUsd: '0.002',
        creditsConsumed: '2',
        imageCount: null,
      })
    ).toEqual({
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
      rawCostUsd: 0.001,
      displayedCostUsd: 0.003,
      estimatedCostUsd: 0.003,
      displayMultiplier: 3,
      marginUsd: 0.002,
      creditsConsumed: 2,
      imageCount: 0,
    })
  })

  it('returns zeroed usage defaults for empty conversations', () => {
    expect(conversationUsageAggregateToEstimate(null)).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      rawCostUsd: 0,
      displayedCostUsd: 0,
      estimatedCostUsd: 0,
      displayMultiplier: 1,
      marginUsd: 0,
      creditsConsumed: 0,
      imageCount: 0,
    })
  })
})
