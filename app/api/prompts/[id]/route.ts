import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonProfilesRepository,
  neonPromptsRepository,
} from '@/lib/db/repositories'
import { AIMode } from '@/types'

export const runtime = 'nodejs'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const { id } = await params
  const body = (await request.json().catch(() => null)) as
    | {
        title?: string
        content?: string
        mode?: AIMode | 'any'
      }
    | null

  const prompt = await neonPromptsRepository.update(auth.user.id, id, {
    ...(typeof body?.title === 'string' ? { title: body.title.trim() } : {}),
    ...(typeof body?.content === 'string'
      ? { content: body.content.trim() }
      : {}),
    ...(typeof body?.mode !== 'undefined' ? { mode: body.mode } : {}),
  })

  if (!prompt) {
    return NextResponse.json({ error: 'Prompt not found.' }, { status: 404 })
  }

  const response = NextResponse.json(prompt)

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
  await neonPromptsRepository.delete(auth.user.id, id)

  const response = NextResponse.json({ ok: true })

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
