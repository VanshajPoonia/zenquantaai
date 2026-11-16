import { describe, expect, it, vi } from 'vitest'
import { cliConversationId, isValidCliSessionId, parseCliEntries } from '@/lib/cli/session-sync'
import { listZqModels, resolveZqModel } from '@/lib/agent/model-names'
import { stepUsageFromOpenRouter } from '@/lib/agent/openrouter-usage'
import { buildChargeEstimate, webSearchCharge } from '@/lib/agent/metering'

vi.mock('server-only', () => ({}))

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

  it('gives every plan the cheap zq models and paid plans forge-best', () => {
    expect(listZqModels('free')).toEqual(['forge', 'forge-fast', 'forge-lite'])
    expect(listZqModels('pro')).toEqual(['forge', 'forge-fast', 'forge-lite', 'forge-best'])
    expect(resolveZqModel('forge', 'pro')?.model).toBe('openai/gpt-5.3-codex')
    expect(resolveZqModel('forge-fast', 'ultra')?.walletType).toBe('core_tokens')
    expect(resolveZqModel('forge-best', 'ultra')?.walletType).toBe('tier_tokens')
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

describe('web search charge', () => {
  it('charges only when a search returned sources', () => {
    expect(webSearchCharge(undefined)).toBeNull()
    expect(webSearchCharge({ query: 'x', searchedAt: '', sources: [] })).toBeNull()
    const charge = webSearchCharge({
      query: 'x',
      searchedAt: '',
      sources: [{ id: '1', title: 't', url: 'https://a.b', domain: 'a.b', snippet: 's' }],
      costUsd: 0.007,
    })
    expect(charge).toEqual({ walletTokens: 8_000, rawCostUsd: 0.007 })
    const estimate = buildChargeEstimate({ tier: 'free', walletType: 'core_tokens', charge: charge! })
    expect(estimate.totalTokens).toBe(8_000)
    expect(estimate.displayedCostUsd).toBeCloseTo(0.014)
  })
})

