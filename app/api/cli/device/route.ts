import { NextRequest, NextResponse } from 'next/server'
import { neonDeviceCodesRepository } from '@/lib/db/repositories'
import { getClientIp, hitRateLimit } from '@/lib/security/rate-limit'

export const runtime = 'nodejs'

function appOrigin(request: NextRequest): string {
  return process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '') || request.nextUrl.origin
}

export async function POST(request: NextRequest) {
  if (!(await hitRateLimit(`cli-device:${getClientIp(request)}`, 10, 3_600))) {
    return NextResponse.json(
      { error: 'too_many_requests', message: 'Too many login attempts. Try again in an hour.' },
      { status: 429 }
    )
  }

  const body = (await request.json().catch(() => null)) as { clientName?: unknown } | null
  const clientName =
    typeof body?.clientName === 'string' && body.clientName.trim()
      ? body.clientName.trim()
      : 'zq'
  const code = await neonDeviceCodesRepository.create(clientName)
  const verificationUrl = `${appOrigin(request)}/cli/authorize`

  return NextResponse.json({
    device_code: code.deviceCode,
    user_code: code.userCode,
    verification_url: verificationUrl,
    verification_url_complete: `${verificationUrl}?code=${encodeURIComponent(code.userCode)}`,
    interval: 5,
    expires_in: Math.round((code.expiresAt.getTime() - Date.now()) / 1000),
  })
}
