import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import { isChatSharingEnabled } from '@/lib/config/features'
import {
  neonConversationSharesRepository,
  neonProfilesRepository,
} from '@/lib/db/repositories'
import { hitRateLimit } from '@/lib/security/rate-limit'
import {
  isValidConversationId,
  loadConversationShareSnapshot,
  MAX_ACTIVE_SHARES_PER_CHAT,
} from '@/lib/share/conversation-shares'
import { ConversationSharesResponse } from '@/types'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ id: string }>
}

function notFound() {
  return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 })
}

/** Lists the chat's live links and previews what a new link would show. */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response
  if (!isChatSharingEnabled()) return notFound()

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const { id } = await params
  if (!isValidConversationId(id)) return notFound()

  const result = await loadConversationShareSnapshot(auth.user.id, id)
  if (!result.ok && result.status === 404) return notFound()

  const shares = await neonConversationSharesRepository.listActive(auth.user.id, id)
  const body: ConversationSharesResponse = {
    shares,
    preview: result.ok
      ? {
          messageCount: result.build.messageCount,
          redactionCount: result.build.redactionCount,
          blockedReason: null,
        }
      : { messageCount: 0, redactionCount: 0, blockedReason: result.error },
  }

  const response = NextResponse.json(body)
  if (auth.session.refreshed) appendAuthCookies(response.headers, auth.session)
  return response
}

/** Makes a link to a snapshot of the chat as it is now. The request body is ignored. */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response
  if (!isChatSharingEnabled()) return notFound()

  if (!(await hitRateLimit(`chat-share:${auth.user.id}`, 30, 3_600))) {
    return NextResponse.json(
      { error: 'Too many share links in the last hour. Try again later.' },
      { status: 429 }
    )
  }

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const { id } = await params
  if (!isValidConversationId(id)) return notFound()

  const activeCount = await neonConversationSharesRepository.countActive(auth.user.id, id)
  if (activeCount >= MAX_ACTIVE_SHARES_PER_CHAT) {
    return NextResponse.json(
      {
        error: `This chat already has ${MAX_ACTIVE_SHARES_PER_CHAT} live links. Revoke one to make another.`,
      },
      { status: 409 }
    )
  }

  const result = await loadConversationShareSnapshot(auth.user.id, id)
  if (!result.ok) {
    return result.status === 404
      ? notFound()
      : NextResponse.json({ error: result.error }, { status: 400 })
  }

  const share = await neonConversationSharesRepository.create(auth.user.id, id, {
    title: result.build.snapshot.title,
    snapshot: result.build.snapshot,
    messageCount: result.build.messageCount,
    redactionCount: result.build.redactionCount,
  })

  const response = NextResponse.json({ share }, { status: 201 })
  if (auth.session.refreshed) appendAuthCookies(response.headers, auth.session)
  return response
}
