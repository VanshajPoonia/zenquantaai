import { NextRequest, NextResponse } from 'next/server'
import {
  appendAuthCookies,
  requireAuthenticatedUser,
} from '@/lib/auth/session'
import {
  neonConversationRepository,
  neonModelComparisonsRepository,
  neonProfilesRepository,
} from '@/lib/db/repositories'
import { completeConversationWithAssistant } from '@/lib/ai/chat'
import { createMessage } from '@/lib/utils/chat'

export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response
  await neonProfilesRepository.ensureFromAuthUser(auth.user)

  const { id } = await params
  const body = (await request.json().catch(() => null)) as
    | { candidateId?: string }
    | null
  const candidateId = body?.candidateId

  if (!candidateId) {
    return NextResponse.json(
      { error: 'candidateId is required.' },
      { status: 400 }
    )
  }

  const comparison = await neonModelComparisonsRepository.get(auth.user.id, id)
  if (!comparison) {
    return NextResponse.json({ error: 'Comparison not found.' }, { status: 404 })
  }

  if (comparison.selectedCandidateId) {
    return NextResponse.json(
      { error: 'A response has already been saved for this comparison.' },
      { status: 400 }
    )
  }

  const candidate = comparison.candidates.find((item) => item.id === candidateId)
  if (!candidate || candidate.status !== 'complete' || !candidate.content.trim()) {
    return NextResponse.json(
      { error: 'Candidate response not found.' },
      { status: 404 }
    )
  }

  const conversation = await neonConversationRepository.get(
    auth.user.id,
    comparison.conversationId
  )

  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 })
  }

  const assistantMessage = createMessage({
    role: 'assistant',
    content: '',
    mode: candidate.mode,
    status: 'complete',
    model: candidate.model,
    provider: 'openrouter',
    parentUserMessageId: comparison.promptMessageId,
    branchLabel: `Selected from ${comparison.candidates.length}-way comparison`,
  })
  const completedConversation = await completeConversationWithAssistant(
    conversation,
    {
      ...assistantMessage,
      assistantFamily: candidate.assistantFamily,
    },
    candidate.content,
    conversation,
    candidate.mode,
    {
      action: 'send',
      usageOverride: candidate.usage,
      sources: candidate.sources,
    }
  )
  const savedConversation = await neonConversationRepository.save(
    auth.user.id,
    completedConversation
  )
  const savedComparison = await neonModelComparisonsRepository.selectCandidate(
    auth.user.id,
    comparison.id,
    candidate.id
  )
  const response = NextResponse.json({
    comparison: savedComparison,
    conversation: savedConversation,
  })

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
