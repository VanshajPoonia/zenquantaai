import { NextRequest, NextResponse } from 'next/server'
import { isCliApprovalsEnabled } from '@/lib/agent/flags'
import { requireApiTokenUser } from '@/lib/auth/api-token'
import { parseApprovalInput } from '@/lib/cli/approval-requests'
import { neonCliApprovalsRepository } from '@/lib/db/repositories'
import { hitRateLimit } from '@/lib/security/rate-limit'

export const runtime = 'nodejs'

/** zq asks the web to answer a permission prompt. The terminal prompt stays open too. */
export async function POST(request: NextRequest) {
  const auth = await requireApiTokenUser(request, 'cli')
  if (auth.response) return auth.response
  if (!isCliApprovalsEnabled()) {
    return NextResponse.json({ error: 'Web approvals are not open yet.' }, { status: 404 })
  }
  if (!(await hitRateLimit(`cli-approval-create:${auth.tokenId}`, 120, 3_600))) {
    return NextResponse.json({ error: 'Too many web approvals. Answer in the terminal.' }, { status: 429 })
  }

  const input = parseApprovalInput(await request.json().catch(() => null))
  if (!input) {
    return NextResponse.json(
      { error: 'Send a sessionId, a tool, a title up to 200 characters and a detail up to 4,000.' },
      { status: 400 }
    )
  }

  const created = await neonCliApprovalsRepository.create({
    userId: auth.user.id,
    tokenId: auth.tokenId,
    ...input,
  })
  return NextResponse.json(
    { id: created.id, expiresAt: created.expiresAt.toISOString() },
    { status: 201 }
  )
}
