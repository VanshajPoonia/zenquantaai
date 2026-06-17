import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser, appendAuthCookies } from '@/lib/auth/session'
import { neonProfilesRepository } from '@/lib/db/repositories'
import { parseUserPurgeScope } from '@/lib/account/user-purge-utils'
import { previewUserPurge } from '@/lib/account/user-purge'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const body = (await request.json().catch(() => null)) as
    | { scope?: unknown }
    | null
  const scope = parseUserPurgeScope(body?.scope)
  const preview = await previewUserPurge({
    userId: auth.user.id,
    scope,
    actor: 'user',
  })

  if (!preview) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 })
  }

  const response = NextResponse.json({ preview })
  if (auth.session.refreshed) appendAuthCookies(response.headers, auth.session)
  return response
}
