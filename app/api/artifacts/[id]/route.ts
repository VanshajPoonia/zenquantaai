import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  ArtifactReferenceNotFoundError,
  neonArtifactsRepository,
  neonProfilesRepository,
} from '@/lib/db/repositories'
import { normalizeArtifactPatch } from '@/lib/artifacts/validation'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const { id } = await params
  const artifact = await neonArtifactsRepository.get(auth.user.id, id)

  if (!artifact) {
    return NextResponse.json({ error: 'Artifact not found.' }, { status: 404 })
  }

  const response = NextResponse.json(artifact)

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const { id } = await params
  const body = await request.json().catch(() => null)
  const normalized = normalizeArtifactPatch(body)

  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.error }, { status: 400 })
  }

  try {
    const artifact = await neonArtifactsRepository.update(
      auth.user.id,
      id,
      normalized.patch
    )

    if (!artifact) {
      return NextResponse.json({ error: 'Artifact not found.' }, { status: 404 })
    }

    const response = NextResponse.json(artifact)

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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const { id } = await params
  const deleted = await neonArtifactsRepository.delete(auth.user.id, id)

  if (!deleted) {
    return NextResponse.json({ error: 'Artifact not found.' }, { status: 404 })
  }

  const response = NextResponse.json({ ok: true })

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
