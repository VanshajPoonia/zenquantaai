import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonIntegrationsRepository,
  neonProfilesRepository,
} from '@/lib/db/repositories'
import { getGitHubInstallation } from '@/lib/integrations/github'

export const runtime = 'nodejs'

const STATE_COOKIE = 'zenquanta_github_install_state'

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  const { searchParams, origin } = new URL(request.url)
  const state = searchParams.get('state')
  const cookieState = request.cookies.get(STATE_COOKIE)?.value
  const installationId = searchParams.get('installation_id')

  if (!state || !cookieState || state !== cookieState) {
    return NextResponse.json(
      { error: 'Invalid GitHub installation state.' },
      { status: 400 }
    )
  }

  if (!installationId) {
    return NextResponse.json(
      { error: 'GitHub installation id is missing.' },
      { status: 400 }
    )
  }

  await neonProfilesRepository.ensureFromAuthUser(auth.user)

  const installation = await getGitHubInstallation(installationId)
  const account = installation.account ?? {}
  const permissions = installation.permissions ?? {}

  await neonIntegrationsRepository.upsertGitHubAccount(auth.user.id, {
    externalAccountId: String(account.id ?? installation.id),
    externalAccountLogin: account.login ?? null,
    externalAccountName: account.name ?? null,
    installationId,
    scopes: Object.entries(permissions).map(([key, value]) => `${key}:${value}`),
    syncState: {
      setupAction: searchParams.get('setup_action'),
      permissions,
    },
  })

  const response = NextResponse.redirect(new URL('/?github=connected', origin))
  response.cookies.set(STATE_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
    path: '/',
  })

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
