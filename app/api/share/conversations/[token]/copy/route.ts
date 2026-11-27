import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import { createSessionSettings } from '@/lib/config'
import { isChatSharingEnabled } from '@/lib/config/features'
import {
  neonConversationRepository,
  neonConversationSharesRepository,
  neonProfilesRepository,
  neonSettingsRepository,
} from '@/lib/db/repositories'
import { hitRateLimit } from '@/lib/security/rate-limit'
import { isValidShareToken } from '@/lib/share/conversation-shares'
import { buildConversationFromShare } from '@/lib/share/copy'
import { toShareMode } from '@/lib/share/snapshot'

export const runtime = 'nodejs'

/** Copies a shared chat into the signed-in visitor's workspace as a new web chat. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  const { token } = await params
  if (!isChatSharingEnabled() || !isValidShareToken(token)) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  if (!(await hitRateLimit(`chat-share-copy:${auth.user.id}`, 30, 3_600))) {
    return NextResponse.json(
      { error: 'Too many copied chats in the last hour. Try again later.' },
      { status: 429 }
    )
  }

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const shared = await neonConversationSharesRepository.getPublicByToken(token)
  if (!shared) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  const settings = await neonSettingsRepository.get(auth.user.id)
  const draft = buildConversationFromShare(
    shared.snapshot,
    createSessionSettings(toShareMode(shared.snapshot.mode), settings.sessionDefaults)
  )
  const conversation = await neonConversationRepository.save(auth.user.id, draft)

  const response = NextResponse.json(
    { conversation: { id: conversation.id, title: conversation.title } },
    { status: 201 }
  )
  if (auth.session.refreshed) appendAuthCookies(response.headers, auth.session)
  return response
}
