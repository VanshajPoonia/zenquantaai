import { NextRequest, NextResponse } from 'next/server'
import {
  appendAuthCookies,
  requireAuthenticatedUser,
} from '@/lib/auth/session'
import {
  neonAssistantRecommendationEventsRepository,
  neonProfilesRepository,
} from '@/lib/db/repositories'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const summary =
    await neonAssistantRecommendationEventsRepository.getPersonalizationSummary(
      auth.user.id
    )
  const response = NextResponse.json(summary)

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
