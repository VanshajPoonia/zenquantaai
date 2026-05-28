import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonIntegrationsRepository,
  neonProfilesRepository,
} from '@/lib/db/repositories'
import { buildGitHubStatus } from '@/lib/integrations/github'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const account = await neonIntegrationsRepository.getGitHubAccount(auth.user.id)
  const response = NextResponse.json(buildGitHubStatus({ account }))

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const account = await neonIntegrationsRepository.disconnectGitHub(auth.user.id)
  const response = NextResponse.json(
    buildGitHubStatus({ account: account ?? null })
  )

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
