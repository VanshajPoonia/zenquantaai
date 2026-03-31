import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import { createSessionSettings } from '@/lib/config'
import { conversationStore, settingsStore } from '@/lib/storage'
import { AIMode, SessionSettings } from '@/types'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  const conversations = await conversationStore.list(auth.user.id)
  const response = NextResponse.json(conversations)

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  const body = (await request.json().catch(() => ({}))) as {
    mode?: AIMode
    projectId?: string
    sessionSettings?: Partial<SessionSettings>
  }
  const settings = await settingsStore.get(auth.user.id)
  const mode = body.mode ?? settings.defaultMode

  const conversation = await conversationStore.create(auth.user.id, {
    mode,
    projectId: body.projectId,
    sessionSettings: createSessionSettings(mode, {
      ...settings.sessionDefaults,
      ...body.sessionSettings,
    }),
  })

  const response = NextResponse.json(conversation, { status: 201 })

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
