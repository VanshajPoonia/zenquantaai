import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonArtifactsRepository,
  neonProfilesRepository,
} from '@/lib/db/repositories'
import { ArtifactVersionRestoreResponse } from '@/types'

export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const { id, versionId } = await params
  const result = await neonArtifactsRepository.restoreVersion(
    auth.user.id,
    id,
    versionId
  )

  if (!result) {
    return NextResponse.json(
      { error: 'Artifact version not found.' },
      { status: 404 }
    )
  }

  const body: ArtifactVersionRestoreResponse = result
  const response = NextResponse.json(body)

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
