import { describe, expect, it } from 'vitest'
import {
  formatLastUpdate,
  liveCursor,
  mergeLiveMessages,
  sessionAgeMs,
} from '@/lib/cli/live-session'
import type { Conversation, Message } from '@/types'

function message(id: string, createdAt: string, content = id, patch: Partial<Message> = {}): Message {
  return { id, role: 'assistant', content, mode: 'code', createdAt, status: 'complete', ...patch }
}

function conversation(messages: Message[]): Conversation {
  return {
    id: 'cli-abc',
    title: 'zq in app',
    mode: 'code',
    projectId: 'project-inbox',
    createdAt: '2026-11-28T10:00:00.000Z',
    updatedAt: '2026-11-28T10:00:00.000Z',
    isPinned: false,
    preview: 'old',
    messageCount: messages.length,
    surface: 'cli',
    sessionSettings: {
      temperature: 0.2,
      maxTokens: 1000,
      topP: 1,
      systemPreset: 'default',
      modelOverride: 'auto',
      webSearch: false,
      memory: true,
      fileContext: false,
    },
    messages,
    messagePageInfo: { loadedCount: messages.length, totalCount: messages.length, hasMoreBefore: false },
  }
}

describe('live zq sessions', () => {
  it('ages the session on the server clock', () => {
    expect(sessionAgeMs({ updatedAt: '2026-11-28T10:00:00.000Z', serverNow: '2026-11-28T10:01:30.000Z' })).toBe(90_000)
    expect(sessionAgeMs({ updatedAt: '2026-11-28T10:00:05.000Z', serverNow: '2026-11-28T10:00:00.000Z' })).toBe(0)
    expect(sessionAgeMs({ updatedAt: 'nope', serverNow: '2026-11-28T10:00:00.000Z' })).toBe(Number.POSITIVE_INFINITY)
  })

  it('uses the newest message as the cursor', () => {
    expect(liveCursor([])).toBeNull()
    expect(
      liveCursor([
        { createdAt: '2026-11-28T10:00:02.000Z' },
        { createdAt: '2026-11-28T10:00:05.000Z' },
        { createdAt: '2026-11-28T10:00:03.000Z' },
      ])
    ).toBe('2026-11-28T10:00:05.000Z')
  })

  it('appends new entries and replaces a growing turn', () => {
    const start = conversation([
      message('u1', '2026-11-28T10:00:01.000Z', 'Fix the test', { role: 'user' }),
      message('a1', '2026-11-28T10:00:02.000Z', 'Looking'),
    ])
    const merged = mergeLiveMessages(start, {
      updatedAt: '2026-11-28T10:00:09.000Z',
      messages: [
        message('a1', '2026-11-28T10:00:02.000Z', 'Looking\n\nFixed it'),
        message('u2', '2026-11-28T10:00:08.000Z', 'Thanks', { role: 'user' }),
      ],
    })

    expect(merged.messages.map((item) => item.id)).toEqual(['u1', 'a1', 'u2'])
    expect(merged.messages[1].content).toBe('Looking\n\nFixed it')
    expect(merged.messageCount).toBe(3)
    expect(merged.messagePageInfo?.loadedCount).toBe(3)
    expect(merged.updatedAt).toBe('2026-11-28T10:00:09.000Z')
    expect(merged.preview).toBe('Thanks')
  })

  it('notices a new tool step even when the text is the same', () => {
    const start = conversation([message('a1', '2026-11-28T10:00:02.000Z', 'Running tests', { parts: [] })])
    const merged = mergeLiveMessages(start, {
      updatedAt: start.updatedAt,
      messages: [
        message('a1', '2026-11-28T10:00:02.000Z', 'Running tests', {
          parts: [{ type: 'tool_call', callId: 'c1', name: 'bash', label: 'bash', args: {} }],
        }),
      ],
    })
    expect(merged).not.toBe(start)
    expect(merged.messages[0].parts).toHaveLength(1)
  })

  it('keeps the same object when nothing changed', () => {
    const start = conversation([message('a1', '2026-11-28T10:00:02.000Z', 'Done')])
    const same = mergeLiveMessages(start, {
      updatedAt: start.updatedAt,
      messages: [message('a1', '2026-11-28T10:00:02.000Z', 'Done')],
    })
    expect(same).toBe(start)
  })

  it('words the last update plainly', () => {
    expect(formatLastUpdate(20_000)).toBe('Last update just now')
    expect(formatLastUpdate(3 * 60_000 + 5_000)).toBe('Last update 3 min ago')
    expect(formatLastUpdate(60 * 60_000)).toBe('Last update 1 hour ago')
    expect(formatLastUpdate(5 * 60 * 60_000)).toBe('Last update 5 hours ago')
    expect(formatLastUpdate(49 * 60 * 60_000)).toBe('Last update 2 days ago')
  })
})
