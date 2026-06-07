import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  ArtifactReferenceNotFoundError,
  neonArtifactsRepository,
  neonProfilesRepository,
  neonProjectsRepository,
} from '@/lib/db/repositories'
import {
  isArtifactSourceType,
  isArtifactType,
  normalizeArtifactInput,
} from '@/lib/artifacts/validation'

export const runtime = 'nodejs'

function parseLimit(value: string | null): number | null {
  if (!value) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return Math.max(1, Math.min(100, Math.floor(parsed)))
}

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)

  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('projectId')?.trim() || null
  const artifactType = searchParams.get('artifactType')
  const sourceType = searchParams.get('sourceType')

  if (projectId) {
    const project = await neonProjectsRepository.get(auth.user.id, projectId)
    if (!project) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    }
  }

  const artifacts = await neonArtifactsRepository.list(auth.user.id, {
    projectId,
    q: searchParams.get('q') ?? searchParams.get('query') ?? '',
    artifactType: isArtifactType(artifactType) ? artifactType : null,
    sourceType: isArtifactSourceType(sourceType) ? sourceType : null,
    limit: parseLimit(searchParams.get('limit')),
    beforeUpdatedAt:
      searchParams.get('beforeUpdatedAt') ?? searchParams.get('before') ?? null,
  })
  const response = NextResponse.json(artifacts)

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const body = await request.json().catch(() => null)
  const normalized = normalizeArtifactInput(body)

  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.error }, { status: 400 })
  }

  try {
    const artifact = await neonArtifactsRepository.create(
      auth.user.id,
      normalized.input
    )
    const response = NextResponse.json(artifact, { status: 201 })

    if (auth.session.refreshed) {
      appendAuthCookies(response.headers, auth.session)
    }

    return response
  } catch (error) {
    if (error instanceof ArtifactReferenceNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    throw error
  }
}
