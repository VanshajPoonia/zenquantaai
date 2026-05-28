import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonIntegrationsRepository,
  neonProfilesRepository,
} from '@/lib/db/repositories'
import { listImportableRepositoryFiles } from '@/lib/integrations/github'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ owner: string; repo: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const account = await neonIntegrationsRepository.getGitHubAccount(auth.user.id)
  if (account?.status !== 'connected' || !account.installationId) {
    return NextResponse.json(
      { error: 'GitHub is not connected.' },
      { status: 400 }
    )
  }

  const { owner, repo } = await context.params
  const { searchParams } = new URL(request.url)
  const branch = searchParams.get('branch')?.trim() || null

  const payload = await listImportableRepositoryFiles({
    installationId: account.installationId,
    owner,
    repo,
    branch,
  })
  const response = NextResponse.json(payload)

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
