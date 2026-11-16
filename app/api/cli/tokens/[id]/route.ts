import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedUser } from '@/lib/auth/session'
import { neonApiTokensRepository } from '@/lib/db/repositories'

export const runtime = 'nodejs'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response
  const { id } = await params
  const revoked = await neonApiTokensRepository.revoke(auth.user.id, id)
  if (!revoked) return NextResponse.json({ error: 'Token not found.' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
