import { NextRequest, NextResponse } from 'next/server'
import {
  appendAuthCookies,
  appendClearedAuthCookies,
  requireAuthenticatedUser,
} from '@/lib/auth/session'
import { neonProfilesRepository } from '@/lib/db/repositories'
import { executeUserPurge, UserPurgeConfirmationError } from '@/lib/account/user-purge'
import { parseUserPurgeScope } from '@/lib/account/user-purge-utils'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const body = (await request.json().catch(() => null)) as
    | { scope?: unknown; confirmation?: unknown }
    | null
  const scope = parseUserPurgeScope(body?.scope)

  try {
    const result = await executeUserPurge({
      userId: auth.user.id,
      scope,
      confirmation: body?.confirmation,
      actor: 'user',
    })

    const response = NextResponse.json({
      result,
      redirectTo: scope === 'full_account' ? '/?accountDeleted=1' : null,
    })
    if (scope === 'full_account') {
      appendClearedAuthCookies(response.headers)
    } else if (auth.session.refreshed) {
      appendAuthCookies(response.headers, auth.session)
    }
    return response
  } catch (error) {
    if (error instanceof UserPurgeConfirmationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    throw error
  }
}
