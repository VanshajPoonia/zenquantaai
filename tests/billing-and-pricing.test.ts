import { describe, expect, it } from 'vitest'
import { calculateImageUsageEstimate, calculateTextUsageEstimate, estimateTokens, getDisplayedCreditsSnapshot, getRemainingWallets } from '@/lib/billing/costs'
import { buildUsageLimitSnapshot, getPlanRequestStatusLabel, getUpgradeNudgeForError, isNearLimit, isUpgradeTier, sanitizePlanRequestAdminNote } from '@/lib/billing/upgrade-nudges'
import { MODEL_PRICING_CONFIG, usdToDisplayedCredits } from '@/lib/config/pricing'
import { Subscription } from '@/types'

function subscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub_1',
    userId: 'user_1',
    tier: 'pro',
    status: 'active',
    displayMultiplier: 1.5,
    planPriceUsd: 15,
    coreTokensIncluded: 100,
    coreTokensUsed: 25,
    tierTokensIncluded: 50,
    tierTokensUsed: 60,
    imageCreditsIncluded: 20,
    imageCreditsUsed: 5,
    dailyMessageLimit: 10,
    dailyMessageCount: 2,
    maxInputTokensPerRequest: 32000,
    maxOutputTokensPerRequest: 2500,
    maxImagesPerDay: 5,
    dailyImageCount: 1,
    currentPeriodStartedAt: '2026-06-01T00:00:00.000Z',
    currentPeriodEndsAt: '2026-07-01T00:00:00.000Z',
    lastDailyResetAt: '2026-06-03T00:00:00.000Z',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-03T00:00:00.000Z',
    ...overrides,
  }
}

describe('billing and pricing pure helpers', () => {
  it('estimates tokens from text length', () => {
    expect(estimateTokens('')).toBe(0)
    expect(estimateTokens('abcd')).toBe(1)
    expect(estimateTokens('abcde')).toBe(2)
  })

  it('calculates text usage display fields without external calls', () => {
    const estimate = calculateTextUsageEstimate({
      tier: 'free',
      walletType: 'core_tokens',
      model: 'google/gemini-2.5-flash',
      promptText: 'abcd',
      completionText: 'abcdefgh',
    })

    expect(estimate.promptTokens).toBe(1)
    expect(estimate.completionTokens).toBe(2)
    expect(estimate.totalTokens).toBe(3)
    expect(estimate.displayMultiplier).toBe(2)
    expect(estimate.displayedCostUsd).toBeCloseTo(estimate.rawCostUsd * 2)
    expect(estimate.walletType).toBe('core_tokens')
  })

  it('calculates image usage from configured image credits', () => {
    const pricing = MODEL_PRICING_CONFIG.imageModels['google/gemini-2.5-flash-image']
    const modelConfig = {
      family: 'prism' as const,
      tier: 'free' as const,
      displayName: 'Prism',
      model: 'google/gemini-2.5-flash-image',
      ...pricing,
    }
    const estimate = calculateImageUsageEstimate({
      tier: 'free',
      modelConfig,
      imageCount: 2,
    })

    expect(estimate.rawCostUsd).toBeCloseTo(0.07)
    expect(estimate.displayedCostUsd).toBeCloseTo(0.14)
    expect(estimate.creditsConsumed).toBe(20)
    expect(estimate.walletType).toBe('image_credits')
  })

  it('clamps remaining wallets at zero', () => {
    expect(getRemainingWallets(subscription())).toEqual({
      coreTokens: 75,
      tierTokens: 0,
      imageCredits: 15,
    })
  })

  it('converts plan display budget into displayed credits', () => {
    expect(getDisplayedCreditsSnapshot(subscription()).totalDisplayedCredits).toBe(
      usdToDisplayedCredits(22.5)
    )
  })

  it('builds near-limit snapshots and upgrade nudge labels', () => {
    const near = buildUsageLimitSnapshot(8, 10)
    const notNear = buildUsageLimitSnapshot(3, 10)

    expect(near).toMatchObject({ used: 8, limit: 10, remaining: 2, ratio: 0.8 })
    expect(isNearLimit(near)).toBe(true)
    expect(isNearLimit(notNear)).toBe(false)
    expect(getUpgradeNudgeForError('Daily image limit reached')?.title).toBe(
      'Image limit reached'
    )
    expect(getPlanRequestStatusLabel('activated')).toBe('Activated')
    expect(isUpgradeTier('basic', 'pro')).toBe(true)
    expect(isUpgradeTier('ultra', 'basic')).toBe(false)
  })

  it('sanitizes long admin notes before user display', () => {
    expect(sanitizePlanRequestAdminNote('  safe note  ')).toBe('safe note')
    expect(sanitizePlanRequestAdminNote('x'.repeat(300))).toHaveLength(280)
  })
})
