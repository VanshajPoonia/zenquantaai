import { NextRequest, NextResponse } from 'next/server'
import { projectStore } from '@/lib/storage'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspaceId')?.trim()

  if (!workspaceId) {
    return NextResponse.json(
      { error: 'workspaceId is required.' },
      { status: 400 }
    )
  }

  const projects = await projectStore.list(workspaceId)
  return NextResponse.json(projects)
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | {
        workspaceId?: string
        name?: string
        description?: string
        color?: string
      }
    | null

  const workspaceId = body?.workspaceId?.trim()
  const name = body?.name?.trim()

  if (!workspaceId || !name) {
    return NextResponse.json(
      { error: 'workspaceId and name are required.' },
      { status: 400 }
    )
  }

  const project = await projectStore.create(workspaceId, {
    name,
    description: body?.description?.trim() || undefined,
    color: body?.color?.trim() || 'general',
  })

  return NextResponse.json(project, { status: 201 })
}
