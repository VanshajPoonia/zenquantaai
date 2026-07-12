import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonMemoryVaultRepository,
  neonProfilesRepository,
} from '@/lib/db/repositories'

export const runtime = 'nodejs'

// Forget one durable memory item (Context Engine Phase 3c). The repository
// expires it (soft delete) and scopes the write to the authenticated user.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const { id } = await params

  const forgotten = await neonMemoryVaultRepository.forgetDurableMemory(
    auth.user.id,
    id
  )

  if (!forgotten) {
    return NextResponse.json(
      { error: 'Memory item not found.' },
      { status: 404 }
    )
  }

  const response = NextResponse.json({ id, forgotten: true })

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
