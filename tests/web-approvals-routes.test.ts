import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { cliConversationId } from '@/lib/cli/session-sync'

const mocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  hitRateLimit: vi.fn(),
  listPending: vi.fn(),
  latestCliActivity: vi.fn(),
  decide: vi.fn(),
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
vi.mock('@/lib/security/rate-limit', () => ({ hitRateLimit: mocks.hitRateLimit }))
vi.mock('@/lib/db/repositories', () => ({
  neonApiTokensRepository: {},
  neonProfilesRepository: {},
  neonUsersRepository: {},
  neonCliApprovalsRepository: {
    listPending: mocks.listPending,
    latestCliActivity: mocks.latestCliActivity,
    decide: mocks.decide,
  },
}))

import { GET as listRoute } from '@/app/api/approvals/route'
import { POST as decideRoute } from '@/app/api/approvals/[id]/decide/route'

function must<T>(value: T | undefined): T {
  if (!value) throw new Error('The route returned nothing.')
  return value
}

const list = async (...args: Parameters<typeof listRoute>) => must(await listRoute(...args))
const decide = async (...args: Parameters<typeof decideRoute>) => must(await decideRoute(...args))

const APPROVAL_ID = '6f1c2a54-3b1e-4c47-9a2e-0d5c8e7f9a10'
const params = (id: string) => ({ params: Promise.resolve({ id }) })

function request(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  return new NextRequest(`http://localhost${path}`, {
    method: init.method ?? 'GET',
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })
}

const decideRequest = (body: unknown, headers: Record<string, string> = {}) =>
  request(`/api/approvals/${APPROVAL_ID}/decide`, { method: 'POST', body, headers })

async function useRealSession() {
  const actual = await vi.importActual<typeof import('@/lib/auth/session')>('@/lib/auth/session')
  mocks.requireAuthenticatedUser.mockImplementation(actual.requireAuthenticatedUser)
}

describe('web approval routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CLI_APPROVALS', 'on')
    mocks.requireAuthenticatedUser.mockResolvedValue({ user: { id: 'user-a' }, session: {} })
    mocks.hitRateLimit.mockResolvedValue(true)
  })
  afterEach(() => vi.unstubAllEnvs())

  it('needs a signed-in session', async () => {
    await useRealSession()
    expect((await list(request('/api/approvals'))).status).toBe(401)
    expect((await decide(decideRequest({ decision: 'approve' }), params(APPROVAL_ID))).status).toBe(401)
    expect(mocks.decide).not.toHaveBeenCalled()
  })

  it('ignores a zq bearer token', async () => {
    await useRealSession()
    const bearer = { authorization: 'Bearer zq_validtoken' }
    expect((await list(request('/api/approvals', { headers: bearer }))).status).toBe(401)
    expect((await decide(decideRequest({ decision: 'approve' }, bearer), params(APPROVAL_ID))).status).toBe(401)
  })

  it('tells the page to stop when approvals are off', async () => {
    vi.stubEnv('CLI_APPROVALS', 'off')
    const response = await list(request('/api/approvals'))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ enabled: false, approvals: [] })
    expect(mocks.listPending).not.toHaveBeenCalled()
  })

  it('lists pending approvals with the session they belong to', async () => {
    mocks.listPending.mockResolvedValue([
      {
        id: APPROVAL_ID,
        sessionId: 'sess-1',
        tool: 'bash',
        title: 'Run this command?',
        detail: 'rm -rf build',
        status: 'pending',
        createdAt: new Date('2026-11-28T10:00:00.000Z'),
        decidedAt: null,
        expiresAt: new Date('2026-11-28T10:10:00.000Z'),
      },
    ])
    mocks.latestCliActivity.mockResolvedValue(new Date('2026-11-28T09:59:58.000Z'))

    const response = await list(request('/api/approvals'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.listPending).toHaveBeenCalledWith('user-a')
    expect(mocks.hitRateLimit).toHaveBeenCalledWith('approvals-poll:user-a', 1_500, 3_600)
    expect(body.enabled).toBe(true)
    expect(body.latestCliActivityAt).toBe('2026-11-28T09:59:58.000Z')
    expect(body.approvals).toEqual([
      {
        id: APPROVAL_ID,
        conversationId: cliConversationId('user-a', 'sess-1'),
        tool: 'bash',
        title: 'Run this command?',
        detail: 'rm -rf build',
        createdAt: '2026-11-28T10:00:00.000Z',
        expiresAt: '2026-11-28T10:10:00.000Z',
      },
    ])
  })

  it('refuses a decision sent from another site', async () => {
    const response = await decide(
      decideRequest({ decision: 'approve' }, { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' }),
      params(APPROVAL_ID)
    )
    expect(response.status).toBe(403)
    expect(mocks.decide).not.toHaveBeenCalled()
  })

  it('approves once and never always', async () => {
    const always = await decide(decideRequest({ decision: 'always' }), params(APPROVAL_ID))
    expect(always.status).toBe(400)

    mocks.decide.mockResolvedValue({ ok: true })
    const response = await decide(
      decideRequest({ decision: 'approve' }, { origin: 'http://localhost', 'sec-fetch-site': 'same-origin' }),
      params(APPROVAL_ID)
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, status: 'approved' })
    expect(mocks.decide).toHaveBeenCalledWith('user-a', APPROVAL_ID, true)
  })

  it('hides another user approval', async () => {
    mocks.decide.mockResolvedValue({ ok: false, status: null })
    const response = await decide(decideRequest({ decision: 'deny' }), params(APPROVAL_ID))
    expect(response.status).toBe(404)

    const malformed = await decide(decideRequest({ decision: 'deny' }), params('not-a-uuid'))
    expect(malformed.status).toBe(404)
    expect(mocks.decide).toHaveBeenCalledTimes(1)
  })

  it('refuses an expired or already answered approval', async () => {
    mocks.decide.mockResolvedValueOnce({ ok: false, status: 'expired' })
    const expired = await decide(decideRequest({ decision: 'approve' }), params(APPROVAL_ID))
    expect(expired.status).toBe(409)
    expect((await expired.json()).status).toBe('expired')

    mocks.decide.mockResolvedValueOnce({ ok: false, status: 'answered_locally' })
    const answered = await decide(decideRequest({ decision: 'approve' }), params(APPROVAL_ID))
    expect(answered.status).toBe(409)
    expect((await answered.json()).status).toBe('answered_locally')
  })

  it('limits how fast one user decides', async () => {
    mocks.hitRateLimit.mockResolvedValue(false)
    const response = await decide(decideRequest({ decision: 'deny' }), params(APPROVAL_ID))
    expect(response.status).toBe(429)
    expect(mocks.hitRateLimit).toHaveBeenCalledWith('approvals-decide:user-a', 120, 3_600)
  })
})
