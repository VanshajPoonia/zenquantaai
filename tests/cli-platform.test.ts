import { describe, expect, it } from 'vitest'
import { cliConversationId, isValidCliSessionId, parseCliEntries } from '@/lib/cli/session-sync'
import { listZqModels, resolveZqModel } from '@/lib/agent/model-names'
import { stepUsageFromOpenRouter } from '@/lib/agent/openrouter-usage'

describe('zq session sync', () => {
  it('scopes conversation ids to the user', () => {
    const a = cliConversationId('user-a', 'session-1')
    expect(a).toMatch(/^cli-[0-9a-f]{32}$/)
    expect(cliConversationId('user-b', 'session-1')).not.toBe(a)
    expect(cliConversationId('user-a', 'session-1')).toBe(a)
  })

  it('accepts only safe session ids', () => {
    expect(isValidCliSessionId('01a1e55d-b345-76a2')).toBe(true)
    expect(isValidCliSessionId('../etc')).toBe(false)
    expect(isValidCliSessionId('')).toBe(false)
  })

  it('prefixes message ids with the conversation id and cleans parts', () => {
    const messages = parseCliEntries('cli-abc', [
      {
        id: 'a1',
        role: 'assistant',
        content: 'Done',
        createdAt: '2026-11-16T10:00:00Z',
        parts: [
          { type: 'tool_call', callId: 'c1', name: 'read', args: { path: 'a.ts' } },
          { type: 'tool_result', callId: 'c1', name: 'read', ok: true, summary: 'ok', output: 'x'.repeat(10_000) },
          { type: 'bogus' },
        ],
      },
    ])
    expect(messages?.[0].id).toBe('cli-abc:a1')
    expect(messages?.[0].parts).toHaveLength(2)
    const result = messages?.[0].parts?.[1]
    expect(result?.type === 'tool_result' && result.output?.length).toBe(4_000)
  })

  it('rejects bad batches', () => {
    expect(parseCliEntries('cli-abc', [])).toBeNull()
    expect(parseCliEntries('cli-abc', [{ id: 'x', role: 'system', content: 'hi' }])).toBeNull()
    expect(parseCliEntries('cli-abc', Array.from({ length: 51 }, (_, i) => ({ id: `u${i}`, role: 'user', content: 'hi' })))).toBeNull()
  })
})

describe('zq model names', () => {
  it('keeps premium models off the free plan', () => {
    expect(resolveZqModel('forge', 'free')?.model).toBe('qwen/qwen3-coder')
    expect(resolveZqModel('forge-best', 'free')).toBeNull()
    expect(listZqModels('free')).not.toContain('forge-best')
  })

  it('lets an admin override allow a premium model', () => {
    const best = resolveZqModel('forge-best', 'ultra')
    expect(best).not.toBeNull()
    expect(resolveZqModel('forge-best', 'free', { allowedModelOverrides: [best!.model] })).not.toBeNull()
  })
})

describe('OpenRouter usage', () => {
  it('splits cached tokens out of prompt tokens', () => {
    const usage = stepUsageFromOpenRouter({
      prompt_tokens: 1_000,
      completion_tokens: 50,
      cost: 0.002,
      prompt_tokens_details: { cached_tokens: 800, cache_write_tokens: 0 },
    })
    expect(usage).toMatchObject({ inputTokens: 200, cacheReadTokens: 800, outputTokens: 50, rawCostUsd: 0.002 })
  })
})
