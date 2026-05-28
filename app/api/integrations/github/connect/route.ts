import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  getGitHubAppConfig,
  getGitHubAppSlug,
} from '@/lib/integrations/github'

export const runtime = 'nodejs'

const STATE_COOKIE = 'zenquanta_github_install_state'

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  const { configured, missing } = getGitHubAppConfig()
  if (!configured) {
    return NextResponse.json(
      {
        error: 'GitHub App is not configured.',
        missingConfiguration: missing,
      },
      { status: 400 }
    )
  }

  const state = randomUUID()
  const slug = await getGitHubAppSlug()
  const installUrl = new URL(`https://github.com/apps/${slug}/installations/new`)
  installUrl.searchParams.set('state', state)

  const response = NextResponse.redirect(installUrl)
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60,
    path: '/',
  })

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
