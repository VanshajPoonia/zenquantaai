import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import type { Conversation, Message } from '@/types'

const mocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  appendAuthCookies: vi.fn(),
  ensureFromAuthUser: vi.fn(),
  hitRateLimit: vi.fn(),
  get: vi.fn(),
  save: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/session', () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
  appendAuthCookies: mocks.appendAuthCookies,
}))
vi.mock('@/lib/security/rate-limit', () => ({ hitRateLimit: mocks.hitRateLimit }))
vi.mock('@/lib/db/repositories', () => ({
  neonProfilesRepository: { ensureFromAuthUser: mocks.ensureFromAuthUser },
  neonConversationRepository: { get: mocks.get, save: mocks.save },
}))

import { createSessionSettings, DEFAULT_PROJECT_ID } from '@/lib/config'
import {
  buildBranchConversation,
  getBranchTitle,
  readConversationFork,
  selectBranchMessages,
} from '@/lib/conversations/branch'
import { POST as branchRoute } from '@/app/api/conversations/[id]/branch/route'

function message(id: string, overrides: Partial<Message> = {}): Message {
  return {
    id,
    role: 'user',
    content: id,
    mode: 'code',
    createdAt: `2026-11-28T10:00:0${id.slice(-1)}.000Z`,
    status: 'complete',
    ...overrides,
  }
}

const usage = {
  promptTokens: 1,
  completionTokens: 1,
  totalTokens: 2,
  rawCostUsd: 0.1,
  displayedCostUsd: 0.2,
  estimatedCostUsd: 0.2,
  displayMultiplier: 2,
  marginUsd: 0.1,
}

function source(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-a',
    title: 'Fix the login bug',
    mode: 'code',
    projectId: 'proj-1',
    createdAt: '2026-11-28T10:00:00.000Z',
    updatedAt: '2026-11-28T10:00:09.000Z',
    isPinned: true,
    preview: '',
    messageCount: 4,
    sessionSettings: { ...createSessionSettings('code'), temperature: 0.3, webSearch: true },
    memorySummary: 'Summary of the old chat',
    memoryUpdatedAt: '2026-11-28T10:00:09.000Z',
    customAssistantId: '7b0f1c9e-2a3b-4c5d-8e9f-0a1b2c3d4e5f',
    customAssistant: {
      id: '7b0f1c9e-2a3b-4c5d-8e9f-0a1b2c3d4e5f',
      name: 'Reviewer',
      iconEmoji: '🔍',
      color: 'code',
      baseMode: 'code',
    },
    messages: [
      message('msg-1', {
        attachments: [
          {
            id: 'att-1',
            kind: 'code',
            name: 'login.ts',
            mimeType: 'text/plain',
            size: 10,
            createdAt: '2026-11-28T10:00:01.000Z',
            bucket: 'b',
            storagePath: 'p',
            fileId: 'file-1',
            previewUrl: '/api/files/object?bucket=b&path=p',
          },
        ],
      }),
      message('msg-2', { role: 'assistant', parentUserMessageId: 'msg-1', usage, model: 'm' }),
      message('msg-3'),
      message('msg-4', { role: 'assistant', parentUserMessageId: 'msg-3', usage }),
    ],
    ...overrides,
  }
}

describe('selectBranchMessages', () => {
  it('takes the messages up to and including the chosen one', () => {
    const result = selectBranchMessages(source().messages, 'msg-2')
    expect(result.ok && result.messages.map((item) => item.id)).toEqual(['msg-1', 'msg-2'])
  })

  it('stops just before the chosen one when asked', () => {
    const result = selectBranchMessages(source().messages, 'msg-3', { before: true })
    expect(result.ok && result.messages.map((item) => item.id)).toEqual(['msg-1', 'msg-2'])

    const first = selectBranchMessages(source().messages, 'msg-1', { before: true })
    expect(first).toEqual({ ok: true, messages: [] })
  })

  it('reports a missing or unfinished message', () => {
    expect(selectBranchMessages(source().messages, 'msg-9')).toEqual({ ok: false, reason: 'not_found' })
    const streaming = [...source().messages, message('msg-5', { role: 'assistant', status: 'streaming' })]
    expect(selectBranchMessages(streaming, 'msg-5')).toEqual({ ok: false, reason: 'streaming' })
  })
})

