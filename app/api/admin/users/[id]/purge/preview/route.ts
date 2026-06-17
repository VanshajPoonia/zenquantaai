import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApiUser } from '@/lib/auth/require-admin'
import {
  neonAdminAuditLogsRepository,
} from '@/lib/db/repositories'
import { parseUserPurgeScope } from '@/lib/account/user-purge-utils'
import { previewUserPurge } from '@/lib/account/user-purge'

export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiUser(request)
  if ('response' in auth) return auth.response

  const { id } = await context.params
  if (id === auth.user.id) {
    return NextResponse.json(
      { error: 'Admins cannot purge their own account.' },
      { status: 400 }
    )
  }

  const body = (await request.json().catch(() => null)) as
    | { scope?: unknown }
    | null
  const scope = parseUserPurgeScope(body?.scope ?? 'full_account')
  const preview = await previewUserPurge({
    userId: id,
    scope,
    actor: 'admin',
  })

  if (!preview) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 })
  }

  await neonAdminAuditLogsRepository.create({
    adminUserId: auth.user.id,
    targetUserId: id,
    action: 'admin_user_purge_previewed',
    details: {
      scope,
      counts: preview.counts,
    },
  })

  return NextResponse.json({ preview })
}
