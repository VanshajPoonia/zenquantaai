import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApiUser } from '@/lib/auth/require-admin'
import {
  neonAdminAuditLogsRepository,
} from '@/lib/db/repositories'
import {
  executeUserPurge,
  UserPurgeConfirmationError,
  UserPurgeNotFoundError,
} from '@/lib/account/user-purge'
import { parseUserPurgeScope } from '@/lib/account/user-purge-utils'

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
    | { scope?: unknown; confirmation?: unknown }
    | null
  const scope = parseUserPurgeScope(body?.scope ?? 'full_account')

  try {
    const result = await executeUserPurge({
      userId: id,
      scope,
      confirmation: body?.confirmation,
      actor: 'admin',
    })

    await neonAdminAuditLogsRepository.create({
      adminUserId: auth.user.id,
      targetUserId: id,
      action: 'admin_user_purged',
      details: {
        scope,
        counts: result.counts,
        objectDeletion: result.objectDeletion,
        partialFailure: result.partialFailure,
      },
    })

    return NextResponse.json({ result })
  } catch (error) {
    if (
      error instanceof UserPurgeConfirmationError ||
      error instanceof UserPurgeNotFoundError
    ) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    throw error
  }
}