describe('buildBranchConversation', () => {
  it('copies messages with new ids and keeps the chat setup', () => {
    const original = source()
    const branch = buildBranchConversation(original, {
      messages: original.messages.slice(0, 2),
      messageId: 'msg-2',
    })

    expect(branch.id).not.toBe('conv-a')
    expect(branch.title).toBe('Fix the login bug (branch)')
    expect(branch.mode).toBe('code')
    expect(branch.projectId).toBe('proj-1')
    expect(branch.customAssistantId).toBe(original.customAssistantId)
    expect(branch.customAssistant).toEqual(original.customAssistant)
    expect(branch.sessionSettings).toMatchObject({ temperature: 0.3, webSearch: true })
    expect(branch.forkedFrom).toEqual({ conversationId: 'conv-a', messageId: 'msg-2', title: 'Fix the login bug' })
    expect((branch.sessionSettings as unknown as { forkedFrom: unknown }).forkedFrom).toEqual(branch.forkedFrom)
    expect(branch.isPinned).toBe(false)
    expect(branch.memorySummary).toBeUndefined()

    const [user, reply] = branch.messages
    expect(user.id).not.toBe('msg-1')
    expect(user.content).toBe('msg-1')
    expect(user.attachments?.[0]).toMatchObject({ fileId: 'file-1', storagePath: 'p' })
    expect(user.attachments?.[0].previewUrl).toBeUndefined()
    expect(reply.parentUserMessageId).toBe(user.id)
    expect(reply.usage).toBeUndefined()
    expect(reply.model).toBe('m')
  })

  it('leaves the source chat as it was', () => {
    const original = source()
    const before = JSON.stringify(original)
    buildBranchConversation(original, { messages: original.messages, messageId: 'msg-4' })
    expect(JSON.stringify(original)).toBe(before)
  })

  it('turns a zq session into a normal web chat in the inbox', () => {
    const original = source({ surface: 'cli', workspace: { repo: 'acme/app' }, projectId: 'proj-1' })
    const branch = buildBranchConversation(original, { messages: original.messages, messageId: 'msg-4' })

    expect(branch.surface).toBeUndefined()
    expect(branch.workspace).toBeUndefined()
    expect(branch.projectId).toBe(DEFAULT_PROJECT_ID)
  })

  it('does not stack branch suffixes and keeps titles short', () => {
    expect(getBranchTitle('Plan (branch)')).toBe('Plan (branch)')
    expect(getBranchTitle('x'.repeat(300))).toHaveLength(120)
  })
})

describe('readConversationFork', () => {
  it('reads a valid link and ignores anything else', () => {
    expect(
      readConversationFork({ temperature: 1, forkedFrom: { conversationId: 'c', messageId: 'm', title: 'T' } })
    ).toEqual({ conversationId: 'c', messageId: 'm', title: 'T' })
    expect(readConversationFork({ temperature: 1 })).toBeNull()
    expect(readConversationFork({ forkedFrom: { conversationId: 1 } })).toBeNull()
    expect(readConversationFork(null)).toBeNull()
  })
})

describe('POST /api/conversations/[id]/branch', () => {
  function requireRouteResponse(response: Response | undefined): Response {
    if (!response) throw new Error('Route did not return a response.')
    return response
  }

  async function post(body: unknown, id = 'conv-a') {
    return requireRouteResponse(
      await branchRoute(
        new NextRequest(`http://localhost/api/conversations/${id}/branch`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }),
        { params: Promise.resolve({ id }) }
      )
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthenticatedUser.mockResolvedValue({
      user: { id: 'user-a', role: 'user' },
      session: { refreshed: false },
    })
    mocks.hitRateLimit.mockResolvedValue(true)
    mocks.get.mockImplementation(async (userId: string, id: string) =>
      userId === 'user-a' && id === 'conv-a' ? source() : null
    )
    mocks.save.mockImplementation(async (_userId: string, conversation: Conversation) => conversation)
  })

  it('needs a signed-in user', async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({
      response: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }),
    })

    expect((await post({ messageId: 'msg-2' })).status).toBe(401)
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it("answers another user's chat with 404", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({
      user: { id: 'user-b', role: 'user' },
      session: { refreshed: false },
    })

    expect((await post({ messageId: 'msg-2' })).status).toBe(404)
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('answers a message from elsewhere with 404', async () => {
    expect((await post({ messageId: 'msg-from-another-chat' })).status).toBe(404)
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('needs a message id', async () => {
    expect((await post({})).status).toBe(400)
    expect((await post({ messageId: 'x'.repeat(201) })).status).toBe(400)
  })

  it('waits for a reply that is still streaming', async () => {
    mocks.get.mockResolvedValue(
      source({ messages: [...source().messages, message('msg-5', { role: 'assistant', status: 'streaming' })] })
    )

    expect((await post({ messageId: 'msg-5' })).status).toBe(409)
  })

  it('limits branches per user per hour', async () => {
    mocks.hitRateLimit.mockResolvedValue(false)

    expect((await post({ messageId: 'msg-2' })).status).toBe(429)
    expect(mocks.hitRateLimit).toHaveBeenCalledWith('chat-branch:user-a', 60, 3_600)
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('refuses chats that are too long to copy', async () => {
    mocks.get.mockResolvedValue(source({ messageCount: 5_000 }))

    expect((await post({ messageId: 'msg-2' })).status).toBe(400)
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('saves a branch for the owner and returns its id', async () => {
    const response = await post({ messageId: 'msg-3', before: true })

    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.conversation).toMatchObject({ title: 'Fix the login bug (branch)', mode: 'code' })
    expect(mocks.get).toHaveBeenCalledWith('user-a', 'conv-a')
    const [userId, saved] = mocks.save.mock.calls[0] as [string, Conversation]
    expect(userId).toBe('user-a')
    expect(saved.messages.map((item) => item.content)).toEqual(['msg-1', 'msg-2'])
    expect(saved.forkedFrom).toMatchObject({ conversationId: 'conv-a', messageId: 'msg-3' })
  })
})
