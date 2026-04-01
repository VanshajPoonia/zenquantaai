import { NextRequest, NextResponse } from 'next/server'
import { planRequestsStore } from '@/lib/storage'
import { requireAdminApiUser } from '@/lib/auth/require-admin'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiUser(request)
  if ('response' in auth) return auth.response

  const items = await planRequestsStore.list()
  return NextResponse.json({ items })
}
