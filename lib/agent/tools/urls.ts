const URL_PATTERN = /https?:\/\/[^\s<>"'`{}[\]]+/gi

/** A comparable form of an http(s) link: no fragment and no trailing slash. */
export function normalizeUrl(value: string): string | null {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    url.hash = ''
    return url.href.replace(/\/$/, '')
  } catch {
    return null
  }
}

function trimLinkEnd(value: string): string {
  let link = value.replace(/[.,;:!?*_]+$/, '')
  // Markdown wraps links in parentheses; keep a closing one only when the link opened it.
  while (link.endsWith(')') && link.split(')').length > link.split('(').length) {
    link = link.slice(0, -1).replace(/[.,;:!?*_]+$/, '')
  }
  return link
}

/** Adds every http(s) link found in the text to the set, normalized. */
export function collectUrls(text: string, into: Set<string>): void {
  for (const match of text.matchAll(URL_PATTERN)) {
    const normalized = normalizeUrl(trimLinkEnd(match[0]))
    if (normalized) into.add(normalized)
  }
}

/**
 * Links the page reader may open in this turn: what the user wrote and the
 * sources earlier steps returned. A link the model builds itself is refused.
 */
export function collectReadableUrls(
  messages: Array<{ role: string; content: string; sources?: Array<{ url: string }> }>,
  extraSources: Array<{ url: string }> = []
): Set<string> {
  const urls = new Set<string>()
  for (const message of messages) {
    if (message.role === 'user') collectUrls(message.content, urls)
    for (const source of message.sources ?? []) {
      const normalized = normalizeUrl(source.url)
      if (normalized) urls.add(normalized)
    }
  }
  for (const source of extraSources) {
    const normalized = normalizeUrl(source.url)
    if (normalized) urls.add(normalized)
  }
  return urls
}
