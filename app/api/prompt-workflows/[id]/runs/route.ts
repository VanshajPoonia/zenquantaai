import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonConversationRepository,
  neonProfilesRepository,
  neonProjectsRepository,
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
  const conversationId = body.conversationId?.trim() || null
  const projectId = body.projectId?.trim() || null

  if (conversationId) {
    const conversation = await neonConversationRepository.get(
      auth.user.id,
      conversationId
    )
    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found.' },
        { status: 404 }
      )
    }
  }

  if (projectId) {
    const projects = await neonProjectsRepository.list(auth.user.id)
    if (!projects.some((project) => project.id === projectId)) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    }
  }

  const run = await neonPromptWorkflowsRepository.createRun(auth.user.id, id, {
    conversationId,
    projectId,
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
