import { NextRequest, NextResponse } from 'next/server'
import {
  appendClearedAuthCookies,
  isAuthRateLimitError,
  isInvalidCurrentPasswordError,
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
    | { currentPassword?: unknown; password?: unknown }
    | null
  // Not trimmed, to match how sign-in checks the password.
  const currentPassword =
    typeof body?.currentPassword === 'string' ? body.currentPassword : ''
  const password = typeof body?.password === 'string' ? body.password.trim() : ''

  if (!currentPassword) {
    return NextResponse.json(
      { error: 'Enter your current password.' },
      { status: 400 }
    )
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters.' },
      { status: 400 }
    )
  }

  try {
    await updateLocalPassword({
      sessionToken: session.accessToken,
      currentPassword,
      newPassword: password,
      request,
    })
  } catch (error) {
    if (isAuthRateLimitError(error) || isInvalidCurrentPasswordError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    throw error
  }

  return NextResponse.json({
    ok: true,
    message: 'Your password has been updated.',
  })
}
