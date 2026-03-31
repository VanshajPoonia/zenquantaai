import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import { promptStore } from '@/lib/storage'
import { AIMode } from '@/types'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  const prompts = await promptStore.list(auth.user.id)
  const response = NextResponse.json(prompts)

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
        title?: string
        content?: string
        mode?: AIMode | 'any'
      }
    | null

  const title = body?.title?.trim()
  const content = body?.content?.trim()

  if (!title || !content) {
    return NextResponse.json(
      { error: 'title and content are required.' },
      { status: 400 }
    )
  }

  const prompt = await promptStore.create(auth.user.id, {
    title,
    content,
    mode: body?.mode ?? 'any',
  })

  const response = NextResponse.json(prompt, { status: 201 })

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
