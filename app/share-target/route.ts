import { NextRequest } from 'next/server'
import { buildSharedPrompt } from '@/lib/pwa/launch-params'

/** The installed app's share sheet lands here. What was shared becomes a draft in a new chat, never a sent message. */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const prompt = buildSharedPrompt({
    title: params.get('title'),
    text: params.get('text'),
    url: params.get('url'),
  })
  const next = new URLSearchParams({ new: '1' })
  if (prompt) next.set('prompt', prompt)
  return new Response(null, {
    status: 303,
    headers: { Location: `/?${next.toString()}`, 'Cache-Control': 'no-store' },
  })
}
