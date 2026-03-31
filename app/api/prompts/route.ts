import { NextRequest, NextResponse } from 'next/server'
import { promptStore } from '@/lib/storage'
import { AIMode } from '@/types'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspaceId')?.trim()

  if (!workspaceId) {
    return NextResponse.json(
      { error: 'workspaceId is required.' },
      { status: 400 }
    )
  }

  const prompts = await promptStore.list(workspaceId)
  return NextResponse.json(prompts)
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | {
        workspaceId?: string
        title?: string
        content?: string
        mode?: AIMode | 'any'
      }
    | null

  const workspaceId = body?.workspaceId?.trim()
  const title = body?.title?.trim()
  const content = body?.content?.trim()

  if (!workspaceId || !title || !content) {
    return NextResponse.json(
      { error: 'workspaceId, title, and content are required.' },
      { status: 400 }
    )
  }

  const prompt = await promptStore.create(workspaceId, {
    title,
    content,
    mode: body?.mode ?? 'any',
  })

  return NextResponse.json(prompt, { status: 201 })
}
