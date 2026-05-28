import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonIntegrationsRepository,
  neonProfilesRepository,
} from '@/lib/db/repositories'
import { listInstallationRepositories } from '@/lib/integrations/github'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
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

  const repositories = await listInstallationRepositories(account.installationId)
  const response = NextResponse.json({ repositories })

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
