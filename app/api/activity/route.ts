import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  DEFAULT_ACTIVITY_LIMIT,
  isWorkspaceActivityType,
  normalizeActivityCursor,
  normalizeActivityLimit,
} from '@/lib/activity/timeline'
import {
  neonActivityRepository,
  neonProfilesRepository,
  neonProjectsRepository,
} from '@/lib/db/repositories'
import { WorkspaceActivityResponse } from '@/types'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)

  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('projectId')?.trim() || null
  const rawType = searchParams.get('type')?.trim() || null
  const rawLimit = searchParams.get('limit')
  const rawBefore = searchParams.get('before')

  const limit = normalizeActivityLimit(rawLimit ?? DEFAULT_ACTIVITY_LIMIT)
  if (!limit) {
    return NextResponse.json(
      { error: 'Invalid activity limit.' },
      { status: 400 }
    )
  }

  const before = rawBefore ? normalizeActivityCursor(rawBefore) : null
  if (rawBefore && !before) {
    return NextResponse.json(
      { error: 'Invalid activity cursor.' },
      { status: 400 }
    )
  }

  const type = rawType ? (isWorkspaceActivityType(rawType) ? rawType : null) : null
  if (rawType && !type) {
    return NextResponse.json(
      { error: 'Invalid activity type.' },
      { status: 400 }
    )
  }

  if (projectId) {
    const project = await neonProjectsRepository.get(auth.user.id, projectId)
    if (!project) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    }
  }

  const activity = await neonActivityRepository.list(auth.user.id, {
    limit,
    before,
    projectId,
    type,
  })

  const response = NextResponse.json({
    items: activity.items,
    nextCursor: activity.nextCursor,
    filters: {
      projectId,
      type,
      limit,
      before,
    },
    generatedAt: new Date().toISOString(),
  } satisfies WorkspaceActivityResponse)

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
