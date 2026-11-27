import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SQL } from 'drizzle-orm'
import type { Conversation } from '@/types'

// A chainable fake: inserts are recorded and every select on conversations reads them back.
const db = vi.hoisted(() => {
  const state = {
    inserts: [] as Array<Record<string, unknown>>,
    conflictSets: [] as Array<Record<string, unknown>>,
  }

  function query(kind: 'select' | 'insert' | 'write'): object {
    let table: unknown = null
    const proxy: object = new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === 'then') {
            const rows = kind === 'select' && table === db.conversationsTable ? state.inserts : []
            return (resolve: (value: unknown) => void) => resolve(rows)
          }
          return (arg: unknown) => {
            if (prop === 'from') table = arg
            if (prop === 'values' && kind === 'insert') {
              state.inserts.push(arg as Record<string, unknown>)
            }
            if (prop === 'onConflictDoUpdate') {
              state.conflictSets.push((arg as { set: Record<string, unknown> }).set)
            }
            return proxy
          }
        },
      }
    )
    return proxy
  }

  return {
    state,
    conversationsTable: null as unknown,
    client: {
      select: () => query('select'),
      insert: () => query('insert'),
      update: () => query('write'),
      delete: () => query('write'),
    },
  }
})

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db/client', () => ({ getDatabaseClient: () => db.client }))
vi.mock('@/lib/db/repositories/users', () => ({
  neonUsersRepository: { ensureUserReference: vi.fn() },
}))

import { createSessionSettings } from '@/lib/config'
import { zenConversations } from '@/lib/db/schema'
import { neonConversationRepository } from '@/lib/db/repositories/conversations'
import { parseRenderedSummary, renderStructuredSummary } from '@/lib/ai/memory-summary'
import { updateConversationMemory } from '@/lib/ai/memory'
import {
  buildPromptTextForUsage,
  completeConversationWithAssistant,
  prepareConversationForChat,
} from '@/lib/ai/chat'
import { createConversation, createMessage } from '@/lib/utils/chat'

db.conversationsTable = zenConversations

const source: Conversation = {
  ...createConversation({
    id: 'conv-a',
    title: 'Bakery launch',
    mode: 'code',
    projectId: 'proj-a',
    sessionSettings: { ...createSessionSettings('code'), memory: false },
    memorySummary: 'Conversation goal:\n- Plan the launch',
    memoryUpdatedAt: '2026-11-27T10:00:00.000Z',
    customAssistantId: 'ca-1',
    customAssistant: {
      id: 'ca-1',
      name: 'Baker',
      description: '',
      iconEmoji: 'B',
      color: 'code',
      baseMode: 'code',
    },
  }),
  messageCount: 14,
}

describe('createContinuation', () => {
  beforeEach(() => {
    db.state.inserts = []
    db.state.conflictSets = []
  })

  it('starts an empty chat that carries the summary and points back', async () => {
    const structured = { objective: 'Plan the launch' }

    const created = await neonConversationRepository.createContinuation('user-a', {
      source,
      memorySummaryStructured: structured,
    })

    const row = db.state.inserts[0]
    expect(row).toMatchObject({
      userId: 'user-a',
      projectId: 'proj-a',
      mode: 'code',
      messageCount: 0,
      customAssistantId: 'ca-1',
      memorySummary: 'Conversation goal:\n- Plan the launch',
      memorySummaryStructured: structured,
      sessionSettings: expect.objectContaining({
        memory: true,
        continuedFrom: { conversationId: 'conv-a', title: 'Bakery launch' },
      }),
    })
    expect(row.id).not.toBe('conv-a')
    expect(created.continuedFrom).toEqual({ conversationId: 'conv-a', title: 'Bakery launch' })
    expect(created.memorySummaryStructured).toEqual(structured)
    expect(created.messages).toEqual([])
  })

  it('never writes a continuedFrom sent with a normal save', async () => {
    const forged = {
      ...source,
      id: 'conv-c',
      sessionSettings: {
        ...source.sessionSettings,
        continuedFrom: { conversationId: 'conv-x', title: 'Forged' },
      } as Conversation['sessionSettings'],
    }

    await neonConversationRepository.save('user-a', forged)

    expect(db.state.inserts[0].sessionSettings).not.toHaveProperty('continuedFrom')
    // On conflict the stored value is merged back in SQL instead of taking the client's.
    expect(db.state.conflictSets[0].sessionSettings).toBeInstanceOf(SQL)
  })
})

describe('carried summaries', () => {
  it('reads rendered text back into sections', () => {
    const structured = {
      objective: 'Plan the launch',
      preferences: ['Short answers'],
      facts: ['Uses Neon'],
      decisions: ['Open on 5 December'],
      openLoops: ['Pick a logo'],
    }

    expect(parseRenderedSummary(renderStructuredSummary(structured))).toEqual({
      ...structured,
      constraints: [],
    })
    expect(parseRenderedSummary('')).toBeNull()
    expect(parseRenderedSummary('Some loose note')).toMatchObject({ facts: ['Some loose note'] })
  })

  it('keeps the carried summary ahead of the new chat on the legacy path', () => {
    const conversation = createConversation({
      mode: 'general',
      sessionSettings: createSessionSettings('general'),
      messages: [createMessage({ role: 'user', content: 'What next?', mode: 'general' })],
    })

    const update = updateConversationMemory(conversation, true, 'Conversation goal:\n- Plan the launch')

    expect(update.memorySummary).toMatch(
      /^Carried over from an earlier chat:\nConversation goal:\n- Plan the launch\n\n/
    )
    expect(update.memorySummary).toContain('What next?')
    expect(updateConversationMemory(conversation, true).memorySummary).not.toContain('Carried over')
  })

  it('reads the carried summary on the first message of the new chat', async () => {
    const empty = createConversation({
      id: 'conv-new',
      mode: 'general',
      sessionSettings: createSessionSettings('general'),
      memorySummary: 'Decisions made:\n- Open on 5 December',
    })
    const settings = createSessionSettings('general')

    const prepared = await prepareConversationForChat({
      action: 'send',
      conversationId: empty.id,
      conversation: empty,
      mode: 'general',
      content: 'What is left to do?',
      settings,
    })
    const prompt = buildPromptTextForUsage(prepared.generationConversation, settings, 'general')

    expect(prompt).toContain('[Conversation memory]\nDecisions made:\n- Open on 5 December')
  })

  it('keeps the carried summary after the first reply when MEMORY_V2 is off', async () => {
    const settings = createSessionSettings('general')
    const userMessage = createMessage({ role: 'user', content: 'What is left to do?', mode: 'general' })
    const reply = createMessage({ role: 'assistant', content: '', mode: 'general' })
    const continued = {
      ...createConversation({
        mode: 'general',
        sessionSettings: settings,
        messages: [userMessage, reply],
        memorySummary: 'Decisions made:\n- Open on 5 December',
      }),
      continuedFrom: { conversationId: 'conv-a', title: 'Bakery launch' },
      memorySummaryStructured: { decisions: ['Open on 5 December'] },
    }

    const completed = await completeConversationWithAssistant(
      continued,
      reply,
      'Pick a logo.',
      continued,
      'general',
      { responseSettings: settings }
    )

    expect(completed.memorySummary).toMatch(
      /^Carried over from an earlier chat:\nDecisions made:\n- Open on 5 December/
    )
  })
})
