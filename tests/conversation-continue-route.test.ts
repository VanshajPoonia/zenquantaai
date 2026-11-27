import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import type { Conversation } from '@/types'

const mocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  getConversation: vi.fn(),
  createContinuation: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/session', () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
  appendAuthCookies: vi.fn(),
}))
vi.mock('@/lib/db/repositories', () => ({
  neonProfilesRepository: { ensureFromAuthUser: vi.fn() },
  neonConversationRepository: {
    get: mocks.getConversation,
    createContinuation: mocks.createContinuation,
  },
}))

import { POST } from '@/app/api/conversations/[id]/continue/route'

const userAuth = {
  user: { id: 'user-a', loginId: 'alpha', email: null, role: 'user' },
  session: { refreshed: false },
}

const legacySummary = [
  'Conversation goal:',
  '- Plan the bakery launch',
  '',
  'Decisions made:',
  '- Open on 5 December',
].join('\n')

function sourceConversation(patch: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-a',
    title: 'Bakery launch',
    mode: 'general',
    projectId: 'proj-a',
    createdAt: '2026-11-27T00:00:00.000Z',
    updatedAt: '2026-11-27T00:00:00.000Z',
    isPinned: false,
    preview: '',
    messageCount: 12,
    sessionSettings: {} as Conversation['sessionSettings'],
    messages: [],
    memorySummary: legacySummary,
    memorySummaryStructured: null,
    ...patch,
  }
}

async function continueChat(id: string): Promise<Response> {
  const response = await POST(
    new NextRequest(`http://localhost/api/conversations/${id}/continue`, { method: 'POST' }),
    { params: Promise.resolve({ id }) }
  )
  if (!response) throw new Error('Route did not return a response.')
  return response
}

describe('POST /api/conversations/[id]/continue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthenticatedUser.mockResolvedValue(userAuth)
    mocks.getConversation.mockImplementation(async (userId: string, id: string) =>
      userId === 'user-a' && id === 'conv-a' ? sourceConversation() : null
    )
    mocks.createContinuation.mockResolvedValue({
      id: 'conv-new',
      continuedFrom: { conversationId: 'conv-a', title: 'Bakery launch' },
    })
  })

  it('returns 401 when signed out', async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    })

    const response = await continueChat('conv-a')

    expect(response.status).toBe(401)
    expect(mocks.getConversation).not.toHaveBeenCalled()
  })

  it('returns 404 for another user chat', async () => {
    const response = await continueChat('conv-b')

    expect(response.status).toBe(404)
    expect(mocks.getConversation).toHaveBeenCalledWith('user-a', 'conv-b', { messageLimit: 1 })
    expect(mocks.createContinuation).not.toHaveBeenCalled()
  })

  it('refuses a chat without a summary', async () => {
    mocks.getConversation.mockResolvedValue(sourceConversation({ memorySummary: '  ' }))

    const response = await continueChat('conv-a')

    expect(response.status).toBe(400)
    expect(mocks.createContinuation).not.toHaveBeenCalled()
  })

  it('refuses a terminal session', async () => {
    mocks.getConversation.mockResolvedValue(sourceConversation({ surface: 'cli' }))

    expect((await continueChat('conv-a')).status).toBe(400)
    expect(mocks.createContinuation).not.toHaveBeenCalled()
  })

  it('creates the new chat from the stored summary', async () => {
    const response = await continueChat('conv-a')

    expect(response.status).toBe(201)
    expect((await response.json()).id).toBe('conv-new')
    expect(mocks.createContinuation).toHaveBeenCalledWith('user-a', {
      source: expect.objectContaining({ id: 'conv-a', projectId: 'proj-a' }),
      memorySummaryStructured: expect.objectContaining({
        objective: 'Plan the bakery launch',
        decisions: ['Open on 5 December'],
      }),
    })
  })

  it('keeps an existing structured summary as it is', async () => {
    const structured = { objective: 'Ship it', facts: ['Uses Neon'] }
    mocks.getConversation.mockResolvedValue(
      sourceConversation({ memorySummaryStructured: structured })
    )

    await continueChat('conv-a')

    expect(mocks.createContinuation).toHaveBeenCalledWith('user-a', {
      source: expect.anything(),
      memorySummaryStructured: structured,
    })
  })
})
