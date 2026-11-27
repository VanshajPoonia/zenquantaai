import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Conversation, Message } from '@/types'

const mocks = vi.hoisted(() => ({ get: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db/repositories', () => ({
  neonConversationRepository: { get: mocks.get },
}))

import { createSessionSettings } from '@/lib/config'
import { HIDDEN_TEXT } from '@/lib/share/redact'
import {
  buildConversationShareSnapshot,
  SHARED_TOOL_TEXT_LIMIT,
} from '@/lib/share/snapshot'
import { loadConversationShareSnapshot } from '@/lib/share/conversation-shares'

const fakeKey = () => `sk-or-v1-${'a1B2c3D4e5'.repeat(5)}`

function message(overrides: Partial<Message>): Message {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}`,
    role: 'user',
    content: 'Hello',
    mode: 'general',
    createdAt: '2026-11-28T10:00:00.000Z',
    status: 'complete',
    ...overrides,
  }
}

function conversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-a',
    title: 'Trip plan',
    mode: 'general',
    projectId: 'proj-secret-project',
    createdAt: '2026-11-28T10:00:00.000Z',
    updatedAt: '2026-11-28T10:05:00.000Z',
    isPinned: false,
    preview: '',
    messageCount: 2,
    sessionSettings: createSessionSettings('general'),
    memorySummary: 'The user lives in Pune and is planning a trip.',
    messages: [
      message({ id: 'msg-1', content: 'Plan a weekend in Goa' }),
      message({
        id: 'msg-2',
        role: 'assistant',
        content: 'Here is a plan.',
        assistantFamily: 'nova',
        model: 'openai/gpt-5-secret-model',
        provider: 'openrouter',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
          rawCostUsd: 0.01,
          displayedCostUsd: 0.02,
          estimatedCostUsd: 0.02,
          displayMultiplier: 2,
          marginUsd: 0.01,
        },
        createdAt: '2026-11-28T10:00:01.000Z',
      }),
    ],
    ...overrides,
  }
}

describe('buildConversationShareSnapshot', () => {
  it('keeps roles, text, assistant names and times', () => {
    const { snapshot, messageCount, redactionCount } = buildConversationShareSnapshot(
      conversation()
    )

    expect(messageCount).toBe(2)
    expect(redactionCount).toBe(0)
    expect(snapshot).toMatchObject({ version: 1, title: 'Trip plan', mode: 'general', surface: 'web' })
    expect(snapshot.messages).toEqual([
      expect.objectContaining({
        role: 'user',
        content: 'Plan a weekend in Goa',
        assistantFamily: null,
        createdAt: '2026-11-28T10:00:00.000Z',
      }),
      expect.objectContaining({
        role: 'assistant',
        content: 'Here is a plan.',
        mode: 'general',
        assistantFamily: 'nova',
        customAssistant: null,
      }),
    ])
  })

  it('leaves out model ids, usage, memory and project info', () => {
    const json = JSON.stringify(buildConversationShareSnapshot(conversation()).snapshot)

    expect(json).not.toContain('gpt-5-secret-model')
    expect(json).not.toContain('openrouter')
    expect(json).not.toContain('rawCostUsd')
    expect(json).not.toContain('promptTokens')
    expect(json).not.toContain('Pune')
    expect(json).not.toContain('proj-secret-project')
    expect(json).not.toContain('msg-1')
  })

  it('shows the custom assistant name and emoji only', () => {
    const { snapshot } = buildConversationShareSnapshot(
      conversation({
        messages: [
          message({
            role: 'assistant',
            content: 'Draft ready',
            mode: 'creative',
            customAssistantId: '7b0f1c9e-2a3b-4c5d-8e9f-0a1b2c3d4e5f',
            customAssistant: {
              id: '7b0f1c9e-2a3b-4c5d-8e9f-0a1b2c3d4e5f',
              name: 'Brand voice',
              description: 'private notes about the brand',
              iconEmoji: '🎨',
              color: 'creative',
              baseMode: 'creative',
            },
          }),
        ],
      })
    )

    expect(snapshot.messages[0].customAssistant).toEqual({ name: 'Brand voice', iconEmoji: '🎨' })
    expect(JSON.stringify(snapshot)).not.toContain('private notes')
    expect(JSON.stringify(snapshot)).not.toContain('7b0f1c9e')
  })

  it('skips system messages, unfinished replies and empty failures', () => {
    const { snapshot, messageCount } = buildConversationShareSnapshot(
      conversation({
        messages: [
          message({ role: 'system', content: 'You are Nova.' }),
          message({ content: 'Question' }),
          message({ role: 'assistant', content: '', status: 'error', error: 'Timed out' }),
          message({ content: 'Again' }),
          message({ role: 'assistant', content: 'Half a reply', status: 'streaming' }),
        ],
      })
    )

    expect(messageCount).toBe(2)
    expect(snapshot.messages.map((item) => item.content)).toEqual(['Question', 'Again'])
  })

  it('keeps file names only and swaps Prism images for a placeholder flag', () => {
    const { snapshot } = buildConversationShareSnapshot(
      conversation({
        messages: [
          message({
            content: 'Read this',
            attachments: [
              {
                id: 'att-1',
                kind: 'pdf',
                name: 'contract.pdf',
                mimeType: 'application/pdf',
                size: 100,
                createdAt: '2026-11-28T10:00:00.000Z',
                bucket: 'private-bucket',
                storagePath: 'users/a/contract.pdf',
                previewUrl: '/api/files/object?bucket=private-bucket&path=users%2Fa',
                textContent: 'Clause 4: the rent is 50000',
              },
            ],
          }),
          message({
            role: 'assistant',
            mode: 'image',
            assistantFamily: 'prism',
            content: 'Created a visual concept based on your prompt.',
            attachments: [
              {
                id: 'att-2',
                kind: 'image',
                name: 'prism-1.png',
                mimeType: 'image/png',
                size: 100,
                createdAt: '2026-11-28T10:00:00.000Z',
                bucket: 'private-bucket',
                storagePath: 'users/a/prism-1.png',
              },
            ],
          }),
        ],
      })
    )

    expect(snapshot.messages[0]).toMatchObject({ attachmentNames: ['contract.pdf'], imageOmitted: false })
    expect(snapshot.messages[1]).toMatchObject({ attachmentNames: [], imageOmitted: true })
    const json = JSON.stringify(snapshot)
    expect(json).not.toContain('private-bucket')
    expect(json).not.toContain('/api/files/object')
    expect(json).not.toContain('Clause 4')
    expect(json).not.toContain('prism-1.png')
  })

  it('keeps source titles and public links only', () => {
    const { snapshot } = buildConversationShareSnapshot(
      conversation({
        messages: [
          message({
            role: 'assistant',
            content: 'Found it',
            sources: [
              {
                id: 's1',
                title: 'Goa travel guide',
                url: 'https://example.com/goa',
                domain: 'example.com',
                snippet: 'long snippet text',
              },
              {
                id: 's2',
                title: 'notes.md',
                url: '/api/files/object?bucket=b&path=p',
                domain: 'files',
                snippet: 'private file text',
                kind: 'file',
                fileId: 'file-1',
                chunkId: 'chunk-1',
              },
              { id: 's3', title: 'Bad link', url: 'javascript:alert(1)', domain: 'x', snippet: '' },
            ],
          }),
        ],
      })
    )

    expect(snapshot.messages[0].sources).toEqual([
      { title: 'Goa travel guide', url: 'https://example.com/goa' },
      { title: 'notes.md', url: null },
      { title: 'Bad link', url: null },
    ])
    expect(JSON.stringify(snapshot)).not.toContain('snippet')
  })

  it('cuts tool inputs and outputs and drops tool result data', () => {
    const longOutput = 'x'.repeat(5_000)
    const { snapshot } = buildConversationShareSnapshot(
      conversation({
        messages: [
          message({
            role: 'assistant',
            content: 'Saved',
            parts: [
              { type: 'text', text: 'thinking out loud' },
              {
                type: 'tool_call',
                callId: 'call-1',
                name: 'fetch_url',
                label: 'Read page',
                args: { url: 'https://example.com', body: 'y'.repeat(5_000), nested: { a: 1 }, nothing: null },
              },
              {
                type: 'tool_result',
                callId: 'call-1',
                name: 'fetch_url',
                ok: true,
                summary: 's'.repeat(1_000),
                output: longOutput,
                sources: [{ id: 'x', title: 't', url: 'https://example.com', domain: 'example.com', snippet: '' }],
                data: { artifactId: 'artifact-private-id', imagePrompt: 'a cat' },
              },
            ],
          }),
        ],
      })
    )

    const [call, result] = snapshot.messages[0].parts
    expect(snapshot.messages[0].parts).toHaveLength(2)
    expect(call).toMatchObject({ type: 'tool_call', name: 'fetch_url', label: 'Read page' })
    const args = (call as { args: Record<string, unknown> }).args
    expect(args.url).toBe('https://example.com')
    expect((args.body as string).length).toBeLessThanOrEqual(SHARED_TOOL_TEXT_LIMIT + 1)
    expect(args.nested).toBe('{"a":1}')
    expect('nothing' in args).toBe(false)

    expect(result.type).toBe('tool_result')
    if (result.type !== 'tool_result') throw new Error('expected a tool result')
    expect(result.output?.length).toBe(SHARED_TOOL_TEXT_LIMIT + 1)
    expect(result.output?.endsWith('…')).toBe(true)
    expect(result.summary.length).toBeLessThanOrEqual(301)
    expect(result.data).toBeUndefined()
    expect(result.sources).toBeUndefined()
    expect(JSON.stringify(snapshot)).not.toContain('artifact-private-id')
  })

  it('hides keys in every text field and counts them', () => {
    const key = fakeKey()
    const { snapshot, redactionCount } = buildConversationShareSnapshot(
      conversation({
        title: `Debug ${key}`,
        messages: [
          message({ content: `My key is ${key}` }),
          message({
            role: 'assistant',
            content: 'Done',
            parts: [
              { type: 'tool_call', callId: 'c', name: 'web_search', label: 'Search', args: { query: key } },
              { type: 'tool_result', callId: 'c', name: 'web_search', ok: true, summary: key, output: `GITHUB_TOKEN=${'q'.repeat(30)}` },
            ],
            sources: [{ id: 's', title: key, url: `https://admin:hunter2pass@example.com`, domain: 'example.com', snippet: '' }],
          }),
        ],
      })
    )

    const json = JSON.stringify(snapshot)
    expect(json).not.toContain(key)
    expect(json).not.toContain('hunter2pass')
    expect(json).not.toContain('q'.repeat(30))
    expect(json).toContain(HIDDEN_TEXT)
    expect(redactionCount).toBe(7)
  })

  it('labels zq sessions as terminal sessions', () => {
    const { snapshot } = buildConversationShareSnapshot(
      conversation({ surface: 'cli', mode: 'code', workspace: { repo: 'acme/private-repo' } })
    )
    expect(snapshot.surface).toBe('cli')
    expect(JSON.stringify(snapshot)).not.toContain('private-repo')
  })
})

