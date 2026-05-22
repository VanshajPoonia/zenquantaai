import { NextRequest, NextResponse } from 'next/server'
import { neonAdminRepository } from '@/lib/db/repositories'
import { requireAdminApiUser } from '@/lib/auth/require-admin'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiUser(request)
  if ('response' in auth) return auth.response

  const overview = await neonAdminRepository.getOverview()
  return NextResponse.json({ overview })
}
