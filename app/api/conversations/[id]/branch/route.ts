import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  buildBranchConversation,
  MAX_BRANCH_MESSAGES,
  selectBranchMessages,
} from '@/lib/conversations/branch'
import {
  neonConversationRepository,
  neonProfilesRepository,
} from '@/lib/db/repositories'
import { hitRateLimit } from '@/lib/security/rate-limit'

export const runtime = 'nodejs'

function notFound(error = 'Conversation not found.') {
  return NextResponse.json({ error }, { status: 404 })
}

/** Copies the messages up to one message into a new chat. `before: true` stops just before it. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  if (!(await hitRateLimit(`chat-branch:${auth.user.id}`, 60, 3_600))) {
    return NextResponse.json(
      { error: 'Too many branches in the last hour. Try again later.' },
      { status: 429 }
    )
  }

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const { id } = await params
  if (!id || id.length > 200) return notFound()

  const body = (await request.json().catch(() => null)) as
    | { messageId?: unknown; before?: unknown }
    | null
  const messageId = typeof body?.messageId === 'string' ? body.messageId.trim() : ''
  if (!messageId || messageId.length > 200) {
    return NextResponse.json({ error: 'Pick a message to branch from.' }, { status: 400 })
  }

  const header = await neonConversationRepository.get(auth.user.id, id, { messageLimit: 1 })
  if (!header) return notFound()
  if (header.messageCount > MAX_BRANCH_MESSAGES) {
    return NextResponse.json(
      { error: `This chat has more than ${MAX_BRANCH_MESSAGES} messages, which is too long to branch.` },
      { status: 400 }
    )
  }

  const source = await neonConversationRepository.get(auth.user.id, id)
  if (!source) return notFound()

  const selection = selectBranchMessages(source.messages, messageId, { before: body?.before === true })
  if (!selection.ok) {
    return selection.reason === 'streaming'
      ? NextResponse.json({ error: 'Wait for the reply to finish, then branch.' }, { status: 409 })
      : notFound('Message not found.')
  }

  const branch = await neonConversationRepository.save(
    auth.user.id,
    buildBranchConversation(source, { messages: selection.messages, messageId })
  )

  const response = NextResponse.json(
    { conversation: { id: branch.id, title: branch.title, mode: branch.mode } },
    { status: 201 }
  )
  if (auth.session.refreshed) appendAuthCookies(response.headers, auth.session)
  return response
}
