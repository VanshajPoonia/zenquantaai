import { NextRequest, NextResponse } from 'next/server'
import { requireApiTokenUser } from '@/lib/auth/api-token'
import { cliConversationId, isValidCliSessionId, parseCliEntries } from '@/lib/cli/session-sync'
import { neonConversationRepository } from '@/lib/db/repositories'
import { hitRateLimit } from '@/lib/security/rate-limit'

export const runtime = 'nodejs'

/** Upserts a batch of session entries. Safe to resend: entries are keyed by id. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiTokenUser(request, 'cli')
  if (auth.response) return auth.response
  if (!(await hitRateLimit(`cli-sync:${auth.tokenId}`, 600, 3_600))) {
    return NextResponse.json({ error: 'Too many sync requests.' }, { status: 429 })
  }

  const { id } = await params
  if (!isValidCliSessionId(id)) {
    return NextResponse.json({ error: 'Invalid session id.' }, { status: 400 })
  }
  const conversationId = cliConversationId(auth.user.id, id)
  const body = (await request.json().catch(() => null)) as { entries?: unknown } | null
  const messages = parseCliEntries(conversationId, body?.entries)
  if (!messages) {
    return NextResponse.json({ error: 'Send 1 to 50 valid entries.' }, { status: 400 })
  }

  const saved = await neonConversationRepository.appendCliMessages(
    auth.user.id,
    conversationId,
    messages
  )
  if (!saved) return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
  return NextResponse.json({ ok: true, count: messages.length })
}
