import { NextRequest, NextResponse } from 'next/server'
import { neonPlanRequestsRepository } from '@/lib/db/repositories'
import { requireAdminApiUser } from '@/lib/auth/require-admin'

export const runtime = 'nodejs'

function parseLimit(value: string | null): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 200
  return Math.max(1, Math.min(1000, Math.floor(parsed)))
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiUser(request)
  if ('response' in auth) return auth.response

  const items = await neonPlanRequestsRepository.list({
    limit: parseLimit(request.nextUrl.searchParams.get('limit')),
  })
  return NextResponse.json({ items })
}
