import { describe, expect, it } from 'vitest'
import {
  buildSearchSnippet,
  MAX_TOTAL_SEARCH_RESULTS,
  MIN_SEARCH_QUERY_LENGTH,
  normalizeSearchQuery,
  searchQueryToIlikePattern,
  sortSearchResults,
} from '@/lib/search/search-result-utils'
import { SearchResult } from '@/types'

function result(input: Partial<SearchResult> & Pick<SearchResult, 'id' | 'title'>): SearchResult {
  return {
    entityType: 'project',
    snippet: '',
    url: '/',
    target: { type: 'open_project', projectId: input.id },
    projectId: input.id,
    conversationId: null,
    createdAt: '2026-06-01T00:00:00.000Z',
    ...input,
  }
}

describe('search result pure helpers', () => {
  it('normalizes query whitespace and preserves min-query semantics', () => {
    expect(normalizeSearchQuery('  hello    world  ')).toBe('hello world')
    expect(normalizeSearchQuery('a')).toHaveLength(MIN_SEARCH_QUERY_LENGTH - 1)
    expect(normalizeSearchQuery('x'.repeat(140))).toHaveLength(120)
  })

  it('escapes LIKE wildcards for Postgres ILIKE search', () => {
    expect(searchQueryToIlikePattern('100%_match\\path')).toBe('%100\\%\\_match\\\\path%')
  })

  it('builds snippets around the matching value', () => {
    expect(buildSearchSnippet('needle', null, 'No match', 'Find the needle in here')).toBe(
      'Find the needle in here'
    )
    expect(buildSearchSnippet('missing', 'x'.repeat(200))).toBe(
      `${'x'.repeat(177)}...`
    )
    expect(buildSearchSnippet('anything')).toBe('')
  })

  it('sorts by updated date and then title, capped to the global result limit', () => {
    const rows = Array.from({ length: MAX_TOTAL_SEARCH_RESULTS + 2 }, (_, index) =>
      result({
        id: `project_${index}`,
        title: `Project ${String(index).padStart(2, '0')}`,
        createdAt: '2026-06-01T00:00:00.000Z',
        updatedAt: `2026-06-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
      })
    )

    const sorted = sortSearchResults([
      result({
        id: 'tie_b',
        title: 'Beta',
        createdAt: '2026-06-30T00:00:00.000Z',
      }),
      result({
        id: 'tie_a',
        title: 'Alpha',
        createdAt: '2026-06-30T00:00:00.000Z',
      }),
      ...rows,
    ])

    expect(sorted).toHaveLength(MAX_TOTAL_SEARCH_RESULTS)
    expect(sorted[0]?.title).toBe('Alpha')
    expect(sorted[1]?.title).toBe('Beta')
  })
})
