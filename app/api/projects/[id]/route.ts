import { NextRequest, NextResponse } from 'next/server'
import { projectStore } from '@/lib/storage'

export const runtime = 'nodejs'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = (await request.json().catch(() => null)) as
    | {
        workspaceId?: string
        name?: string
        description?: string
        color?: string
      }
    | null

  const workspaceId = body?.workspaceId?.trim()

  if (!workspaceId) {
    return NextResponse.json(
      { error: 'workspaceId is required.' },
      { status: 400 }
    )
  }

  const project = await projectStore.update(workspaceId, id, {
    ...(typeof body?.name === 'string' ? { name: body.name.trim() } : {}),
    ...(typeof body?.description !== 'undefined'
      ? { description: body.description?.trim() || undefined }
      : {}),
    ...(typeof body?.color === 'string' ? { color: body.color.trim() } : {}),
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
  }

  return NextResponse.json(project)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = (await request.json().catch(() => null)) as
    | { workspaceId?: string }
    | null

  const workspaceId = body?.workspaceId?.trim()

  if (!workspaceId) {
    return NextResponse.json(
      { error: 'workspaceId is required.' },
      { status: 400 }
    )
  }

  await projectStore.delete(workspaceId, id)
  return NextResponse.json({ ok: true })
}
