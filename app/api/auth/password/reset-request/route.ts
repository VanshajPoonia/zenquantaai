import { NextRequest, NextResponse } from 'next/server'
import {
  hasSupabaseAuthConfig,
  sendPasswordResetEmail,
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
    | { email?: string }
    | null
  const email = body?.email?.trim().toLowerCase()

  if (!email) {
    return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
  }

  await sendPasswordResetEmail(email, `${request.nextUrl.origin}/auth/callback`)

  return NextResponse.json({
    ok: true,
    message: 'Check your inbox for the password reset link.',
  })
}
