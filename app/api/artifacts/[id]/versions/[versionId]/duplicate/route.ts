import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonArtifactsRepository,
  neonProfilesRepository,
} from '@/lib/db/repositories'
import { ArtifactVersionDuplicateResponse } from '@/types'

export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const { id, versionId } = await params
  const artifact = await neonArtifactsRepository.duplicateVersion(
    auth.user.id,
    id,
    versionId
  )

  if (!artifact) {
    return NextResponse.json(
      { error: 'Artifact version not found.' },
      { status: 404 }
    )
  }

  const body: ArtifactVersionDuplicateResponse = { artifact }
  const response = NextResponse.json(body, { status: 201 })

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
