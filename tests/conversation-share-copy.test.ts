import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import type { Conversation, ConversationShareSnapshot } from '@/types'

const mocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  appendAuthCookies: vi.fn(),
  ensureFromAuthUser: vi.fn(),
  hitRateLimit: vi.fn(),
  getPublicByToken: vi.fn(),
  getSettings: vi.fn(),
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
  neonConversationSharesRepository: { getPublicByToken: mocks.getPublicByToken },
  neonSettingsRepository: { get: mocks.getSettings },
  neonConversationRepository: { save: mocks.save },
}))

import { createSessionSettings, DEFAULT_APP_SETTINGS } from '@/lib/config'
import { POST as copyShare } from '@/app/api/share/conversations/[token]/copy/route'
import { buildConversationFromShare, withTitleSuffix } from '@/lib/share/copy'

const TOKEN = 'T'.repeat(43)
const REVOKED = 'R'.repeat(43)

const snapshot: ConversationShareSnapshot = {
  version: 1,
  title: 'Trip plan',
  mode: 'live',
  surface: 'cli',
  messages: [
    {
      role: 'user',
      content: 'Find flights',
      mode: 'live',
      assistantFamily: null,
      customAssistant: null,
      createdAt: '2026-11-28T10:00:00.000Z',
      parts: [],
      sources: [],
      attachmentNames: ['notes.pdf'],
      imageOmitted: false,
    },
    {
      role: 'assistant',
      content: 'Here are three.',
      mode: 'live',
      assistantFamily: 'pulse',
      customAssistant: { name: 'Travel helper', iconEmoji: '✈️' },
      createdAt: '2026-11-28T10:00:01.000Z',
      parts: [{ type: 'tool_call', callId: 'c1', name: 'web_search', label: 'Search', args: { query: 'flights' } }],
      sources: [
        { title: 'Airline', url: 'https://example.com/flights' },
        { title: 'notes.pdf', url: null },
      ],
      attachmentNames: [],
      imageOmitted: false,
    },
    {
      role: 'assistant',
      content: 'Created a visual concept.',
      mode: 'image',
      assistantFamily: 'prism',
      customAssistant: null,
      createdAt: '2026-11-28T10:00:02.000Z',
      parts: [],
      sources: [],
      attachmentNames: [],
      imageOmitted: true,
    },
  ],
}

function requireRouteResponse(response: Response | undefined): Response {
  if (!response) throw new Error('Route did not return a response.')
  return response
}

async function post(token: string) {
  return requireRouteResponse(
    await copyShare(
      new NextRequest(`http://localhost/api/share/conversations/${token}/copy`, { method: 'POST' }),
      { params: Promise.resolve({ token }) }
    )
  )
}

describe('buildConversationFromShare', () => {
  it('makes a new web chat with fresh ids and no borrowed assistant', () => {
    const copy = buildConversationFromShare(snapshot, createSessionSettings('live'))

    expect(copy.title).toBe('Trip plan (shared)')
    expect(copy.mode).toBe('live')
    expect(copy.surface).toBeUndefined()
    expect(copy.customAssistantId).toBeNull()
    expect(copy.memorySummary).toBeUndefined()
    expect(copy.messages).toHaveLength(3)
    expect(new Set(copy.messages.map((message) => message.id)).size).toBe(3)
    expect(copy.messages[1]).toMatchObject({
      role: 'assistant',
      assistantFamily: 'pulse',
      status: 'complete',
      parts: snapshot.messages[1].parts,
    })
    expect(copy.messages[1].customAssistant).toBeUndefined()
    expect(copy.messages[1].sources).toEqual([
      expect.objectContaining({ title: 'Airline', url: 'https://example.com/flights', domain: 'example.com' }),
    ])
    expect(copy.messages[2].content).toBe(
      'Created a visual concept.\n\n_Image not included in shared chats._'
    )
    expect(copy.messages.every((message) => !message.attachments?.length)).toBe(true)
  })

  it('keeps titles inside the rename limit', () => {
    expect(withTitleSuffix('a'.repeat(200), ' (shared)')).toHaveLength(120)
    expect(withTitleSuffix('   ', ' (shared)')).toBe('Untitled chat (shared)')
  })
})

describe('POST /api/share/conversations/[token]/copy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_CHAT_SHARING = 'true'
    mocks.requireAuthenticatedUser.mockResolvedValue({
      user: { id: 'user-b', role: 'user' },
      session: { refreshed: false },
    })
    mocks.hitRateLimit.mockResolvedValue(true)
    mocks.getSettings.mockResolvedValue(DEFAULT_APP_SETTINGS)
    mocks.getPublicByToken.mockImplementation(async (token: string) =>
      token === TOKEN ? { createdAt: '2026-11-28T10:00:00.000Z', snapshot } : null
    )
    mocks.save.mockImplementation(async (_userId: string, conversation: Conversation) => conversation)
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_CHAT_SHARING
  })

  it('needs a signed-in visitor', async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue({
      response: NextResponse.json({ error: 'Authentication required.' }, { status: 401 }),
    })

    expect((await post(TOKEN)).status).toBe(401)
    expect(mocks.getPublicByToken).not.toHaveBeenCalled()
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('copies the snapshot into the visitor workspace', async () => {
    const response = await post(TOKEN)

    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.conversation.title).toBe('Trip plan (shared)')
    expect(mocks.save).toHaveBeenCalledWith('user-b', expect.objectContaining({ mode: 'live' }))
  })

  it('answers revoked, unknown and malformed tokens with 404', async () => {
    expect((await post(REVOKED)).status).toBe(404)
    expect((await post('short')).status).toBe(404)
    expect(mocks.getPublicByToken).toHaveBeenCalledTimes(1)
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('stays off until the flag is set', async () => {
    delete process.env.NEXT_PUBLIC_CHAT_SHARING

    expect((await post(TOKEN)).status).toBe(404)
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('limits copies per visitor per hour', async () => {
    mocks.hitRateLimit.mockResolvedValue(false)

    const response = await post(TOKEN)

    expect(response.status).toBe(429)
    expect(mocks.hitRateLimit).toHaveBeenCalledWith('chat-share-copy:user-b', 30, 3_600)
    expect(mocks.save).not.toHaveBeenCalled()
  })
})
