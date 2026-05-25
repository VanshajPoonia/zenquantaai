import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import { normalizeCustomAssistantInput } from '@/lib/custom-assistants/validation'
import {
  neonCustomAssistantsRepository,
  neonProfilesRepository,
} from '@/lib/db/repositories'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const { id } = await params
  const assistant = await neonCustomAssistantsRepository.get(auth.user.id, id)

  if (!assistant) {
    return NextResponse.json(
      { error: 'Custom assistant not found.' },
      { status: 404 }
    )
  }

  const response = NextResponse.json(assistant)

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
  const body = await request.json().catch(() => null)
  const normalized = normalizeCustomAssistantInput(body, { partial: true })

  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.error }, { status: 400 })
  }

  const assistant = await neonCustomAssistantsRepository.update(
    auth.user.id,
    id,
    normalized.input
  )

  if (!assistant) {
    return NextResponse.json(
      { error: 'Custom assistant not found.' },
      { status: 404 }
    )
  }

  const response = NextResponse.json(assistant)

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
  const deleted = await neonCustomAssistantsRepository.delete(auth.user.id, id)

  if (!deleted) {
    return NextResponse.json(
      { error: 'Custom assistant not found.' },
      { status: 404 }
    )
  }

  const response = NextResponse.json({ ok: true })

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
