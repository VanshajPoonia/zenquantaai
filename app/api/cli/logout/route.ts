import { NextRequest, NextResponse } from 'next/server'
import { requireApiTokenUser } from '@/lib/auth/api-token'
import { neonApiTokensRepository } from '@/lib/db/repositories'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const auth = await requireApiTokenUser(request, 'cli')
  if (auth.response) return auth.response
  await neonApiTokensRepository.revoke(auth.user.id, auth.tokenId)
  return NextResponse.json({ ok: true })
}
