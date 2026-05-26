import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonProfilesRepository,
  neonProjectsRepository,
  neonSearchRepository,
} from '@/lib/db/repositories'
import { SearchResponse } from '@/types'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)

  const { searchParams } = new URL(request.url)
  const query = (searchParams.get('q') ?? searchParams.get('query') ?? '').trim()
  const projectId = searchParams.get('projectId')?.trim() || null
  const project = projectId
    ? await neonProjectsRepository.get(auth.user.id, projectId)
    : null

  if (projectId && !project) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
  }

  const results = await neonSearchRepository.search(auth.user.id, query, {
    projectId,
  })
  const response = NextResponse.json({
    query,
    scope: projectId ? 'project' : 'global',
    project: project ? { id: project.id, name: project.name } : null,
    results,
  } satisfies SearchResponse)

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
