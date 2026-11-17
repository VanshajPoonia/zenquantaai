import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  reserveTextUsage: vi.fn(),
  finalizeTextUsage: vi.fn(),
  releaseTextUsage: vi.fn(),
  recordTextUsageEvent: vi.fn(),
  generate: vi.fn(),
}))

const usage = {
  promptTokens: 40,
  completionTokens: 10,
  totalTokens: 50,
  rawCostUsd: 0.001,
  displayedCostUsd: 0.002,
  estimatedCostUsd: 0.002,
  displayMultiplier: 2,
  marginUsd: 0.001,
  walletType: 'core_tokens' as const,
}

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db/repositories', () => ({
  neonProfilesRepository: { ensureFromAuthUser: vi.fn() },
  neonSettingsRepository: { get: vi.fn(async () => ({ sessionDefaults: {} })) },
  neonSubscriptionsRepository: {
    ensureForUser: vi.fn(async () => ({ tier: 'free' })),
    reserveTextUsage: mocks.reserveTextUsage,
    finalizeTextUsage: mocks.finalizeTextUsage,
    releaseTextUsage: mocks.releaseTextUsage,
  },
  neonUsageLimitOverridesRepository: { getByUserId: vi.fn(async () => null) },
}))
vi.mock('@/lib/billing/log-usage', () => ({ recordTextUsageEvent: mocks.recordTextUsageEvent }))
vi.mock('@/lib/auth/session', () => ({
  appendAuthCookies: vi.fn(),
  requireAuthenticatedUser: vi.fn(async () => ({ user: { id: 'user-a' }, session: { refreshed: false } })),
}))
vi.mock('@/lib/config', () => ({
  createSessionSettings: () => ({}),
  getAllowedModelsForTier: () => ['test/model'],
  resolveModelConfig: () => ({ model: 'test/model', walletType: 'core_tokens' }),
}))
vi.mock('@/lib/ai/chat', () => ({
  buildPromptTextForUsage: () => 'prompt text',
  clampSessionSettingsMaxTokens: (settings: unknown) => settings,
  generateAssistantStream: mocks.generate,
  prepareConversationForChat: vi.fn(async () => ({ generationConversation: {} })),
  resolveSessionSettings: () => ({ maxTokens: 800, modelOverride: 'auto' }),
}))
vi.mock('@/lib/billing/enforce', () => ({
  enforceTextUsage: vi.fn(),
  getEffectiveSubscription: () => ({
    coreTokensIncluded: 100_000,
    tierTokensIncluded: 0,
    dailyMessageLimit: 50,
    maxOutputTokensPerRequest: 800,
  }),
}))
vi.mock('@/lib/billing/costs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/billing/costs')>()),
  calculateTextUsageEstimate: () => usage,
}))
vi.mock('@/lib/custom-assistants/validation', () => ({
  normalizeCustomAssistantInput: () => ({
    ok: true,
    input: { name: 'Tester', description: '', systemInstructions: 'Be brief.', baseMode: 'general' },
  }),
  buildCustomAssistantSnapshot: () => ({}),
}))

import { TEXT_USAGE_LIMIT_MESSAGE, TextUsageReservation } from '@/lib/billing/text-reservation'
import { POST as testAssistant } from '@/app/api/custom-assistants/test/route'

const effective = { coreTokensIncluded: 100_000, tierTokensIncluded: 0, dailyMessageLimit: 50 }

function testRequest() {
  return new NextRequest('http://localhost/api/custom-assistants/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'Say hi.', assistant: {} }),
  })
}

describe('text usage reservation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.reserveTextUsage.mockResolvedValue({ id: 'sub-1' })
    mocks.finalizeTextUsage.mockResolvedValue({ id: 'sub-1' })
  })

  it('claims the estimate up front and settles to the real usage', async () => {
    const reservation = await TextUsageReservation.reserve({
      userId: 'user-a',
      walletType: 'core_tokens',
      estimatedPromptTokens: 100,
      maxOutputTokens: 800,
      effective,
    })
    expect(mocks.reserveTextUsage).toHaveBeenCalledWith(
      expect.objectContaining({ estimatedTokens: 900, effectiveIncluded: 100_000, effectiveDailyMessageLimit: 50 })
    )

    await reservation.settle({ userId: 'user-a', assistantFamily: 'nova', mode: 'general', model: 'm', walletType: 'core_tokens', usage })
    await reservation.release()

    expect(mocks.finalizeTextUsage).toHaveBeenCalledWith(
      expect.objectContaining({ reservedTokens: 900, actualTokens: 50 })
    )
    expect(mocks.recordTextUsageEvent).toHaveBeenCalledWith(expect.objectContaining({ subscriptionId: 'sub-1' }))
    expect(mocks.releaseTextUsage).not.toHaveBeenCalled()
  })

  it('refuses when the plan has no room left', async () => {
    mocks.reserveTextUsage.mockResolvedValue(null)
    await expect(
      TextUsageReservation.reserve({ userId: 'user-a', walletType: 'tier_tokens', estimatedPromptTokens: 1, maxOutputTokens: 1, effective })
    ).rejects.toThrow(TEXT_USAGE_LIMIT_MESSAGE)
  })

  it('gives the claim back when the model call fails', async () => {
    mocks.generate.mockImplementation(async function* () {
      yield 'partial'
      throw new Error('upstream failed')
    })

    const response = await testAssistant(testRequest())

    expect(response?.status).toBeGreaterThanOrEqual(400)
    expect(mocks.reserveTextUsage).toHaveBeenCalledTimes(1)
    expect(mocks.releaseTextUsage).toHaveBeenCalledTimes(1)
    expect(mocks.finalizeTextUsage).not.toHaveBeenCalled()
  })

  it('settles a finished custom assistant test', async () => {
    mocks.generate.mockImplementation(async function* () {
      yield 'Hi.'
    })

    const response = await testAssistant(testRequest())

    expect(response?.status).toBe(200)
    expect(mocks.finalizeTextUsage).toHaveBeenCalledWith(
      expect.objectContaining({ reservedTokens: expect.any(Number), actualTokens: 50 })
    )
    expect(mocks.releaseTextUsage).not.toHaveBeenCalled()
  })
})
