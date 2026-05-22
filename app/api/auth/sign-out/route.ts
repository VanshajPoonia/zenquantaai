import { NextRequest, NextResponse } from 'next/server'
import {
  appendClearedAuthCookies,
  readRequestAuthSession,
  revokeSession,
} from '@/lib/auth/session'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const session = await readRequestAuthSession(request)
  await revokeSession(session.accessToken)

  const response = NextResponse.json({ ok: true })
  appendClearedAuthCookies(response.headers)
  return response
}
