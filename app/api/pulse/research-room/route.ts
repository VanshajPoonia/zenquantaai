import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonProfilesRepository,
  neonProjectsRepository,
  neonPulseResearchRepository,
} from '@/lib/db/repositories'
import { hasWebSearchConfig } from '@/lib/search/web-search'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)

  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('projectId')?.trim() || null
  const q = searchParams.get('q') ?? searchParams.get('query') ?? ''

  if (projectId) {
    const project = await neonProjectsRepository.get(auth.user.id, projectId)
    if (!project) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    }
  }

  const room = await neonPulseResearchRepository.getRoom(auth.user.id, {
    q,
    projectId,
    webSearchAvailable: hasWebSearchConfig(),
  })
  const response = NextResponse.json(room)

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
