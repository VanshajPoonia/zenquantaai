import { NextRequest, NextResponse } from 'next/server'
import {
  appendAuthCookies,
  hasSupabaseAuthConfig,
  signInWithPassword,
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
    | { email?: string; password?: string }
    | null
  const email = body?.email?.trim().toLowerCase()
  const password = body?.password ?? ''

  if (!email || !password) {
    return NextResponse.json(
      { error: 'Email and password are required.' },
      { status: 400 }
    )
  }

  const session = await signInWithPassword(email, password)
  const response = NextResponse.json({ ok: true, user: session.user })
  appendAuthCookies(response.headers, session)
  return response
}
