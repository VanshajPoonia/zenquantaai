import { NextRequest, NextResponse } from 'next/server'
import {
  appendAuthCookies,
  createLoginIdAccount,
  hasSupabaseAuthConfig,
  hasSupabaseAdminAuthConfig,
  parseLoginId,
  signInWithLoginId,
} from '@/lib/auth/session'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  if (!hasSupabaseAdminAuthConfig() || !hasSupabaseAuthConfig()) {
    return NextResponse.json(
      { error: 'Supabase auth is not configured.' },
      { status: 500 }
    )
  }

  const body = (await request.json().catch(() => null)) as
    | { identifier?: string; password?: string }
    | null
  const identifier = body?.identifier ?? ''
  const password = body?.password ?? ''

  if (!identifier.trim() || !password) {
    return NextResponse.json(
      { error: 'ID and password are required.' },
      { status: 400 }
    )
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: 'Use at least 8 characters for the password.' },
      { status: 400 }
    )
  }

  let loginId: string

  try {
    loginId = parseLoginId(identifier)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Your ID format is not valid.',
      },
      { status: 400 }
    )
  }

  await createLoginIdAccount(loginId, password)
  const session = await signInWithLoginId(loginId, password)

  const response = NextResponse.json({
    ok: true,
    requiresVerification: false,
    user: session.user,
    message: 'Account created. You are now signed in.',
  })
  appendAuthCookies(response.headers, session)
  return response
}
