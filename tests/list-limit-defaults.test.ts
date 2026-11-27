import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { parseLimitParam } from '@/lib/utils/query'

const mocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  list: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/session', () => ({
  appendAuthCookies: vi.fn(),
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}))
vi.mock('@/lib/security/ownership', () => ({
  resolveOwnedProjectScope: vi.fn(async () => ({ ok: true, projectId: null })),
}))
vi.mock('@/lib/db/repositories', () => ({
  neonConversationRepository: { list: mocks.list },
  neonProfilesRepository: { ensureFromAuthUser: vi.fn() },
  neonSettingsRepository: {},
}))

import { GET as listConversations } from '@/app/api/conversations/route'

describe('parseLimitParam', () => {
  it('uses the fallback when the limit is missing or blank', () => {
    expect(parseLimitParam(null, 100, 500)).toBe(100)
    expect(parseLimitParam('', 80, 200)).toBe(80)
    expect(parseLimitParam('  ', 80, 200)).toBe(80)
  })

  it('uses the fallback for values that are not numbers', () => {
    expect(parseLimitParam('abc', 100, 500)).toBe(100)
    expect(parseLimitParam('Infinity', 100, 500)).toBe(100)
  })

  it('keeps real values between 1 and the max', () => {
    expect(parseLimitParam('25', 100, 500)).toBe(25)
    expect(parseLimitParam('7.9', 100, 500)).toBe(7)
    expect(parseLimitParam('0', 100, 500)).toBe(1)
    expect(parseLimitParam('-3', 100, 500)).toBe(1)
    expect(parseLimitParam('9999', 100, 500)).toBe(500)
  })
})

describe('GET /api/conversations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: { id: 'user-a' }, session: {} })
    mocks.list.mockResolvedValue([])
  })

  it('lists 100 chats when the workspace asks without a limit', async () => {
    await listConversations(new NextRequest('http://localhost/api/conversations'))

    expect(mocks.list).toHaveBeenCalledWith('user-a', expect.objectContaining({ limit: 100 }))
  })

  it('still honors an explicit limit', async () => {
    await listConversations(new NextRequest('http://localhost/api/conversations?limit=20'))

    expect(mocks.list).toHaveBeenCalledWith('user-a', expect.objectContaining({ limit: 20 }))
  })
})
