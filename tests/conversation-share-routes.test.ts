import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  appendAuthCookies: vi.fn(),
  ensureFromAuthUser: vi.fn(),
  hitRateLimit: vi.fn(),
  getConversation: vi.fn(),
  listActive: vi.fn(),
  countActive: vi.fn(),
  createShare: vi.fn(),
  revoke: vi.fn(),
  loadSnapshot: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/session', () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
  appendAuthCookies: mocks.appendAuthCookies,
}))
vi.mock('@/lib/security/rate-limit', () => ({ hitRateLimit: mocks.hitRateLimit }))
vi.mock('@/lib/db/repositories', () => ({
  neonProfilesRepository: { ensureFromAuthUser: mocks.ensureFromAuthUser },
  neonConversationRepository: { get: mocks.getConversation },
  neonConversationSharesRepository: {
    listActive: mocks.listActive,
    countActive: mocks.countActive,
    create: mocks.createShare,
    revoke: mocks.revoke,
  },
}))
vi.mock('@/lib/share/conversation-shares', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/share/conversation-shares')>()
  return { ...actual, loadConversationShareSnapshot: mocks.loadSnapshot }
})

import { GET as getShares, POST as postShare } from '@/app/api/conversations/[id]/shares/route'
import { DELETE as deleteShare } from '@/app/api/conversations/[id]/shares/[shareId]/route'

function requireRouteResponse(response: Response | undefined): Response {
  if (!response) throw new Error('Route did not return a response.')
  return response
}

type Context<T> = { params: Promise<T> }
const GET = async (req: NextRequest, ctx: Context<{ id: string }>) =>
  requireRouteResponse(await getShares(req, ctx))
const POST = async (req: NextRequest, ctx: Context<{ id: string }>) =>
  requireRouteResponse(await postShare(req, ctx))
const DELETE = async (req: NextRequest, ctx: Context<{ id: string; shareId: string }>) =>
  requireRouteResponse(await deleteShare(req, ctx))

const SHARE_ID = '3f2b8c1e-5d4a-4f6b-9c2d-1a2b3c4d5e6f'
const userAuth = { user: { id: 'user-a', role: 'user' }, session: { refreshed: false } }
const build = {
  snapshot: { version: 1, title: 'Trip plan', mode: 'general', surface: 'web', messages: [] },
  messageCount: 12,
  redactionCount: 2,
}
const share = {
  id: SHARE_ID,
  conversationId: 'conv-a',
  token: 'T'.repeat(43),
  title: 'Trip plan',
  messageCount: 12,
  redactionCount: 2,
  createdAt: '2026-11-28T10:00:00.000Z',
}

