import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  hitRateLimit: vi.fn(),
  decide: vi.fn(),
  claim: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/session', () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}))
vi.mock('@/lib/security/rate-limit', () => ({
  getClientIp: () => '203.0.113.7',
  hitRateLimit: mocks.hitRateLimit,
}))
vi.mock('@/lib/db/repositories', () => ({
  normalizeUserCode: (value: string) => value,
  neonDeviceCodesRepository: { decide: mocks.decide, claim: mocks.claim },
  neonApiTokensRepository: {},
  neonUsersRepository: {},
}))

import { POST as approve } from '@/app/api/cli/device/approve/route'
import { POST as token } from '@/app/api/cli/token/route'

function post(path: string, body: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('device login limits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: { id: 'user-a' } })
  })

  it('stops a signed-in user from trying many login codes', async () => {
    mocks.hitRateLimit.mockResolvedValue(false)

    const response = await approve(post('/api/cli/device/approve', { userCode: 'ABCD-EFGH', approve: true }))

    expect(response?.status).toBe(429)
    expect(mocks.hitRateLimit).toHaveBeenCalledWith('cli-approve:user-a', 20, 3_600)
    expect(mocks.decide).not.toHaveBeenCalled()
  })

  it('slows token polling per network before touching the code', async () => {
    mocks.hitRateLimit.mockResolvedValueOnce(false)

    const response = await token(post('/api/cli/token', { device_code: 'some-code' }))

    expect(response.status).toBe(429)
    expect(await response.json()).toEqual({ error: 'slow_down' })
    expect(mocks.hitRateLimit).toHaveBeenCalledWith('cli-token-ip:203.0.113.7', 600, 600)
    expect(mocks.claim).not.toHaveBeenCalled()
  })
})
