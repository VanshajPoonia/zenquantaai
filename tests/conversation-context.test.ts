import { describe, expect, it } from 'vitest'
import { selectBoundedContextMessages } from '@/lib/ai/memory'
import { Message } from '@/types'

function message(id: string, role: Message['role'], content: string): Message {
  return {
    id,
    role,
    content,
    mode: 'general',
    createdAt: `2026-06-03T00:00:0${id}.000Z`,
  }
}

describe('bounded conversation context', () => {
  it('keeps only the newest configured number of non-system messages', () => {
    const result = selectBoundedContextMessages(
      [
        message('1', 'system', 'hidden'),
        message('2', 'user', 'old'),
        message('3', 'assistant', 'middle'),
        message('4', 'user', 'latest'),
      ],
      { maxMessages: 2, maxTotalChars: 100 }
    )

    expect(result.map((item) => item.content)).toEqual(['middle', 'latest'])
  })

  it('truncates oversized messages and always includes the latest user request', () => {
    const result = selectBoundedContextMessages(
      [
        message('1', 'assistant', 'a'.repeat(80)),
        message('2', 'user', 'latest user request'.repeat(10)),
      ],
      { maxMessages: 2, maxMessageChars: 30, maxTotalChars: 40 }
    )

    expect(result.at(-1)?.role).toBe('user')
    expect(result.at(-1)?.content).toContain('[message truncated]')
    expect(result.at(-1)?.content.length).toBeLessThan(60)
  })
})
