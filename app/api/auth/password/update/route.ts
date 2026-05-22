import { NextRequest, NextResponse } from 'next/server'
import {
  appendClearedAuthCookies,
  readRequestAuthSession,
  updateLocalPassword,
} from '@/lib/auth/session'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const session = await readRequestAuthSession(request)

  if (!session.user || !session.accessToken) {
    const response = NextResponse.json(
      { error: 'Your session has expired. Sign in again or contact admin for help.' },
      { status: 401 }
    )

    if (session.shouldClearCookies) {
      appendClearedAuthCookies(response.headers)
    }

    return response
  }

  const body = (await request.json().catch(() => null)) as
    | { password?: string }
    | null
  const password = body?.password?.trim() ?? ''

  if (password.length < 8) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters.' },
      { status: 400 }
    )
  }

  await updateLocalPassword(session.accessToken, password)

  return NextResponse.json({
    ok: true,
    message: 'Your password has been updated.',
  })
}
