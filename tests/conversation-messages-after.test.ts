import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  listMessagesAfter: vi.fn(),
  listMessagesPage: vi.fn(),
  ensureFromAuthUser: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db/client', () => ({
  getDatabaseClient: () => {
    throw new Error('No database in tests.')
  },
  getNeonSql: () => {
    throw new Error('No database in tests.')
  },
}))
vi.mock('@/lib/auth/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/session')>()
  return { ...actual, requireAuthenticatedUser: mocks.requireAuthenticatedUser }
})
vi.mock('@/lib/db/repositories', () => ({
  neonConversationRepository: {
    listMessagesAfter: mocks.listMessagesAfter,
    listMessagesPage: mocks.listMessagesPage,
  },
  neonProfilesRepository: { ensureFromAuthUser: mocks.ensureFromAuthUser },
  neonApiTokensRepository: {},
  neonUsersRepository: {},
}))

import { GET } from '@/app/api/conversations/[id]/messages/route'

const params = (id: string) => ({ params: Promise.resolve({ id }) })

function get(query: string, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost/api/conversations/cli-abc/messages${query}`, { headers })
}

describe('conversation messages after a cursor', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: { id: 'user-a' }, session: {} })
  })

  it('needs a signed-in session', async () => {
    const actual = await vi.importActual<typeof import('@/lib/auth/session')>('@/lib/auth/session')
    mocks.requireAuthenticatedUser.mockImplementation(actual.requireAuthenticatedUser)

    const response = await GET(get('?after=2026-11-28T10:00:00.000Z'), params('cli-abc'))

    expect(response?.status).toBe(401)
    expect(mocks.listMessagesAfter).not.toHaveBeenCalled()
  })

  it('ignores a zq bearer token', async () => {
    const actual = await vi.importActual<typeof import('@/lib/auth/session')>('@/lib/auth/session')
    mocks.requireAuthenticatedUser.mockImplementation(actual.requireAuthenticatedUser)

    const response = await GET(
      get('?after=2026-11-28T10:00:00.000Z', { authorization: 'Bearer zq_abcdefgh' }),
      params('cli-abc')
    )

    expect(response?.status).toBe(401)
  })

  it('returns messages at or after the cursor for the owner', async () => {
    const page = {
      conversationId: 'cli-abc',
      messages: [],
      hasMoreAfter: false,
      updatedAt: '2026-11-28T10:00:05.000Z',
      serverNow: '2026-11-28T10:00:06.000Z',
    }
    mocks.listMessagesAfter.mockResolvedValue(page)

    const response = await GET(get('?after=2026-11-28T10:00:00.000Z&limit=20'), params('cli-abc'))

    expect(response?.status).toBe(200)
    expect(await response?.json()).toEqual(page)
    expect(mocks.listMessagesAfter).toHaveBeenCalledWith('user-a', 'cli-abc', {
      after: new Date('2026-11-28T10:00:00.000Z'),
      limit: 20,
    })
    expect(mocks.listMessagesPage).not.toHaveBeenCalled()
    expect(mocks.ensureFromAuthUser).not.toHaveBeenCalled()
  })

  it('hides another user conversation', async () => {
    mocks.listMessagesAfter.mockResolvedValue(null)

    const response = await GET(get('?after=2026-11-28T10:00:00.000Z'), params('cli-other'))

    expect(response?.status).toBe(404)
  })

  it('falls back to the normal page without a valid cursor', async () => {
    mocks.listMessagesPage.mockResolvedValue({
      conversationId: 'cli-abc',
      messages: [],
      hasMoreBefore: false,
      nextBefore: null,
    })

    const response = await GET(get('?after=not-a-date'), params('cli-abc'))

    expect(response?.status).toBe(200)
    expect(mocks.listMessagesAfter).not.toHaveBeenCalled()
    expect(mocks.listMessagesPage).toHaveBeenCalledWith('user-a', 'cli-abc', { limit: 80, before: null })
    expect(mocks.ensureFromAuthUser).toHaveBeenCalled()
  })
})
