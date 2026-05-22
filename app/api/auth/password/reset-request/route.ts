import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { email?: string; identifier?: string }
    | null
  const contact = body?.email?.trim().toLowerCase() ?? body?.identifier?.trim()

  if (!contact) {
    return NextResponse.json(
      { error: 'An ID or contact email is required.' },
      { status: 400 }
    )
  }

  return NextResponse.json({
    ok: true,
    message:
      'Password reset is admin-assisted right now. Contact support and include your Zenquanta ID.',
  })
}
