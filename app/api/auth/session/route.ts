import { NextRequest, NextResponse } from 'next/server'
import {
  appendAuthCookies,
  appendClearedAuthCookies,
  readRequestAuthSession,
} from '@/lib/auth/session'

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

  const response = NextResponse.json({
    user: session.user,
    authenticated: true,
  })

  if (session.refreshed) {
    appendAuthCookies(response.headers, session)
  }

  return response
}
