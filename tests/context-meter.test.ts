import { describe, expect, it } from 'vitest'
import { getChatContextWindowTokens, PLAN_CONFIGS } from '@/lib/config'
import { RECENT_TURN_MESSAGE_LIMIT } from '@/lib/ai/memory'
import { estimateContextUsage } from '@/lib/chat/context-meter'
import type { Attachment, Message } from '@/types'

function message(index: number, role: Message['role'], content: string): Message {
  return {
    id: `msg-${index}`,
    role,
    content,
    mode: 'general',
    createdAt: new Date(Date.UTC(2026, 10, 28, 0, 0, index)).toISOString(),
  }
}

const base = {
  instructionTexts: [],
  summary: null,
  messages: [],
  draft: '',
  draftAttachments: [],
  includeAttachmentText: false,
  windowTokens: 8_000,
}

describe('context meter estimate', () => {
  it('counts only the recent window the server sends', () => {
    const messages = Array.from({ length: 20 }, (_, index) =>
      message(index, index % 2 ? 'assistant' : 'user', 'x'.repeat(400))
    )

    const estimate = estimateContextUsage({ ...base, messages, draft: 'Next question' })

    expect(estimate.windowSize).toBe(RECENT_TURN_MESSAGE_LIMIT)
    expect(estimate.recentCount).toBe(RECENT_TURN_MESSAGE_LIMIT - 1)
    expect(estimate.recentTokens).toBe((RECENT_TURN_MESSAGE_LIMIT - 1) * 100)
    expect(estimate.draftTokens).toBe(4)
  })

  it('adds instructions and the summary and works out the share', () => {
    const estimate = estimateContextUsage({
      ...base,
      instructionTexts: ['a'.repeat(4_000)],
      summary: 'Conversation goal:\n- Plan a launch',
    })

    expect(estimate.instructionsTokens).toBe(500 + 1_000)
    expect(estimate.summaryTokens).toBeGreaterThan(0)
    expect(estimate.totalTokens).toBe(
      estimate.instructionsTokens + estimate.summaryTokens + estimate.recentTokens + estimate.draftTokens
    )
    expect(estimate.share).toBeCloseTo(estimate.totalTokens / 8_000)
  })

  it('leaves the share empty when the window is unknown', () => {
    expect(estimateContextUsage({ ...base, windowTokens: null }).share).toBeNull()
  })

  it('counts attachment text only when file context is on', () => {
    const attachment: Attachment = {
      id: 'file-1',
      kind: 'text',
      name: 'notes.txt',
      mimeType: 'text/plain',
      size: 10_000,
      createdAt: '2026-11-28T00:00:00.000Z',
      textContent: 'y'.repeat(10_000),
    }

    const off = estimateContextUsage({ ...base, draft: 'Read this', draftAttachments: [attachment] })
    const on = estimateContextUsage({
      ...base,
      draft: 'Read this',
      draftAttachments: [attachment],
      includeAttachmentText: true,
    })

    expect(on.draftTokens - off.draftTokens).toBe(Math.ceil((80 + 1_500) / 4))
  })
})

describe('chat context window', () => {
  it('uses the plan cap for text assistants', () => {
    expect(getChatContextWindowTokens('general', 'free')).toBe(PLAN_CONFIGS.free.maxInputTokensPerRequest)
    expect(getChatContextWindowTokens('code', 'prime')).toBe(PLAN_CONFIGS.prime.maxInputTokensPerRequest)
  })

  it('has no window for Prism', () => {
    expect(getChatContextWindowTokens('image', 'pro')).toBeNull()
  })
})
