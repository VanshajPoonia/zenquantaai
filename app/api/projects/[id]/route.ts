import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import { projectStore } from '@/lib/storage'

export const runtime = 'nodejs'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  const { id } = await params
  const body = (await request.json().catch(() => null)) as
    | {
        name?: string
        description?: string
        color?: string
      }
    | null

  const project = await projectStore.update(auth.user.id, id, {
    ...(typeof body?.name === 'string' ? { name: body.name.trim() } : {}),
    ...(typeof body?.description !== 'undefined'
      ? { description: body.description?.trim() || undefined }
      : {}),
    ...(typeof body?.color === 'string' ? { color: body.color.trim() } : {}),
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

  const { id } = await params
  await projectStore.delete(auth.user.id, id)

  const response = NextResponse.json({ ok: true })

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
