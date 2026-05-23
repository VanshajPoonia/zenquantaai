import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonProfilesRepository,
  neonPromptWorkflowsRepository,
} from '@/lib/db/repositories'

export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const { id } = await params
  const body = (await request.json().catch(() => ({}))) as {
    conversationId?: string | null
    projectId?: string | null
    variableValues?: Record<string, string>
  }

  const run = await neonPromptWorkflowsRepository.createRun(auth.user.id, id, {
    conversationId: body.conversationId ?? null,
    projectId: body.projectId ?? null,
    variableValues: body.variableValues ?? {},
  })

  if (!run) {
    return NextResponse.json({ error: 'Workflow not found.' }, { status: 404 })
  }

  const response = NextResponse.json(run, { status: 201 })

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
