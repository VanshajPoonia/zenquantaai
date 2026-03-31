import { NextRequest, NextResponse } from 'next/server'
import {
  appendAuthCookies,
  verifyMagicLink,
} from '@/lib/auth/session'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash')?.trim()
  const type = request.nextUrl.searchParams.get('type')?.trim() ?? 'email'

  if (!tokenHash) {
    return NextResponse.redirect(new URL('/?auth=missing-token', request.url))
  }

  try {
    const session = await verifyMagicLink(
      tokenHash,
      type as 'email' | 'magiclink' | 'recovery' | 'invite' | 'signup'
    )

    const response = NextResponse.redirect(new URL('/', request.url))
    appendAuthCookies(response.headers, session)
    return response
  } catch {
    return NextResponse.redirect(new URL('/?auth=failed', request.url))
  }
}
