import { describe, expect, it } from 'vitest'
import {
  canShowNotices,
  findFinishedMessage,
  finishedReply,
  noticeText,
  unreadTitle,
} from '@/lib/pwa/done-notices'
import type { Message } from '@/types'

const streaming = { status: 'streaming' as const, conversationId: 'chat-1', messageId: 'm2' }

function reply(patch: Partial<Message> = {}): Message {
  return {
    id: 'm2',
    role: 'assistant',
    content: 'Here is the fix.\n\nThe test failed because the mock never resolved.',
    mode: 'code',
    createdAt: '2026-11-28T10:00:00.000Z',
    status: 'complete',
    assistantFamily: 'forge',
    ...patch,
  }
}

describe('done notices', () => {
  it('spots a reply that finished', () => {
    expect(finishedReply(streaming, { status: 'idle' })).toEqual({ conversationId: 'chat-1', messageId: 'm2' })
    // The queue can start the next reply in the same render.
    expect(finishedReply(streaming, { ...streaming, messageId: 'm4' })).toEqual({ conversationId: 'chat-1', messageId: 'm2' })
  })

  it('ignores replies still running and replies that failed', () => {
    expect(finishedReply(streaming, { ...streaming, workingNotes: ['Reading'] })).toBeNull()
    expect(finishedReply(streaming, { status: 'error', conversationId: 'chat-1', messageId: 'm2', error: 'x' })).toBeNull()
    expect(finishedReply({ status: 'idle' }, { status: 'idle' })).toBeNull()
  })

  it('finds the finished message, falling back to the last reply', () => {
    const conversations = [{ id: 'chat-1', messages: [reply({ id: 'server-id' })] }]
    expect(findFinishedMessage(conversations, { conversationId: 'chat-1', messageId: 'm2' })?.id).toBe('server-id')
    expect(
      findFinishedMessage([{ id: 'chat-1', messages: [reply({ error: 'Generation stopped.' })] }], {
        conversationId: 'chat-1',
        messageId: 'm2',
      })
    ).toBeNull()
    expect(findFinishedMessage([], { conversationId: 'chat-1', messageId: 'm2' })).toBeNull()
  })

  it('names the assistant and keeps the first 80 characters', () => {
    const text = noticeText(reply({ content: `Here is the fix.\n\n${'The mock never resolved. '.repeat(6)}` }))
    expect(text.startsWith('Forge finished: Here is the fix. The mock never resolved.')).toBe(true)
    expect(text.length).toBe('Forge finished: '.length + 80)
    expect(noticeText(reply({ content: '', assistantFamily: undefined, mode: 'live' }))).toBe('Pulse finished your reply.')
  })

  it('counts unread replies in the title', () => {
    expect(unreadTitle(1)).toBe('(1) Zenquanta AI')
  })

  it('offers notices on desktop browsers only', () => {
    const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0 Safari/537.36'
    const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36'
    expect(canShowNotices({ hasNotification: true, userAgent: mac })).toBe(true)
    expect(canShowNotices({ hasNotification: true, userAgent: android })).toBe(false)
    expect(canShowNotices({ hasNotification: false, userAgent: mac })).toBe(false)
  })
})
