import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonProfilesRepository,
  neonPromptWorkflowsRepository,
} from '@/lib/db/repositories'
import { resolveOwnedProjectScope } from '@/lib/security/ownership'
import {
  normalizePromptWorkflowMetadata,
  normalizePromptWorkflowStepMetadata,
  WORKFLOW_FAMILY_TO_MODE,
} from '@/lib/utils/prompt-workflows'
import {
  AssistantFamily,
  PromptWorkflowInput,
  PromptWorkflowVariable,
} from '@/types'

export const runtime = 'nodejs'

const ASSISTANT_FAMILIES = Object.keys(WORKFLOW_FAMILY_TO_MODE) as AssistantFamily[]

function parseWorkflowBody(body: unknown): PromptWorkflowInput | { error: string } {
  if (!body || typeof body !== 'object') {
    return { error: 'Workflow payload is required.' }
  }

  const input = body as Partial<PromptWorkflowInput>
  const title = input.title?.trim()
  if (!title) {
    return { error: 'Workflow title is required.' }
  }

  const steps = Array.isArray(input.steps) ? input.steps : []
  if (steps.length === 0) {
    return { error: 'At least one workflow step is required.' }
  }

  const normalizedSteps = steps.map((step, index) => {
    const assistantFamily = step.assistantFamily
    if (!ASSISTANT_FAMILIES.includes(assistantFamily)) return null

    const template = step.template?.trim()
    if (!template) return null

    return {
      id: step.id,
      title: step.title?.trim() || null,
      order: index + 1,
      assistantFamily,
      mode: WORKFLOW_FAMILY_TO_MODE[assistantFamily],
      template,
      variableNames: step.variableNames,
      metadata: normalizePromptWorkflowStepMetadata(
        step.metadata,
        assistantFamily
      ),
    }
  })

  if (normalizedSteps.some((step) => !step)) {
    return { error: 'Each workflow step needs an assistant family and prompt.' }
  }

  const variables = Array.isArray(input.variables)
    ? input.variables
        .filter((variable): variable is PromptWorkflowVariable =>
          Boolean(variable?.name?.trim())
        )
        .map((variable) => ({
          name: variable.name.trim(),
          label: variable.label?.trim() || variable.name.trim(),
          defaultValue: variable.defaultValue ?? '',
          required: variable.required ?? true,
        }))
    : undefined

  return {
    title,
    description: input.description?.trim() || null,
    projectId: input.projectId?.trim() || null,
    metadata: normalizePromptWorkflowMetadata(input.metadata),
    variables,
    steps: normalizedSteps as PromptWorkflowInput['steps'],
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const { id } = await params
  const workflow = await neonPromptWorkflowsRepository.get(auth.user.id, id)

  if (!workflow) {
    return NextResponse.json({ error: 'Workflow not found.' }, { status: 404 })
  }

  const response = NextResponse.json(workflow)

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
  const body = await request.json().catch(() => null)
  const parsed = parseWorkflowBody(body)

  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const projectScope = await resolveOwnedProjectScope(auth.user.id, parsed.projectId)

  if (!projectScope.ok) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
  }

  const workflow = await neonPromptWorkflowsRepository.update(
    auth.user.id,
    id,
    {
      ...parsed,
      projectId: projectScope.projectId,
    }
  )

  if (!workflow) {
    return NextResponse.json({ error: 'Workflow not found.' }, { status: 404 })
  }

  const response = NextResponse.json(workflow)

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const { id } = await params
  await neonPromptWorkflowsRepository.delete(auth.user.id, id)

  const response = NextResponse.json({ ok: true })

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
