import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import { imageGenerationEventsStore } from '@/lib/storage'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  const history = await imageGenerationEventsStore.listByUser(auth.user.id)
  const headers = new Headers()

  if (auth.session.refreshed) {
    appendAuthCookies(headers, auth.session)
  }

  return NextResponse.json(
    {
      items: history.map((event) => ({
        id: event.id,
        prompt: event.prompt,
        model: event.model,
        imageCount: event.imageCount,
        imageCreditsConsumed: event.imageCreditsConsumed,
        displayedCostUsd: event.displayedCostUsd,
        outputUrls: event.outputUrls,
        createdAt: event.createdAt,
      })),
    },
    { headers }
  )
}
