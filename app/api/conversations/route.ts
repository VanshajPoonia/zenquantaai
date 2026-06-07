import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import { createSessionSettings } from '@/lib/config'
import {
  neonConversationRepository,
  neonProfilesRepository,
  neonSettingsRepository,
} from '@/lib/db/repositories'
import { resolveOwnedProjectScope } from '@/lib/security/ownership'
import { AIMode, SessionSettings } from '@/types'

export const runtime = 'nodejs'

function parseLimit(value: string | null, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(1, Math.min(500, Math.floor(parsed)))
}

function parseDateParam(value: string | null): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const { searchParams } = request.nextUrl
  const projectId = searchParams.get('projectId')?.trim() || null
  const projectScope = await resolveOwnedProjectScope(auth.user.id, projectId)

  if (!projectScope.ok) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
  }

  const conversations = await neonConversationRepository.list(auth.user.id, {
    projectId: projectScope.projectId,
    limit: parseLimit(searchParams.get('limit'), 100),
    beforeUpdatedAt: parseDateParam(
      searchParams.get('beforeUpdatedAt') ?? searchParams.get('before')
    ),
    includeMessages: false,
  })
  const response = NextResponse.json(conversations)

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const body = (await request.json().catch(() => ({}))) as {
    mode?: AIMode
    projectId?: string
    sessionSettings?: Partial<SessionSettings>
  }
  const settings = await neonSettingsRepository.get(auth.user.id)
  const mode = body.mode ?? settings.defaultMode
  const projectScope = await resolveOwnedProjectScope(auth.user.id, body.projectId)

  if (!projectScope.ok) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
  }

  const conversation = await neonConversationRepository.create(auth.user.id, {
    mode,
    projectId: projectScope.projectId ?? undefined,
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
