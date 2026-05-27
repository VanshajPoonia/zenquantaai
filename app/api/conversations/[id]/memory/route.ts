import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonMemoryVaultRepository,
  neonProfilesRepository,
} from '@/lib/db/repositories'
import { MemoryVaultConversationPatch } from '@/types'

export const runtime = 'nodejs'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const { id } = await params
  const body = (await request.json().catch(() => ({}))) as Partial<
    MemoryVaultConversationPatch
  >

  if (typeof body.memoryEnabled !== 'boolean') {
    return NextResponse.json(
      { error: 'memoryEnabled must be a boolean.' },
      { status: 400 }
    )
  }

  const conversation = await neonMemoryVaultRepository.setConversationMemoryEnabled(
    auth.user.id,
    id,
    body.memoryEnabled
  )

  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 })
  }

  const response = NextResponse.json(conversation)

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const { id } = await params
  const conversation = await neonMemoryVaultRepository.clearConversationMemory(
    auth.user.id,
    id
  )

  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 })
  }

  const response = NextResponse.json(conversation)

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
