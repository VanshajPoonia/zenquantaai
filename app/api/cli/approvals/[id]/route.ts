import { NextRequest, NextResponse } from 'next/server'
import { isCliApprovalsEnabled } from '@/lib/agent/flags'
import { requireApiTokenUser } from '@/lib/auth/api-token'
import { isApprovalId, parseApprovalClose } from '@/lib/cli/approval-requests'
import { neonCliApprovalsRepository } from '@/lib/db/repositories'
import { hitRateLimit } from '@/lib/security/rate-limit'

export const runtime = 'nodejs'

const notFound = () => NextResponse.json({ error: 'Approval not found.' }, { status: 404 })

/** zq polls its own approval for the web's answer. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiTokenUser(request, 'cli')
  if (auth.response) return auth.response
  if (!isCliApprovalsEnabled()) return notFound()
  // zq polls every 2 s for at most 10 minutes per prompt.
  if (!(await hitRateLimit(`cli-approval-poll:${auth.tokenId}`, 2_400, 3_600))) {
    return NextResponse.json({ error: 'Polling too fast.' }, { status: 429 })
  }

  const { id } = await params
  if (!isApprovalId(id)) return notFound()
  const approval = await neonCliApprovalsRepository.getForToken(auth.user.id, auth.tokenId, id)
  if (!approval) return notFound()
  return NextResponse.json({
    id: approval.id,
    status: approval.status,
    decidedAt: approval.decidedAt?.toISOString() ?? null,
  })
}

/** zq closes the approval when the terminal answered first or it stopped waiting. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiTokenUser(request, 'cli')
  if (auth.response) return auth.response
  if (!isCliApprovalsEnabled()) return notFound()
  if (!(await hitRateLimit(`cli-approval-close:${auth.tokenId}`, 240, 3_600))) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
  }

  const { id } = await params
  if (!isApprovalId(id)) return notFound()
  const status = parseApprovalClose(await request.json().catch(() => null))
  if (!status) {
    return NextResponse.json({ error: 'Status must be answered_locally or expired.' }, { status: 400 })
  }

  const result = await neonCliApprovalsRepository.closeForToken(auth.user.id, auth.tokenId, id, status)
  if (result.ok) return NextResponse.json({ ok: true, status })
  if (!result.status) return notFound()
  return NextResponse.json(
    { error: 'This approval was already answered.', status: result.status },
    { status: 409 }
  )
}
