import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import { isChatSharingEnabled } from '@/lib/config/features'
import {
  neonConversationRepository,
  neonConversationSharesRepository,
  neonProfilesRepository,
} from '@/lib/db/repositories'
import { isUuid, isValidConversationId } from '@/lib/share/conversation-shares'

export const runtime = 'nodejs'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; shareId: string }> }
) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response
  if (!isChatSharingEnabled()) {
    return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 })
  }

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const { id, shareId } = await params

  const conversation = isValidConversationId(id)
    ? await neonConversationRepository.get(auth.user.id, id, { messageLimit: 1 })
    : null
  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 })
  }

  const revoked =
    isUuid(shareId) &&
    (await neonConversationSharesRepository.revoke(auth.user.id, id, shareId))
  if (!revoked) {
    return NextResponse.json({ error: 'Share link not found.' }, { status: 404 })
  }

  const response = NextResponse.json({ ok: true })
  if (auth.session.refreshed) appendAuthCookies(response.headers, auth.session)
  return response
}
