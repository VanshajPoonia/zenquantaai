import { describe, expect, it } from 'vitest'
import {
  mergeConversationMessagePage,
  mergeMessagesByIdChronological,
} from '@/lib/conversations/message-pages'
import { Conversation, Message } from '@/types'

function message(id: string, createdAt: string, content = id): Message {
  return {
    id,
    role: 'user',
    content,
    mode: 'general',
    createdAt,
  }
}

function conversation(messages: Message[]): Conversation {
  return {
    id: 'chat-1',
    title: 'Long chat',
    mode: 'general',
    projectId: 'project-inbox',
    createdAt: '2026-06-03T00:00:00.000Z',
    updatedAt: '2026-06-03T00:00:00.000Z',
    isPinned: false,
    preview: 'Latest',
    messageCount: 5,
    sessionSettings: {
      temperature: 0.7,
      maxTokens: 1000,
      topP: 1,
      systemPreset: 'default',
      modelOverride: 'auto',
      webSearch: false,
      memory: true,
      fileContext: false,
    },
    messages,
  }
}

describe('conversation message page helpers', () => {
  it('merges messages by id and keeps chronological order', () => {
    const result = mergeMessagesByIdChronological(
      [
        message('m3', '2026-06-03T00:03:00.000Z'),
        message('m4', '2026-06-03T00:04:00.000Z'),
      ],
      [
        message('m1', '2026-06-03T00:01:00.000Z'),
        message('m2', '2026-06-03T00:02:00.000Z'),
        message('m3', '2026-06-03T00:03:00.000Z', 'updated'),
      ]
    )

    expect(result.map((item) => item.id)).toEqual(['m1', 'm2', 'm3', 'm4'])
    expect(result.find((item) => item.id === 'm3')?.content).toBe('updated')
  })

  it('updates page metadata after prepending an older page', () => {
    const merged = mergeConversationMessagePage(
      conversation([message('m4', '2026-06-03T00:04:00.000Z')]),
      {
        conversationId: 'chat-1',
        messages: [
          message('m2', '2026-06-03T00:02:00.000Z'),
          message('m3', '2026-06-03T00:03:00.000Z'),
        ],
        hasMoreBefore: true,
        nextBefore: '2026-06-03T00:02:00.000Z',
      }
    )

    expect(merged.messages.map((item) => item.id)).toEqual(['m2', 'm3', 'm4'])
    expect(merged.messagePageInfo).toEqual({
      loadedCount: 3,
      totalCount: 5,
      hasMoreBefore: true,
      nextBefore: '2026-06-03T00:02:00.000Z',
    })
  })
})
