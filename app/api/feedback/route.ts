import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  FeedbackEntityNotFoundError,
  neonFeedbackRepository,
  neonProfilesRepository,
} from '@/lib/db/repositories'
import { parseFeedbackSubmitRequest } from '@/lib/feedback/validation'
import { FeedbackSubmitResponse } from '@/types'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const body = await request.json().catch(() => null)
  const parsed = parseFeedbackSubmitRequest(body)

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  try {
    const feedback = await neonFeedbackRepository.create(
      auth.user.id,
      parsed.value
    )
    const response = NextResponse.json({ feedback } satisfies FeedbackSubmitResponse)

    if (auth.session.refreshed) {
      appendAuthCookies(response.headers, auth.session)
    }

    return response
  } catch (error) {
    if (error instanceof FeedbackEntityNotFoundError) {
      return NextResponse.json(
        { error: 'Feedback target not found.' },
        { status: 404 }
      )
    }

    throw error
  }
}
