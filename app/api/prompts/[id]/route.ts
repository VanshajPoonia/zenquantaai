import { NextRequest, NextResponse } from 'next/server'
import { promptStore } from '@/lib/storage'
import { AIMode } from '@/types'

export const runtime = 'nodejs'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = (await request.json().catch(() => null)) as
    | {
        workspaceId?: string
        title?: string
        content?: string
        mode?: AIMode | 'any'
      }
    | null

  const workspaceId = body?.workspaceId?.trim()

  if (!workspaceId) {
    return NextResponse.json(
      { error: 'workspaceId is required.' },
      { status: 400 }
    )
  }

  const prompt = await promptStore.update(workspaceId, id, {
    ...(typeof body?.title === 'string' ? { title: body.title.trim() } : {}),
    ...(typeof body?.content === 'string'
      ? { content: body.content.trim() }
      : {}),
    ...(typeof body?.mode !== 'undefined' ? { mode: body.mode } : {}),
  })

  if (!prompt) {
    return NextResponse.json({ error: 'Prompt not found.' }, { status: 404 })
  }

  return NextResponse.json(prompt)
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

  await promptStore.delete(workspaceId, id)
  return NextResponse.json({ ok: true })
}
