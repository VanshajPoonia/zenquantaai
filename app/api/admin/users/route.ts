import { NextRequest, NextResponse } from 'next/server'
import { adminStore } from '@/lib/storage'
import { requireAdminApiUser } from '@/lib/auth/require-admin'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiUser(request)
  if ('response' in auth) return auth.response

  const users = await adminStore.listUserRows()
  return NextResponse.json({ users })
}
