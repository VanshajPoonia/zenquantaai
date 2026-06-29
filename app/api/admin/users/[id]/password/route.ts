import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApiUser } from '@/lib/auth/require-admin'
import { setUserPasswordByAdmin } from '@/lib/auth/session'
import { neonAdminAuditLogsRepository } from '@/lib/db/repositories'

export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiUser(request)
  if ('response' in auth) return auth.response

  const { id } = await context.params

  const body = (await request.json().catch(() => null)) as
    | { password?: unknown }
    | null
  const password = typeof body?.password === 'string' ? body.password : ''

  if (password.length < 8) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters.' },
      { status: 400 }
    )
  }

  await setUserPasswordByAdmin(id, password)

  await neonAdminAuditLogsRepository.create({
    adminUserId: auth.user.id,
    targetUserId: id,
    action: 'admin_user_password_reset',
    details: {},
  })

  return NextResponse.json({
    ok: true,
    message: 'Password updated. The user’s existing sessions were signed out.',
  })
}
