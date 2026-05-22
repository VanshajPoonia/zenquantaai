import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { email?: string }
    | null
  const email = body?.email?.trim().toLowerCase()

  if (!email) {
    return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
  }

  return NextResponse.json(
    {
      error:
        'Magic links are not available with the current ID/password auth system. Sign in with your ID and password or contact admin.',
    },
    { status: 410 }
  )
}
