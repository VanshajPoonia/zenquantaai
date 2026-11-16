import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth/session'
import { neonApiTokensRepository } from '@/lib/db/repositories'

export const runtime = 'nodejs'

/** Lists the signed-in user's terminal tokens for Settings. Never returns token values. */
export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response
  const tokens = await neonApiTokensRepository.listForUser(auth.user.id)
  return NextResponse.json({
    tokens: tokens.map(({ id, name, prefix, createdAt, lastUsedAt, expiresAt }) => ({
      id,
      name,
      prefix,
      createdAt,
      lastUsedAt,
      expiresAt,
    })),
  })
}
