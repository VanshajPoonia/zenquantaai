import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  findOrCreateClientRun: vi.fn(),
  reserveAgentStep: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/api-token', () => ({
  requireApiTokenUser: vi.fn(async () => ({ user: { id: 'user-a', role: 'admin' }, tokenId: 'token-1' })),
}))
vi.mock('@/lib/security/rate-limit', () => ({ hitRateLimit: vi.fn(async () => true) }))
vi.mock('@/lib/db/repositories', () => ({
  neonAgentRunsRepository: { findOrCreateClientRun: mocks.findOrCreateClientRun },
  neonSubscriptionsRepository: {
    ensureForUser: vi.fn(async () => ({ tier: 'free', status: 'active' })),
    reserveAgentStep: mocks.reserveAgentStep,
  },
  neonUsageLimitOverridesRepository: { getByUserId: vi.fn(async () => null) },
}))
vi.mock('@/lib/billing/enforce', () => ({
  getEffectiveSubscription: () => ({ coreTokensIncluded: 1_000_000, tierTokensIncluded: 0 }),
}))

import { serverRunKey, stepsSinceLastUserMessage } from '@/lib/agent/model-api-runs'
import { POST as completions } from '@/app/api/v1/chat/completions/route'

function agentHistory(steps: number) {
  const messages: Array<Record<string, unknown>> = [
    { role: 'system', content: 'You are Forge.' },
    { role: 'user', content: 'Fix the failing test.' },
  ]
  for (let step = 0; step < steps; step += 1) {
    messages.push({ role: 'assistant', content: '', tool_calls: [{ id: `c${step}`, type: 'function' }] })
    messages.push({ role: 'tool', tool_call_id: `c${step}`, content: 'ok' })
  }
  return messages
}

describe('Model API runs', () => {
  it('counts the steps since the last user message', () => {
    expect(stepsSinceLastUserMessage(agentHistory(0))).toBe(0)
    expect(stepsSinceLastUserMessage(agentHistory(3))).toBe(3)
    expect(
      stepsSinceLastUserMessage([...agentHistory(3), { role: 'user', content: 'Now the docs.' }])
    ).toBe(0)
  })

  it('keeps the same run across steps and starts a new one on a new prompt', () => {
    const first = serverRunKey('user-a', 's1', agentHistory(1))
    expect(serverRunKey('user-a', 's1', agentHistory(5))).toBe(first)
    expect(serverRunKey('user-b', 's1', agentHistory(1))).not.toBe(first)
    expect(
      serverRunKey('user-a', 's1', [...agentHistory(2), { role: 'user', content: 'Next.' }])
    ).not.toBe(first)
  })
})

describe('Model API step cap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('OPENROUTER_API_KEY', 'test-key')
    mocks.findOrCreateClientRun.mockResolvedValue({ id: 'run-1', stepCount: 0 })
  })

  it('stops a long run even when the client sends a fresh run id', async () => {
    const response = await completions(
      new NextRequest('http://localhost/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-zq-run-id': 'brand-new-run' },
        body: JSON.stringify({ model: 'forge', messages: agentHistory(15) }),
      })
    )

    expect(response.status).toBe(429)
    expect((await response.json()).error.code).toBe('step_limit')
    expect(mocks.findOrCreateClientRun).toHaveBeenCalledWith(
      expect.objectContaining({ clientRunId: expect.stringMatching(/^srv-/) })
    )
    expect(mocks.reserveAgentStep).not.toHaveBeenCalled()
  })
})