function request(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/conversations/conv-a/shares', {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const params = (id = 'conv-a') => ({ params: Promise.resolve({ id }) })
const shareParams = (id = 'conv-a', shareId = SHARE_ID) => ({
  params: Promise.resolve({ id, shareId }),
})

describe('conversation share routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_CHAT_SHARING = 'true'
    mocks.requireAuthenticatedUser.mockResolvedValue(userAuth)
    mocks.hitRateLimit.mockResolvedValue(true)
    mocks.countActive.mockResolvedValue(0)
    mocks.listActive.mockResolvedValue([share])
    mocks.createShare.mockResolvedValue(share)
    mocks.revoke.mockResolvedValue(true)
    // Only user-a owns conv-a.
    mocks.loadSnapshot.mockImplementation(async (userId: string, id: string) =>
      userId === 'user-a' && id === 'conv-a' ? { ok: true, build } : { ok: false, status: 404 }
    )
    mocks.getConversation.mockImplementation(async (userId: string, id: string) =>
      userId === 'user-a' && id === 'conv-a' ? { id: 'conv-a' } : null
    )
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_CHAT_SHARING
  })

  it('needs a signed-in user for every route', async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({
      response: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }),
    })

    expect((await GET(request('GET'), params())).status).toBe(401)
    expect((await POST(request('POST'), params())).status).toBe(401)
    expect((await DELETE(request('DELETE'), shareParams())).status).toBe(401)
    expect(mocks.loadSnapshot).not.toHaveBeenCalled()
    expect(mocks.createShare).not.toHaveBeenCalled()
    expect(mocks.revoke).not.toHaveBeenCalled()
  })

  it('stays off until the flag is set', async () => {
    delete process.env.NEXT_PUBLIC_CHAT_SHARING

    expect((await GET(request('GET'), params())).status).toBe(404)
    expect((await POST(request('POST'), params())).status).toBe(404)
    expect((await DELETE(request('DELETE'), shareParams())).status).toBe(404)
    expect(mocks.createShare).not.toHaveBeenCalled()
  })

  it('lists live links with a preview of what a new link shows', async () => {
    const response = await GET(request('GET'), params())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      shares: [share],
      preview: { messageCount: 12, redactionCount: 2, blockedReason: null },
    })
    expect(mocks.listActive).toHaveBeenCalledWith('user-a', 'conv-a')
  })

  it('returns the reason when a chat cannot be shared', async () => {
    mocks.loadSnapshot.mockResolvedValue({ ok: false, status: 400, error: 'Too long.' })

    const response = await GET(request('GET'), params())

    expect(await response.json()).toMatchObject({
      preview: { messageCount: 0, redactionCount: 0, blockedReason: 'Too long.' },
    })
  })

  it("answers another user's chat with 404", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({
      user: { id: 'user-b', role: 'user' },
      session: { refreshed: false },
    })

    expect((await GET(request('GET'), params())).status).toBe(404)
    expect((await POST(request('POST'), params())).status).toBe(404)
    expect((await DELETE(request('DELETE'), shareParams())).status).toBe(404)
    expect(mocks.listActive).not.toHaveBeenCalled()
    expect(mocks.createShare).not.toHaveBeenCalled()
    expect(mocks.revoke).not.toHaveBeenCalled()
  })

  it('creates a link from the server snapshot and ignores the body', async () => {
    const response = await POST(
      request('POST', { snapshot: { messages: [{ content: 'forged' }] }, title: 'forged' }),
      params()
    )

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ share })
    expect(mocks.loadSnapshot).toHaveBeenCalledWith('user-a', 'conv-a')
    expect(mocks.createShare).toHaveBeenCalledWith('user-a', 'conv-a', {
      title: 'Trip plan',
      snapshot: build.snapshot,
      messageCount: 12,
      redactionCount: 2,
    })
  })

  it('limits new links per user per hour', async () => {
    mocks.hitRateLimit.mockResolvedValue(false)

    const response = await POST(request('POST'), params())

    expect(response.status).toBe(429)
    expect(mocks.hitRateLimit).toHaveBeenCalledWith('chat-share:user-a', 30, 3_600)
    expect(mocks.createShare).not.toHaveBeenCalled()
  })

  it('caps live links per chat', async () => {
    mocks.countActive.mockResolvedValue(10)

    const response = await POST(request('POST'), params())

    expect(response.status).toBe(409)
    expect(mocks.createShare).not.toHaveBeenCalled()
  })

  it('refuses a chat that cannot be shared', async () => {
    mocks.loadSnapshot.mockResolvedValue({ ok: false, status: 400, error: 'Nothing to share.' })

    const response = await POST(request('POST'), params())

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Nothing to share.' })
    expect(mocks.createShare).not.toHaveBeenCalled()
  })

  it('revokes a link the user owns', async () => {
    const response = await DELETE(request('DELETE'), shareParams())

    expect(response.status).toBe(200)
    expect(mocks.revoke).toHaveBeenCalledWith('user-a', 'conv-a', SHARE_ID)
  })

  it('answers an unknown, foreign or already revoked link with 404', async () => {
    mocks.revoke.mockResolvedValue(false)
    expect((await DELETE(request('DELETE'), shareParams())).status).toBe(404)

    mocks.revoke.mockClear()
    expect((await DELETE(request('DELETE'), shareParams('conv-a', 'not-a-uuid'))).status).toBe(404)
    expect(mocks.revoke).not.toHaveBeenCalled()
  })
})
