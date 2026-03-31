import { NextRequest, NextResponse } from 'next/server'
import {
  hasSupabaseAuthConfig,
  signUpWithPassword,
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

  if (password.length < 8) {
    return NextResponse.json(
      { error: 'Use at least 8 characters for the password.' },
      { status: 400 }
    )
  }

  await signUpWithPassword(
    email,
    password,
    `${request.nextUrl.origin}/auth/callback`
  )

  return NextResponse.json({
    ok: true,
    requiresVerification: true,
    message:
      'Check your inbox and confirm your email before using password sign-in.',
  })
}
