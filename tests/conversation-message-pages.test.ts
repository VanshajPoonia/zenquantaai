import { describe, expect, it } from 'vitest'
import {
  mergeConversationMessagePage,
  mergeMessagesByIdChronological,
} from '@/lib/conversations/message-pages'
import { Conversation, Message, MessageRole } from '@/types'
import { nextMessageTimestamp } from '@/lib/utils/chat'

function message(
  id: string,
  createdAt: string,
  content = id,
  role: MessageRole = 'user'
): Message {
  return {
    id,
    role,
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

  it('keeps a user prompt above its assistant when timestamps collide', () => {
    const createdAt = '2026-06-03T00:01:00.000Z'
    const result = mergeMessagesByIdChronological(
      [message('assistant', createdAt, 'Reply', 'assistant')],
      [message('user', createdAt, 'Prompt', 'user')]
    )

    expect(result.map((item) => item.id)).toEqual(['user', 'assistant'])
    expect(nextMessageTimestamp(createdAt)).toBe(
      '2026-06-03T00:01:00.001Z'
    )
  })

  it('orders multiple ask-another-mode branch replies to the same user turn', () => {
    const userCreatedAt = '2026-06-03T00:01:00.000Z'
    const firstBranchCreatedAt = nextMessageTimestamp(userCreatedAt)
    const secondBranchCreatedAt = nextMessageTimestamp(
      userCreatedAt,
      firstBranchCreatedAt
    )

    expect(firstBranchCreatedAt).toBe('2026-06-03T00:01:00.001Z')
    expect(secondBranchCreatedAt).toBe('2026-06-03T00:01:00.002Z')

    const result = mergeMessagesByIdChronological(
      [],
      [
        message('user', userCreatedAt, 'Prompt', 'user'),
        message('branch-1', firstBranchCreatedAt, 'First reply', 'assistant'),
        message('branch-2', secondBranchCreatedAt, 'Second reply', 'assistant'),
      ]
    )

    expect(result.map((item) => item.id)).toEqual([
      'user',
      'branch-1',
      'branch-2',
    ])
  })
})
