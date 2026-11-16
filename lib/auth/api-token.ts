import 'server-only'

import { NextResponse, type NextRequest } from 'next/server'
import {
  neonApiTokensRepository,
  neonProfilesRepository,
  neonUsersRepository,
  type ApiTokenScope,
} from '@/lib/db/repositories'
import type { AuthUser } from '@/types'

export function readBearerToken(request: Pick<NextRequest, 'headers'>): string | null {
  const header = request.headers.get('authorization') ?? ''
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim())
  return match?.[1] ?? null
}

/**
 * Authenticates `Authorization: Bearer zq_...`. Only `/api/v1/*` and
 * `/api/cli/*` routes call this; cookie routes never accept tokens.
 */
export async function requireApiTokenUser(
  request: Pick<NextRequest, 'headers'>,
  scope: ApiTokenScope
): Promise<
  | { user: AuthUser; tokenId: string; response?: never }
  | { response: NextResponse; user?: never; tokenId?: never }
> {
  const unauthorized = (message: string) => ({
    response: NextResponse.json(
      { error: { message, type: 'authentication_error', code: 'invalid_token' } },
      { status: 401 }
    ),
  })

  const token = readBearerToken(request)
  if (!token) return unauthorized('Sign in with `zq login` first.')

  const record = await neonApiTokensRepository.findActive(token)
  if (!record || !record.scopes.includes(scope)) {
    return unauthorized('This token is invalid, expired or revoked. Run `zq login` again.')
  }

  const userRecord = await neonUsersRepository.get(record.userId)
  if (!userRecord?.loginId) return unauthorized('This account no longer exists.')

  const user: AuthUser = {
    id: userRecord.id,
    loginId: userRecord.loginId,
    email: userRecord.email,
    role: userRecord.role,
  }
  const profile = await neonProfilesRepository.ensureFromAuthUser(user)
  return { user: { ...user, role: profile.role }, tokenId: record.id }
}
