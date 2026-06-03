import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonConversationRepository,
  neonProfilesRepository,
} from '@/lib/db/repositories'
import { resolveOwnedProjectScope } from '@/lib/security/ownership'
import { ConversationMutation } from '@/types'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const { id } = await params
  const conversation = await neonConversationRepository.get(auth.user.id, id)

  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 })
  }

  const response = NextResponse.json(conversation)

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const { id } = await params
  const body = (await request.json().catch(() => ({}))) as ConversationMutation
  const mutation = { ...body }

  if (Object.prototype.hasOwnProperty.call(body, 'projectId')) {
    const projectScope = await resolveOwnedProjectScope(auth.user.id, body.projectId)

    if (!projectScope.ok) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    }

    mutation.projectId = projectScope.projectId ?? undefined
  }

  const conversation = await neonConversationRepository.patch(auth.user.id, id, mutation)

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
  await neonConversationRepository.delete(auth.user.id, id)

  const response = NextResponse.json({ ok: true })

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
