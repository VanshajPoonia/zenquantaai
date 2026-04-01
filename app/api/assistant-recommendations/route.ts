import { NextRequest, NextResponse } from 'next/server'
import {
  appendAuthCookies,
  requireAuthenticatedUser,
} from '@/lib/auth/session'
import { assistantRecommendationEventsStore } from '@/lib/storage'
import {
  AssistantRecommendationEvent,
  RecommendationOutcome,
} from '@/types'

export const runtime = 'nodejs'

interface RecommendationEventBody {
  conversationId?: string | null
  currentAssistant?: AssistantRecommendationEvent['currentAssistant']
  recommendedAssistant?: AssistantRecommendationEvent['recommendedAssistant']
  confidence?: number
  matchedSignals?: string[]
  reason?: string
  outcome?: RecommendationOutcome
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  const body = (await request.json().catch(() => null)) as RecommendationEventBody | null

  if (
    !body?.currentAssistant ||
    !body.recommendedAssistant ||
    typeof body.confidence !== 'number' ||
    !body.reason ||
    !body.outcome
  ) {
    return NextResponse.json(
      { error: 'Recommendation event payload is incomplete.' },
      { status: 400 }
    )
  }

  const event = await assistantRecommendationEventsStore.create({
    userId: auth.user.id,
    conversationId: body.conversationId ?? null,
    currentAssistant: body.currentAssistant,
    recommendedAssistant: body.recommendedAssistant,
    confidence: body.confidence,
    matchedSignals: body.matchedSignals ?? [],
    reason: body.reason,
    outcome: body.outcome,
  })

  const response = NextResponse.json(event)

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
