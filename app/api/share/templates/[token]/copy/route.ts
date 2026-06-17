import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonProfilesRepository,
  neonTemplateSharesRepository,
} from '@/lib/db/repositories'

export const runtime = 'nodejs'

function isValidToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{40,60}$/.test(value)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const { token } = await params

  if (!isValidToken(token)) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  const result = await neonTemplateSharesRepository.copyToWorkspace(auth.user.id, token)
  if (!result) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  const response = NextResponse.json(result, { status: 201 })
  if (auth.session.refreshed) appendAuthCookies(response.headers, auth.session)
  return response
}
