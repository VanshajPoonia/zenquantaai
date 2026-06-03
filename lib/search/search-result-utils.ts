import { SearchResult } from '@/types'

export const MIN_SEARCH_QUERY_LENGTH = 2
export const MAX_SEARCH_QUERY_LENGTH = 120
export const MAX_TOTAL_SEARCH_RESULTS = 50

export function normalizeSearchQuery(query: string): string {
  return query.replace(/\s+/g, ' ').trim().slice(0, MAX_SEARCH_QUERY_LENGTH)
}

export function searchQueryToIlikePattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, (match) => `\\${match}`)}%`
}

export function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

export function buildSearchSnippet(
  query: string,
  ...values: Array<string | null | undefined>
): string {
  const normalizedValues = values.map(normalizeSearchText).filter(Boolean)
  const normalizedQuery = query.toLowerCase()
  const matchingValue =
    normalizedValues.find((value) => value.toLowerCase().includes(normalizedQuery)) ??
    normalizedValues[0] ??
    ''

  if (!matchingValue) return ''

  const matchIndex = matchingValue.toLowerCase().indexOf(normalizedQuery)
  if (matchIndex === -1) {
    return matchingValue.length > 180
      ? `${matchingValue.slice(0, 177).trimEnd()}...`
      : matchingValue
  }

  const start = Math.max(0, matchIndex - 70)
  const end = Math.min(matchingValue.length, matchIndex + query.length + 110)
  const prefix = start > 0 ? '...' : ''
  const suffix = end < matchingValue.length ? '...' : ''

  return `${prefix}${matchingValue.slice(start, end).trim()}${suffix}`
}

export function sortSearchResults(results: SearchResult[]): SearchResult[] {
  return [...results]
    .sort((a, b) => {
      const aTime = new Date(a.updatedAt ?? a.createdAt).getTime()
      const bTime = new Date(b.updatedAt ?? b.createdAt).getTime()

      return bTime - aTime || a.title.localeCompare(b.title)
    })
    .slice(0, MAX_TOTAL_SEARCH_RESULTS)
}
