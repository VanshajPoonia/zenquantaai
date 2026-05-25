import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import { normalizeCustomAssistantInput } from '@/lib/custom-assistants/validation'
import {
  neonCustomAssistantsRepository,
  neonProfilesRepository,
} from '@/lib/db/repositories'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const assistants = await neonCustomAssistantsRepository.list(auth.user.id)
  const response = NextResponse.json(assistants)

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const body = await request.json().catch(() => null)
  const normalized = normalizeCustomAssistantInput(body)

  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.error }, { status: 400 })
  }

  const assistant = await neonCustomAssistantsRepository.create(
    auth.user.id,
    normalized.input
  )
  const response = NextResponse.json(assistant, { status: 201 })

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
