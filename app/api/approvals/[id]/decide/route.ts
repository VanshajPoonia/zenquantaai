import { NextRequest, NextResponse } from 'next/server'
import { isCliApprovalsEnabled } from '@/lib/agent/flags'
import { requireAuthenticatedUser } from '@/lib/auth/session'
import { isApprovalId, parseApprovalDecision } from '@/lib/cli/approval-requests'
import { neonCliApprovalsRepository } from '@/lib/db/repositories'
import { hitRateLimit } from '@/lib/security/rate-limit'
import { isCrossSiteRequest } from '@/lib/security/same-origin'

export const runtime = 'nodejs'

const notFound = () => NextResponse.json({ error: 'Approval not found.' }, { status: 404 })

/** Approves a zq prompt once, or denies it. Only a pending, unexpired approval can be decided. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response
  if (isCrossSiteRequest(request)) {
    return NextResponse.json({ error: 'Answer from the Zenquanta app.' }, { status: 403 })
  }
  if (!isCliApprovalsEnabled()) return notFound()
  if (!(await hitRateLimit(`approvals-decide:${auth.user.id}`, 120, 3_600))) {
    return NextResponse.json({ error: 'Too many answers. Wait a little.' }, { status: 429 })
  }

  const { id } = await params
  if (!isApprovalId(id)) return notFound()
  const decision = parseApprovalDecision(await request.json().catch(() => null))
  if (!decision) {
    return NextResponse.json({ error: 'Decision must be approve or deny.' }, { status: 400 })
  }

  const result = await neonCliApprovalsRepository.decide(auth.user.id, id, decision === 'approve')
  if (result.ok) {
    return NextResponse.json({ ok: true, status: decision === 'approve' ? 'approved' : 'denied' })
  }
  if (!result.status) return notFound()
  return NextResponse.json(
    {
      error:
        result.status === 'expired'
          ? 'This request expired. Answer it in the terminal.'
          : 'This request was already answered.',
      status: result.status,
    },
    { status: 409 }
  )
}
