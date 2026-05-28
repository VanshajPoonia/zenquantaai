import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonIntegrationsRepository,
  neonProfilesRepository,
  neonProjectsRepository,
} from '@/lib/db/repositories'
import { reimportGitHubProjectFiles } from '@/lib/integrations/github-import'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const body = (await request.json().catch(() => null)) as {
    projectId?: unknown
    itemIds?: unknown
  } | null
  const projectId = body?.projectId ? String(body.projectId) : ''
  const itemIds = Array.isArray(body?.itemIds)
    ? body.itemIds.map((id) => String(id)).filter(Boolean)
    : undefined

  if (!projectId) {
    return NextResponse.json({ error: 'Project id is required.' }, { status: 400 })
  }

  const project = await neonProjectsRepository.get(auth.user.id, projectId)
  if (!project) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
  }

  const account = await neonIntegrationsRepository.getGitHubAccount(auth.user.id)
  if (account?.status !== 'connected' || !account.installationId) {
    return NextResponse.json(
      { error: 'GitHub is not connected.' },
      { status: 400 }
    )
  }

  const result = await reimportGitHubProjectFiles({
    userId: auth.user.id,
    accountId: account.id,
    installationId: account.installationId,
    projectId,
    itemIds,
  })
  const response = NextResponse.json(result)

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
