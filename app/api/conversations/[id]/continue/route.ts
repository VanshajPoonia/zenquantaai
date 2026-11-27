import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonConversationRepository,
  neonProfilesRepository,
} from '@/lib/db/repositories'
import { parseRenderedSummary } from '@/lib/ai/memory-summary'

export const runtime = 'nodejs'

const MAX_CONVERSATION_ID_LENGTH = 200

// Starts a new chat in the same project and assistant that carries the source's summary.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const { id } = await params
  const source =
    id && id.length <= MAX_CONVERSATION_ID_LENGTH
      ? await neonConversationRepository.get(auth.user.id, id, { messageLimit: 1 })
      : null

  if (!source) {
    return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 })
  }

  if (source.surface === 'cli') {
    return NextResponse.json(
      { error: 'Terminal sessions continue in zq, not here.' },
      { status: 400 }
    )
  }

  if (!source.memorySummary?.trim()) {
    return NextResponse.json(
      { error: 'This chat has no summary yet. It is available after a longer chat.' },
      { status: 400 }
    )
  }

  const conversation = await neonConversationRepository.createContinuation(auth.user.id, {
    source,
    memorySummaryStructured:
      source.memorySummaryStructured ?? parseRenderedSummary(source.memorySummary),
  })

  const response = NextResponse.json(conversation, { status: 201 })

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
