import type { NextRequest } from 'next/server'

/** True when the browser reports another site sent the request. Cookie routes that act for the user refuse these. */
export function isCrossSiteRequest(request: Pick<NextRequest, 'headers' | 'nextUrl'>): boolean {
  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite && fetchSite !== 'same-origin') return true
  const origin = request.headers.get('origin')
  if (!origin) return false
  try {
    return new URL(origin).host !== request.nextUrl.host
  } catch {
    return true
  }
}
