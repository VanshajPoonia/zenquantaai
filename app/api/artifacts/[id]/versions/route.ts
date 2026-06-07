import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonArtifactsRepository,
  neonProfilesRepository,
} from '@/lib/db/repositories'
import { ArtifactVersionListResponse } from '@/types'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const { id } = await params
  const versions = await neonArtifactsRepository.listVersions(auth.user.id, id)

  if (!versions) {
    return NextResponse.json({ error: 'Artifact not found.' }, { status: 404 })
  }

  const body: ArtifactVersionListResponse = {
    artifactId: id,
    versions,
  }
  const response = NextResponse.json(body)

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
