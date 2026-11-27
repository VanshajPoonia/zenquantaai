import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  findActive: vi.fn(),
  getUser: vi.fn(),
  ensureProfile: vi.fn(),
  hitRateLimit: vi.fn(),
  create: vi.fn(),
  getForToken: vi.fn(),
  closeForToken: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/security/rate-limit', () => ({ hitRateLimit: mocks.hitRateLimit }))
vi.mock('@/lib/db/repositories', () => ({
  neonApiTokensRepository: { findActive: mocks.findActive },
  neonUsersRepository: { get: mocks.getUser },
  neonProfilesRepository: { ensureFromAuthUser: mocks.ensureProfile },
  neonCliApprovalsRepository: {
    create: mocks.create,
    getForToken: mocks.getForToken,
    closeForToken: mocks.closeForToken,
  },
}))

import { POST as create } from '@/app/api/cli/approvals/route'
import { GET as poll, PATCH as close } from '@/app/api/cli/approvals/[id]/route'

const APPROVAL_ID = '6f1c2a54-3b1e-4c47-9a2e-0d5c8e7f9a10'
const params = (id: string) => ({ params: Promise.resolve({ id }) })
const bearer = { authorization: 'Bearer zq_validtoken' }

function request(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  return new NextRequest(`http://localhost${path}`, {
    method: init.method ?? 'GET',
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })
}

const validBody = {
  sessionId: '01a1e55d-b345-76a2',
  tool: 'bash',
  title: 'Run this command?',
  detail: '  npm test -- --watch=false',
}

describe('zq approval routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CLI_APPROVALS', 'on')
    mocks.findActive.mockResolvedValue({ id: 'token-1', userId: 'user-a', scopes: ['cli'] })
    mocks.getUser.mockResolvedValue({ id: 'user-a', loginId: 'ada', email: null, role: 'user' })
    mocks.ensureProfile.mockResolvedValue({ role: 'user' })
    mocks.hitRateLimit.mockResolvedValue(true)
  })
  afterEach(() => vi.unstubAllEnvs())

  it('needs a zq token', async () => {
    const response = await create(request('/api/cli/approvals', { method: 'POST', body: validBody }))
    expect(response.status).toBe(401)
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('ignores a browser session cookie', async () => {
    const response = await create(
      request('/api/cli/approvals', {
        method: 'POST',
        body: validBody,
        headers: { cookie: 'zenquanta-session-token=abc' },
      })
    )
    expect(response.status).toBe(401)
    expect(mocks.findActive).not.toHaveBeenCalled()
  })

  it('stays closed while the flag is off', async () => {
    vi.stubEnv('CLI_APPROVALS', '')
    const response = await create(request('/api/cli/approvals', { method: 'POST', body: validBody, headers: bearer }))
    expect(response.status).toBe(404)
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('limits how many approvals one token creates', async () => {
    mocks.hitRateLimit.mockResolvedValue(false)
    const response = await create(request('/api/cli/approvals', { method: 'POST', body: validBody, headers: bearer }))
    expect(response.status).toBe(429)
    expect(mocks.hitRateLimit).toHaveBeenCalledWith('cli-approval-create:token-1', 120, 3_600)
  })

  it('refuses long text instead of cutting it', async () => {
    for (const body of [
      { ...validBody, detail: 'x'.repeat(4_001) },
      { ...validBody, title: 'x'.repeat(201) },
      { ...validBody, sessionId: '../etc' },
      { ...validBody, tool: 'rm -rf' },
      { ...validBody, detail: '   ' },
    ]) {
      const response = await create(request('/api/cli/approvals', { method: 'POST', body, headers: bearer }))
      expect(response.status).toBe(400)
    }
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('creates an approval with the exact command', async () => {
    mocks.create.mockResolvedValue({ id: APPROVAL_ID, expiresAt: new Date('2026-11-28T10:10:00.000Z') })

    const response = await create(request('/api/cli/approvals', { method: 'POST', body: validBody, headers: bearer }))

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ id: APPROVAL_ID, expiresAt: '2026-11-28T10:10:00.000Z' })
    expect(mocks.create).toHaveBeenCalledWith({
      userId: 'user-a',
      tokenId: 'token-1',
      sessionId: validBody.sessionId,
      tool: 'bash',
      title: 'Run this command?',
      detail: '  npm test -- --watch=false',
    })
  })

  it('polls only approvals made by the same token', async () => {
    mocks.getForToken.mockResolvedValue(null)
    const missing = await poll(request(`/api/cli/approvals/${APPROVAL_ID}`, { headers: bearer }), params(APPROVAL_ID))
    expect(missing.status).toBe(404)
    expect(mocks.getForToken).toHaveBeenCalledWith('user-a', 'token-1', APPROVAL_ID)

    const malformed = await poll(request('/api/cli/approvals/nope', { headers: bearer }), params('nope'))
    expect(malformed.status).toBe(404)
    expect(mocks.getForToken).toHaveBeenCalledTimes(1)
  })

  it('reports the decision to zq', async () => {
    mocks.getForToken.mockResolvedValue({
      id: APPROVAL_ID,
      status: 'approved',
      decidedAt: new Date('2026-11-28T10:01:00.000Z'),
    })
    const response = await poll(request(`/api/cli/approvals/${APPROVAL_ID}`, { headers: bearer }), params(APPROVAL_ID))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      id: APPROVAL_ID,
      status: 'approved',
      decidedAt: '2026-11-28T10:01:00.000Z',
    })
    expect(mocks.hitRateLimit).toHaveBeenCalledWith('cli-approval-poll:token-1', 2_400, 3_600)
  })

  it('lets zq close a pending approval but never approve one', async () => {
    const approve = await close(
      request(`/api/cli/approvals/${APPROVAL_ID}`, { method: 'PATCH', body: { status: 'approved' }, headers: bearer }),
      params(APPROVAL_ID)
    )
    expect(approve.status).toBe(400)

    mocks.closeForToken.mockResolvedValue({ ok: true })
    const closed = await close(
      request(`/api/cli/approvals/${APPROVAL_ID}`, { method: 'PATCH', body: { status: 'answered_locally' }, headers: bearer }),
      params(APPROVAL_ID)
    )
    expect(closed.status).toBe(200)
    expect(mocks.closeForToken).toHaveBeenCalledWith('user-a', 'token-1', APPROVAL_ID, 'answered_locally')
  })

  it('says when the web already answered or the approval is gone', async () => {
    mocks.closeForToken.mockResolvedValueOnce({ ok: false, status: 'denied' })
    const decided = await close(
      request(`/api/cli/approvals/${APPROVAL_ID}`, { method: 'PATCH', body: { status: 'expired' }, headers: bearer }),
      params(APPROVAL_ID)
    )
    expect(decided.status).toBe(409)
    expect((await decided.json()).status).toBe('denied')

    mocks.closeForToken.mockResolvedValueOnce({ ok: false, status: null })
    const gone = await close(
      request(`/api/cli/approvals/${APPROVAL_ID}`, { method: 'PATCH', body: { status: 'expired' }, headers: bearer }),
      params(APPROVAL_ID)
    )
    expect(gone.status).toBe(404)
  })
})