describe('loadConversationShareSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reads the chat for its owner only', async () => {
    mocks.get.mockImplementation(async (userId: string) =>
      userId === 'user-a' ? conversation() : null
    )

    const owned = await loadConversationShareSnapshot('user-a', 'conv-a')
    expect(owned.ok).toBe(true)
    expect(mocks.get).toHaveBeenCalledWith('user-a', 'conv-a', { messageLimit: 1 })
    expect(mocks.get).toHaveBeenCalledWith('user-a', 'conv-a')

    expect(await loadConversationShareSnapshot('user-b', 'conv-a')).toEqual({ ok: false, status: 404 })
  })

  it('refuses chats that are too long or empty', async () => {
    mocks.get.mockResolvedValueOnce(conversation({ messageCount: 900 }))
    const long = await loadConversationShareSnapshot('user-a', 'conv-a')
    expect(long).toMatchObject({ ok: false, status: 400 })
    expect(mocks.get).toHaveBeenCalledTimes(1)

    mocks.get.mockResolvedValue(conversation({ messageCount: 0, messages: [] }))
    const empty = await loadConversationShareSnapshot('user-a', 'conv-a')
    expect(empty).toMatchObject({ ok: false, status: 400, error: 'There is nothing to share in this chat yet.' })
  })
})
