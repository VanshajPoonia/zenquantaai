import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type')?.trim() ?? 'email'
  const isRecovery = type === 'recovery'

  return NextResponse.redirect(
    new URL(
      isRecovery ? '/auth/reset-password?auth=unsupported' : '/?auth=unsupported',
      request.url
    )
  )
}
