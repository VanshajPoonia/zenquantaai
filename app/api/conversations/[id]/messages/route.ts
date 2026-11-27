import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonConversationRepository,
  neonProfilesRepository,
} from '@/lib/db/repositories'

export const runtime = 'nodejs'

function parseLimit(value: string | null): number {
  if (!value) return 80
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 80
  return Math.max(1, Math.min(200, Math.floor(parsed)))
}

function parseDateParam(value: string | null): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  const { id } = await params
  const limit = parseLimit(request.nextUrl.searchParams.get('limit'))
  const after = parseDateParam(request.nextUrl.searchParams.get('after'))
  // Live polls run every few seconds, so they skip the profile sync the workspace already ran.
  if (!after) await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const page = after
    ? await neonConversationRepository.listMessagesAfter(auth.user.id, id, { after, limit })
    : await neonConversationRepository.listMessagesPage(auth.user.id, id, {
        limit,
        before: parseDateParam(request.nextUrl.searchParams.get('before')),
      })

  if (!page) {
    return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 })
  }

  const response = NextResponse.json(page)

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
