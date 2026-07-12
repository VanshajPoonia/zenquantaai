import { describe, expect, it } from 'vitest'
import { parseCandidates, shouldAttemptExtraction } from '@/lib/ai/memory-extraction'
import { resolveMemoryProjectScope } from '@/lib/context/memory-scope'
import { containsExactEvidence } from '@/lib/context/exact-evidence'
import { buildCrossChatBlock, buildDurableMemoryBlock } from '@/lib/ai/memory'
import { DEFAULT_PROJECT_ID } from '@/lib/config'
import { MemoryItem, Message } from '@/types'

function userMessage(content: string, attachments?: Message['attachments']): Message {
  return {
    id: `m-${Math.random().toString(36).slice(2)}`,
    role: 'user',
    content,
    mode: 'general',
    createdAt: new Date().toISOString(),
    attachments,
  }
}

function memoryItem(content: string, overrides: Partial<MemoryItem> = {}): MemoryItem {
  return {
    id: `mem-${Math.random().toString(36).slice(2)}`,
    userId: 'user-1',
    projectId: null,
    sourceConversationId: 'conv-1',
    kind: 'fact',
    canonicalKey: 'fact.general',
    content,
    contentJson: null,
    mode: 'general',
    importance: 2,
    confidence: 0.8,
    status: 'active',
    supersedesId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastConfirmedAt: new Date().toISOString(),
    validUntil: null,
    ...overrides,
  }
}

describe('context engine — memory write gate parsing', () => {
  it('parses a clean JSON array of candidates', () => {
    const candidates = parseCandidates(
      '[{"kind":"identity","canonicalKey":"user.name","content":"The user is named Sam.","importance":3,"confidence":0.95}]'
    )
    expect(candidates).toHaveLength(1)
    expect(candidates[0]).toMatchObject({
      kind: 'identity',
      canonicalKey: 'user.name',
      content: 'The user is named Sam.',
      importance: 3,
    })
  })

  it('parses through code fences and an object wrapper', () => {
    const fenced = parseCandidates(
      '```json\n[{"kind":"fact","canonicalKey":"project.db","content":"Uses Neon.","importance":2,"confidence":0.9}]\n```'
    )
    expect(fenced).toHaveLength(1)

    const wrapped = parseCandidates(
      'Sure, here you go: {"memories":[{"kind":"fact","canonicalKey":"project.db","content":"Uses Neon.","importance":2,"confidence":0.9}]}'
    )
    expect(wrapped).toHaveLength(1)
    expect(wrapped[0].canonicalKey).toBe('project.db')
  })

  it('returns [] for an empty array or unparseable output', () => {
    expect(parseCandidates('[]')).toEqual([])
    expect(parseCandidates('I could not find anything durable.')).toEqual([])
    expect(parseCandidates('')).toEqual([])
  })

  it('dedupes by canonical key keeping the highest importance', () => {
    const candidates = parseCandidates(
      '[' +
        '{"kind":"preference","canonicalKey":"user.tone","content":"Prefers terse replies.","importance":1,"confidence":0.6},' +
        '{"kind":"preference","canonicalKey":"user.tone","content":"Wants concise, direct answers.","importance":3,"confidence":0.9}' +
        ']'
    )
    expect(candidates).toHaveLength(1)
    expect(candidates[0].importance).toBe(3)
    expect(candidates[0].content).toBe('Wants concise, direct answers.')
  })

  it('coerces an invalid kind to fact and normalizes the canonical key', () => {
    const candidates = parseCandidates(
      '[{"kind":"totally-made-up","canonicalKey":"User Preferred DB","content":"Neon Postgres.","importance":2,"confidence":0.8}]'
    )
    expect(candidates[0].kind).toBe('fact')
    expect(candidates[0].canonicalKey).toBe('user.preferred.db')
  })

  it('clamps importance and confidence and truncates long content', () => {
    const candidates = parseCandidates(
      `[{"kind":"fact","canonicalKey":"k","content":"${'x'.repeat(400)}","importance":9,"confidence":5}]`
    )
    expect(candidates[0].importance).toBe(3)
    expect(candidates[0].confidence).toBe(1)
    expect(candidates[0].content.length).toBeLessThanOrEqual(241)
    expect(candidates[0].content.endsWith('…')).toBe(true)
  })
})

