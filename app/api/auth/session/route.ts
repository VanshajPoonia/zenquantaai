import { NextRequest, NextResponse } from 'next/server'
import {
  appendAuthCookies,
  appendClearedAuthCookies,
  readRequestAuthSession,
} from '@/lib/auth/session'
import { profilesStore } from '@/lib/storage'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const session = await readRequestAuthSession(request)

  if (!session.user) {
    const response = NextResponse.json(
      { user: null, authenticated: false },
      { status: 401 }
    )

    if (session.shouldClearCookies) {
      appendClearedAuthCookies(response.headers)
    }

    return response
  }

  const profile = await profilesStore.ensureFromAuthUser(session.user)

  const response = NextResponse.json({
    user: {
      ...session.user,
      role: profile.role,
    },
    authenticated: true,
  })

  if (session.refreshed) {
    appendAuthCookies(response.headers, session)
  }

  return response
}
