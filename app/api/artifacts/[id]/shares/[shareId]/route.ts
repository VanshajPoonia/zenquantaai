import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonArtifactSharesRepository,
  neonArtifactsRepository,
  neonProfilesRepository,
} from '@/lib/db/repositories'

export const runtime = 'nodejs'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; shareId: string }> }
) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const { id, shareId } = await params

  const artifact = await neonArtifactsRepository.get(auth.user.id, id)
  if (!artifact) {
    return NextResponse.json({ error: 'Artifact not found.' }, { status: 404 })
  }

  const revoked = await neonArtifactSharesRepository.revoke(auth.user.id, shareId)
  if (!revoked) {
    return NextResponse.json({ error: 'Share link not found.' }, { status: 404 })
  }

  const response = NextResponse.json({ ok: true })
  if (auth.session.refreshed) appendAuthCookies(response.headers, auth.session)
  return response
}
