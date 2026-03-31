import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import { projectStore } from '@/lib/storage'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  const projects = await projectStore.list(auth.user.id)
  const response = NextResponse.json(projects)

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  const body = (await request.json().catch(() => null)) as
    | {
        name?: string
        description?: string
        color?: string
      }
    | null

  const name = body?.name?.trim()

  if (!name) {
    return NextResponse.json({ error: 'name is required.' }, { status: 400 })
  }

  const project = await projectStore.create(auth.user.id, {
    name,
    description: body?.description?.trim() || undefined,
    color: body?.color?.trim() || 'general',
  })

  const response = NextResponse.json(project, { status: 201 })

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
