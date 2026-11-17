import { NextRequest, NextResponse } from 'next/server'
import { neonApiTokensRepository, neonDeviceCodesRepository, neonUsersRepository } from '@/lib/db/repositories'
import { getClientIp, hitRateLimit } from '@/lib/security/rate-limit'

export const runtime = 'nodejs'

function oauthError(error: string, status = 400) {
  return NextResponse.json({ error }, { status })
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { device_code?: unknown } | null
  const deviceCode = typeof body?.device_code === 'string' ? body.device_code : ''
  if (!deviceCode) return oauthError('invalid_request')

  // zq polls every 5 s for up to 10 minutes, so this leaves room for a few logins per network.
  if (!(await hitRateLimit(`cli-token-ip:${getClientIp(request)}`, 600, 600))) {
    return oauthError('slow_down', 429)
  }
  if (!(await hitRateLimit(`cli-token:${deviceCode}`, 1, 4))) return oauthError('slow_down')

  const result = await neonDeviceCodesRepository.claim(deviceCode)
  if (result.status === 'pending') return oauthError('authorization_pending')
  if (result.status === 'denied') return oauthError('access_denied')
  if (result.status !== 'approved') return oauthError('expired_token')

  const user = await neonUsersRepository.get(result.userId)
  const { token, record } = await neonApiTokensRepository.create({
    userId: result.userId,
    name: result.clientName,
    scopes: ['cli'],
  })

  return NextResponse.json({
    access_token: token,
    token_type: 'bearer',
    expires_at: record.expiresAt,
    login_id: user?.loginId ?? null,
  })
}