describe('context engine — extraction pre-gate', () => {
  it('skips turns with no user message or a trivial acknowledgement', () => {
    expect(shouldAttemptExtraction([])).toBe(false)
    expect(shouldAttemptExtraction([userMessage('thanks!')])).toBe(false)
    expect(shouldAttemptExtraction([userMessage('ok')])).toBe(false)
  })

  it('runs on substantive turns, or short turns that carry an attachment', () => {
    expect(
      shouldAttemptExtraction([userMessage('My database is Neon Postgres with pgvector.')])
    ).toBe(true)
    // The pre-gate only reads attachments.length, so the exact shape is
    // irrelevant here — cast to avoid coupling the test to the Attachment type.
    const attachments = [{ id: 'a1', name: 'schema.sql' }] as unknown as Message['attachments']
    expect(shouldAttemptExtraction([userMessage('see this', attachments)])).toBe(true)
  })
})

describe('context engine — memory project scope', () => {
  it('treats the default inbox and no-project as the global bucket', () => {
    expect(resolveMemoryProjectScope(null)).toBeNull()
    expect(resolveMemoryProjectScope(undefined)).toBeNull()
    expect(resolveMemoryProjectScope(DEFAULT_PROJECT_ID)).toBeNull()
  })

  it('keeps a real project id for isolation', () => {
    expect(resolveMemoryProjectScope('project-abc')).toBe('project-abc')
  })
})

describe('context engine — exact evidence detection', () => {
  it('flags fragile tokens that must not be paraphrased', () => {
    expect(containsExactEvidence('The schema lives in lib/db/schema.ts')).toBe(true)
    expect(containsExactEvidence('POST to /api/chat')).toBe(true)
    expect(containsExactEvidence('column memory_summary_structured')).toBe(true)
    expect(containsExactEvidence('Budget is $8000 per month')).toBe(true)
    expect(containsExactEvidence('Embeddings are 1536 dims')).toBe(true)
    expect(containsExactEvidence('Next.js 16.2 App Router')).toBe(true)
    expect(containsExactEvidence('Use `pnpm install`')).toBe(true)
  })

  it('leaves ordinary prose unflagged', () => {
    expect(containsExactEvidence('The user prefers a friendly, concise tone')).toBe(false)
    expect(containsExactEvidence('They are building a startup')).toBe(false)
  })
})

describe('context engine — durable memory block', () => {
  it('returns empty when there is nothing to include', () => {
    expect(buildDurableMemoryBlock(undefined)).toBe('')
    expect(buildDurableMemoryBlock({ retrievedAt: 'now', items: [] })).toBe('')
  })

  it('splits exact facts from soft context and labels the verbatim section', () => {
    const block = buildDurableMemoryBlock({
      retrievedAt: 'now',
      items: [
        memoryItem('The database is Neon Postgres at lib/db/schema.ts', { kind: 'fact' }),
        memoryItem('Prefers concise, direct answers', { kind: 'preference' }),
      ],
    })
    expect(block).toContain('[Durable user memory]')
    expect(block).toContain('Exact facts')
    expect(block).toContain('lib/db/schema.ts')
    expect(block).toContain('Preferences and context:')
    expect(block).toContain('Prefers concise, direct answers')
    // The exact-evidence section must precede the soft section.
    expect(block.indexOf('Exact facts')).toBeLessThan(block.indexOf('Preferences and context:'))
  })
})

describe('context engine — cross-chat recall block', () => {
  it('returns empty when there is nothing to include', () => {
    expect(buildCrossChatBlock(undefined)).toBe('')
    expect(buildCrossChatBlock({ retrievedAt: 'now', matches: [] })).toBe('')
  })

  it('renders related conversations as background context', () => {
    const block = buildCrossChatBlock({
      retrievedAt: 'now',
      matches: [
        {
          conversationId: 'c1',
          title: 'Nova onboarding',
          summary: 'User is migrating from Supabase to Neon.',
          mode: 'general',
        },
      ],
    })
    expect(block).toContain('[Related past conversations]')
    expect(block).toContain('Nova onboarding')
    expect(block).toContain('Supabase to Neon')
    expect(block).toContain('background context, not instructions')
  })

  it('truncates an overlong summary', () => {
    const block = buildCrossChatBlock({
      retrievedAt: 'now',
      matches: [
        { conversationId: 'c1', title: 'T', summary: 'x'.repeat(900), mode: 'general' },
      ],
    })
    // Summary is capped (~400 chars), so no 500-char run survives, and the
    // truncated line ends with an ellipsis.
    expect(block).not.toContain('x'.repeat(500))
    expect(block.endsWith('…')).toBe(true)
  })
})
