import { NextRequest, NextResponse } from 'next/server'
import {
  appendAuthCookies,
  hasSupabaseAuthConfig,
  parseLoginId,
  signInWithLoginId,
} from '@/lib/auth/session'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  if (!hasSupabaseAuthConfig()) {
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

  const loginId = parseLoginId(identifier)
  let session

  try {
    session = await signInWithLoginId(loginId, password)
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : ''

    if (
      message.includes('invalid login credentials') ||
      message.includes('invalid credentials') ||
      message.includes('invalid grant')
    ) {
      return NextResponse.json(
        {
          error:
            'That ID or password is not correct. If your ID is correct, check your password and try again.',
        },
        { status: 401 }
      )
    }

    throw error
  }

  const response = NextResponse.json({ ok: true, user: session.user })
  appendAuthCookies(response.headers, session)
  return response
}
