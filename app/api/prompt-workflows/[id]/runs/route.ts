import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonConversationRepository,
  neonProfilesRepository,
  neonProjectsRepository,
  neonPromptWorkflowsRepository,
} from '@/lib/db/repositories'
import { PromptWorkflowRunStatus } from '@/types'

export const runtime = 'nodejs'

const RUN_STATUSES: PromptWorkflowRunStatus[] = [
  'queued',
  'running',
  'complete',
  'failed',
  'cancelled',
]

function isRunStatus(value: unknown): value is PromptWorkflowRunStatus {
  return typeof value === 'string' && RUN_STATUSES.includes(value as PromptWorkflowRunStatus)
}

function compactError(value: unknown): string | null | undefined {
  if (value === null) return null
  if (typeof value === 'undefined') return undefined
  const text = String(value).trim()
  return text ? text.slice(0, 500) : null
}

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const { id } = await params

  const runs = await neonPromptWorkflowsRepository.listRuns(auth.user.id, id)
  if (!runs) {
    return NextResponse.json({ error: 'Workflow not found.' }, { status: 404 })
  }

  const response = NextResponse.json(runs)

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const { id } = await params
  const body = (await request.json().catch(() => null)) as
    | {
        runId?: string
        status?: unknown
        conversationId?: string | null
        error?: unknown
        step?: {
          workflowStepId?: string | null
          stepOrder?: number
          status?: unknown
          messageId?: string | null
          error?: unknown
        }
      }
    | null

  const runId = body?.runId?.trim()
  if (!runId) {
    return NextResponse.json({ error: 'Workflow run id is required.' }, { status: 400 })
  }

  const existingRun = await neonPromptWorkflowsRepository.getRun(auth.user.id, runId)
  if (!existingRun || existingRun.workflowId !== id) {
    return NextResponse.json({ error: 'Workflow run not found.' }, { status: 404 })
  }

  if (typeof body?.status === 'undefined' && !body?.step) {
    return NextResponse.json(
      { error: 'Workflow run update is required.' },
      { status: 400 }
    )
  }

  if (body?.conversationId) {
    const conversation = await neonConversationRepository.get(
      auth.user.id,
      body.conversationId
    )
    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found.' },
        { status: 404 }
      )
    }
  }

  let run = existingRun
  if (typeof body?.status !== 'undefined') {
    if (!isRunStatus(body.status)) {
      return NextResponse.json({ error: 'Workflow run status is invalid.' }, { status: 400 })
    }

    run =
      (await neonPromptWorkflowsRepository.updateRunStatus(auth.user.id, runId, {
        status: body.status,
        conversationId:
          typeof body.conversationId === 'string'
            ? body.conversationId.trim() || null
            : body.conversationId,
        error: compactError(body.error),
      })) ?? run
  }

  if (body?.step) {
    if (!isRunStatus(body.step.status)) {
      return NextResponse.json({ error: 'Workflow step status is invalid.' }, { status: 400 })
    }

    const stepOrder =
      typeof body.step.stepOrder === 'number' &&
      Number.isSafeInteger(body.step.stepOrder) &&
      body.step.stepOrder > 0
        ? body.step.stepOrder
        : undefined

    if (!body.step.workflowStepId && !stepOrder) {
      return NextResponse.json(
        { error: 'Workflow step id or order is required.' },
        { status: 400 }
      )
    }

    const updatedRun = await neonPromptWorkflowsRepository.updateStepRunStatus(
      auth.user.id,
      runId,
      {
        workflowStepId: body.step.workflowStepId?.trim() || null,
        stepOrder,
        status: body.step.status,
        messageId: body.step.messageId?.trim() || null,
        error: compactError(body.step.error),
      }
    )

    if (!updatedRun) {
      return NextResponse.json(
        { error: 'Workflow step run not found.' },
        { status: 404 }
      )
    }

    run = updatedRun
  }

  const response = NextResponse.json(run)

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
