import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonArtifactSharesRepository,
  neonArtifactsRepository,
  neonProfilesRepository,
} from '@/lib/db/repositories'
import { ArtifactShareInput, ArtifactShareVisibility } from '@/types'

export const runtime = 'nodejs'

const VALID_VISIBILITIES = new Set<ArtifactShareVisibility>([
  'public_link',
  'private_link',
])

function normalizeShareInput(body: unknown): ArtifactShareInput | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {}
  const raw = body as Record<string, unknown>

  const visibility =
    typeof raw.visibility === 'string' && VALID_VISIBILITIES.has(raw.visibility as ArtifactShareVisibility)
      ? (raw.visibility as ArtifactShareVisibility)
      : undefined

  let expiresAt: string | null | undefined = undefined
  if (raw.expiresAt === null) {
    expiresAt = null
  } else if (typeof raw.expiresAt === 'string' && !Number.isNaN(Date.parse(raw.expiresAt))) {
    expiresAt = raw.expiresAt
  }

  return { visibility, expiresAt }
}

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

  const shares = await neonArtifactSharesRepository.list(auth.user.id, id)
  const response = NextResponse.json(shares)
  if (auth.session.refreshed) appendAuthCookies(response.headers, auth.session)
  return response
}

export async function POST(
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

  const body = await request.json().catch(() => null)
  const input = normalizeShareInput(body)
  if (input === null) {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const share = await neonArtifactSharesRepository.create(auth.user.id, id, input)
  const response = NextResponse.json(share, { status: 201 })
  if (auth.session.refreshed) appendAuthCookies(response.headers, auth.session)
  return response
}
