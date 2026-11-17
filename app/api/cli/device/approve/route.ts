import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth/session'
import { neonDeviceCodesRepository, normalizeUserCode } from '@/lib/db/repositories'
import { hitRateLimit } from '@/lib/security/rate-limit'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response
  if (!(await hitRateLimit(`cli-approve:${auth.user.id}`, 20, 3_600))) {
    return NextResponse.json(
      { error: 'Too many login codes tried. Wait an hour and run `zq login` again.' },
      { status: 429 }
    )
  }

  const body = (await request.json().catch(() => null)) as {
    userCode?: unknown
    approve?: unknown
  } | null
  const userCode = typeof body?.userCode === 'string' ? normalizeUserCode(body.userCode) : ''
  if (!userCode || typeof body?.approve !== 'boolean') {
    return NextResponse.json({ error: 'A login code and a decision are required.' }, { status: 400 })
  }

  const updated = await neonDeviceCodesRepository.decide({
    userCode,
    userId: auth.user.id,
    approve: body.approve,
  })
  if (!updated) {
    return NextResponse.json(
      { error: 'This code has expired or was already used. Run `zq login` again.' },
      { status: 404 }
    )
  }
  return NextResponse.json({ ok: true })
}
