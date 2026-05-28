import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonProfilesRepository,
  neonProjectHomeRepository,
  neonProjectsRepository,
  neonSettingsRepository,
} from '@/lib/db/repositories'
import { hasEmbeddingConfig } from '@/lib/rag/embeddings'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const { id } = await params

  await neonProjectsRepository.list(auth.user.id)
  const settings = await neonSettingsRepository.get(auth.user.id)
  const projectHome = await neonProjectHomeRepository.get(auth.user.id, id, {
    webSearchEnabled:
      settings.defaultMode === 'live' || settings.sessionDefaults.webSearch,
    embeddingsAvailable: hasEmbeddingConfig(),
  })

  if (!projectHome) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
  }

  const response = NextResponse.json(projectHome)

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
