import { NextRequest, NextResponse } from 'next/server'
import { requireApiTokenUser } from '@/lib/auth/api-token'
import { cliConversationId, isValidCliSessionId } from '@/lib/cli/session-sync'
import { neonConversationRepository } from '@/lib/db/repositories'
import { hitRateLimit } from '@/lib/security/rate-limit'

export const runtime = 'nodejs'

function cleanLabel(value: unknown, max: number): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined
}

/** Creates or refreshes the web conversation that mirrors a zq session. */
export async function POST(request: NextRequest) {
  const auth = await requireApiTokenUser(request, 'cli')
  if (auth.response) return auth.response
  if (!(await hitRateLimit(`cli-sync:${auth.tokenId}`, 600, 3_600))) {
    return NextResponse.json({ error: 'Too many sync requests.' }, { status: 429 })
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!isValidCliSessionId(body?.sessionId)) {
    return NextResponse.json({ error: 'A valid sessionId is required.' }, { status: 400 })
  }
  const workspace = (body?.workspace ?? {}) as Record<string, unknown>
  const repo = cleanLabel(workspace.repo, 120)
  const branch = cleanLabel(workspace.branch, 120)
  const title = cleanLabel(body?.title, 120) ?? (repo ? `zq in ${repo}` : 'zq session')
  const conversationId = cliConversationId(auth.user.id, body.sessionId)

  await neonConversationRepository.upsertCliSession(auth.user.id, {
    id: conversationId,
    title,
    workspace: repo || branch ? { repo, branch } : null,
  })
  return NextResponse.json({ conversationId })
}
