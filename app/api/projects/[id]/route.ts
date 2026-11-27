import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonProfilesRepository,
  neonProjectsRepository,
} from '@/lib/db/repositories'
import { PROJECT_INSTRUCTIONS_MAX_CHARS } from '@/lib/ai/user-instructions'

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
        name?: string
        description?: string
        color?: string
        instructions?: string | null
      }
    | null

  const rawInstructions: unknown = body?.instructions
  let instructions: string | undefined
  if (rawInstructions === null) {
    instructions = ''
  } else if (typeof rawInstructions === 'string') {
    if (rawInstructions.length > PROJECT_INSTRUCTIONS_MAX_CHARS) {
      return NextResponse.json(
        {
          error: `Instructions can be up to ${PROJECT_INSTRUCTIONS_MAX_CHARS.toLocaleString('en-US')} characters.`,
        },
        { status: 400 }
      )
    }
    instructions = rawInstructions.trim()
  } else if (typeof rawInstructions !== 'undefined') {
    return NextResponse.json({ error: 'Instructions must be text.' }, { status: 400 })
  }

  const project = await neonProjectsRepository.update(auth.user.id, id, {
    ...(typeof body?.name === 'string' ? { name: body.name.trim() } : {}),
    ...(typeof body?.description !== 'undefined'
      ? { description: body.description?.trim() || undefined }
      : {}),
    ...(typeof body?.color === 'string' ? { color: body.color.trim() } : {}),
    ...(typeof instructions !== 'undefined' ? { instructions } : {}),
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
  }

  const response = NextResponse.json(project)

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
  await neonProjectsRepository.delete(auth.user.id, id)

  const response = NextResponse.json({ ok: true })

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
