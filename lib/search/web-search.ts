import 'server-only'

import { AIMode, SessionSettings, WebSearchContext, WebSearchSource } from '@/types'

const TAVILY_SEARCH_URL = 'https://api.tavily.com/search'
const DEFAULT_MAX_RESULTS = 5
const MAX_ALLOWED_RESULTS = 8
const MAX_QUERY_LENGTH = 240
const MAX_TITLE_LENGTH = 140
const MAX_SNIPPET_LENGTH = 700

type TavilySearchResult = {
  title?: unknown
  url?: unknown
  content?: unknown
  score?: unknown
  published_date?: unknown
}

type TavilySearchResponse = {
  results?: unknown
}

function normalizeText(input: unknown): string {
  if (typeof input !== 'string') return ''

  return input
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncateText(input: string, maxLength: number): string {
  if (input.length <= maxLength) return input
  return `${input.slice(0, maxLength - 1).trimEnd()}...`
}

function toSafeHttpUrl(input: unknown): URL | null {
  if (typeof input !== 'string') return null

  try {
    const url = new URL(input)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    url.hash = ''
    return url
  } catch {
    return null
  }
}

function getDomain(url: URL): string {
  return url.hostname.replace(/^www\./i, '')
}

function getMaxResults(): number {
  const parsed = Number.parseInt(process.env.WEB_SEARCH_MAX_RESULTS ?? '', 10)

  if (!Number.isFinite(parsed)) return DEFAULT_MAX_RESULTS

  return Math.min(MAX_ALLOWED_RESULTS, Math.max(1, parsed))
}

function tavilyApiKey(): string | null {
  const key = process.env.TAVILY_API_KEY?.trim()
  return key || null
}

function toSource(
  result: TavilySearchResult,
  index: number
): WebSearchSource | null {
  const safeUrl = toSafeHttpUrl(result.url)
  if (!safeUrl) return null

  const domain = getDomain(safeUrl)
  const title =
    truncateText(normalizeText(result.title), MAX_TITLE_LENGTH) || domain
  const snippet = truncateText(normalizeText(result.content), MAX_SNIPPET_LENGTH)

  if (!snippet) return null

  const score =
    typeof result.score === 'number' && Number.isFinite(result.score)
      ? result.score
      : undefined
  const publishedAt =
    typeof result.published_date === 'string' && result.published_date.trim()
      ? result.published_date.trim()
      : undefined

  return {
    id: String(index + 1),
    title,
    url: safeUrl.toString(),
    domain,
    snippet,
    kind: 'web',
    score,
    publishedAt,
  }
}

function normalizeSources(results: unknown): WebSearchSource[] {
  if (!Array.isArray(results)) return []

  const seenUrls = new Set<string>()
  const sources: WebSearchSource[] = []

  for (const result of results) {
    if (!result || typeof result !== 'object') continue

    const source = toSource(result as TavilySearchResult, sources.length)
    if (!source) continue

    const dedupeKey = source.url.toLowerCase()
    if (seenUrls.has(dedupeKey)) continue

    seenUrls.add(dedupeKey)
    sources.push(source)
  }

  return sources
}

export function shouldUseWebSearch(
  mode: AIMode,
  settings: SessionSettings
): boolean {
  return mode === 'live' || settings.webSearch
}

export function buildWebSearchQuery(content: string): string {
  return truncateText(normalizeText(content), MAX_QUERY_LENGTH)
}

export function hasWebSearchConfig(): boolean {
  return Boolean(tavilyApiKey())
}

export function createUnavailableWebSearchContext(
  query: string,
  unavailableReason: NonNullable<WebSearchContext['unavailableReason']>
): WebSearchContext {
  return {
    query,
    searchedAt: new Date().toISOString(),
    sources: [],
    unavailableReason,
  }
}

export async function searchWebForContext(query: string): Promise<WebSearchContext> {
  const normalizedQuery = buildWebSearchQuery(query)

  if (!normalizedQuery) {
    return createUnavailableWebSearchContext(query, 'no_results')
  }

  const apiKey = tavilyApiKey()
  if (!apiKey) {
    return createUnavailableWebSearchContext(normalizedQuery, 'not_configured')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)

  try {
    const response = await fetch(TAVILY_SEARCH_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: normalizedQuery,
        search_depth: 'basic',
        max_results: getMaxResults(),
        include_answer: false,
        include_raw_content: false,
        include_images: false,
        auto_parameters: false,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      return createUnavailableWebSearchContext(normalizedQuery, 'request_failed')
    }

    const body = (await response.json().catch(() => null)) as
      | TavilySearchResponse
      | null
    const sources = normalizeSources(body?.results)

    if (sources.length === 0) {
      return createUnavailableWebSearchContext(normalizedQuery, 'no_results')
    }

    return {
      query: normalizedQuery,
      searchedAt: new Date().toISOString(),
      sources,
    }
  } catch {
    return createUnavailableWebSearchContext(normalizedQuery, 'request_failed')
  } finally {
    clearTimeout(timeout)
  }
}
