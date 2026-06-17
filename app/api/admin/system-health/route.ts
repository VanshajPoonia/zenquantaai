import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApiUser } from '@/lib/auth/require-admin'
import { runSystemHealthChecks } from '@/lib/system-health/checks'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiUser(request)
  if ('response' in auth) return auth.response

  const report = await runSystemHealthChecks()
  return NextResponse.json(report)
}
