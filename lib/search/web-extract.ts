const TAVILY_EXTRACT_URL = 'https://api.tavily.com/extract'
const MAX_PAGE_CHARS = 12_000

export interface ExtractedPage {
  url: string
  title: string
  content: string
}

export function hasWebExtractConfig(): boolean {
  return Boolean(process.env.TAVILY_API_KEY?.trim())
}

function isPublicHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

/**
 * Reads one public page through Tavily so our server never fetches arbitrary
 * URLs itself.
 */
export async function extractWebPage(url: string, signal?: AbortSignal): Promise<ExtractedPage> {
  const apiKey = process.env.TAVILY_API_KEY?.trim()
  if (!apiKey) throw new Error('Page reading is not configured.')
  if (!isPublicHttpUrl(url)) throw new Error('Only http and https links can be read.')

  const timeout = AbortSignal.timeout(15_000)
  const response = await fetch(TAVILY_EXTRACT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ urls: [url], extract_depth: 'basic', format: 'markdown' }),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  })

  if (!response.ok) throw new Error(`The page could not be read (${response.status}).`)

  const body = (await response.json().catch(() => null)) as {
    results?: Array<{ url?: string; title?: string; raw_content?: string }>
  } | null
  const result = body?.results?.[0]
  const content = result?.raw_content?.trim()
  if (!content) throw new Error('The page had no readable text.')

  return {
    url: result?.url ?? url,
    title: result?.title?.trim() || new URL(url).hostname,
    content: content.slice(0, MAX_PAGE_CHARS),
  }
}
