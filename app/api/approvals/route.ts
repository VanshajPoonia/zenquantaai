import { NextRequest, NextResponse } from 'next/server'
import { isCliApprovalsEnabled } from '@/lib/agent/flags'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import type { PendingCliApprovalsResponse } from '@/lib/cli/approvals'
import { cliConversationId } from '@/lib/cli/session-sync'
import { neonCliApprovalsRepository } from '@/lib/db/repositories'
import { hitRateLimit } from '@/lib/security/rate-limit'

export const runtime = 'nodejs'

/** Pending zq approvals for the signed-in user. */
export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  if (!isCliApprovalsEnabled()) {
    const closed: PendingCliApprovalsResponse = {
      enabled: false,
      serverNow: new Date().toISOString(),
      latestCliActivityAt: null,
      approvals: [],
    }
    return NextResponse.json(closed)
  }
  // The web polls every 5 s per tab while zq is active.
  if (!(await hitRateLimit(`approvals-poll:${auth.user.id}`, 1_500, 3_600))) {
    return NextResponse.json({ error: 'Checking too often.' }, { status: 429 })
  }

  const [pending, latest] = await Promise.all([
    neonCliApprovalsRepository.listPending(auth.user.id),
    neonCliApprovalsRepository.latestCliActivity(auth.user.id),
  ])
  const body: PendingCliApprovalsResponse = {
    enabled: true,
    serverNow: new Date().toISOString(),
    latestCliActivityAt: latest?.toISOString() ?? null,
    approvals: pending.map((approval) => ({
      id: approval.id,
      conversationId: cliConversationId(auth.user.id, approval.sessionId),
      tool: approval.tool,
      title: approval.title,
      detail: approval.detail,
      createdAt: approval.createdAt.toISOString(),
      expiresAt: approval.expiresAt.toISOString(),
    })),
  }

  const response = NextResponse.json(body)
  if (auth.session.refreshed) appendAuthCookies(response.headers, auth.session)
  return response
}
