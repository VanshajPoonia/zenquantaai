import { NextRequest, NextResponse } from 'next/server'
import {
  appendAuthCookies,
  verifyMagicLink,
} from '@/lib/auth/session'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash')?.trim()
  const type = request.nextUrl.searchParams.get('type')?.trim() ?? 'email'
  const isRecovery = type === 'recovery'

  if (!tokenHash) {
    return NextResponse.redirect(
      new URL(
        isRecovery
          ? '/auth/reset-password?auth=missing-token'
          : '/?auth=missing-token',
        request.url
      )
    )
  }

  try {
    const session = await verifyMagicLink(
      tokenHash,
      type as 'email' | 'magiclink' | 'recovery' | 'invite' | 'signup'
    )

    const response = NextResponse.redirect(
      new URL(isRecovery ? '/auth/reset-password' : '/', request.url)
    )
    appendAuthCookies(response.headers, session)
    return response
  } catch {
    return NextResponse.redirect(
      new URL(
        isRecovery ? '/auth/reset-password?auth=failed' : '/?auth=failed',
        request.url
      )
    )
  }
}
