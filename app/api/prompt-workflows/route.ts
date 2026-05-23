import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonProfilesRepository,
  neonPromptWorkflowsRepository,
} from '@/lib/db/repositories'
import { WORKFLOW_FAMILY_TO_MODE } from '@/lib/utils/prompt-workflows'
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
    if (!ASSISTANT_FAMILIES.includes(assistantFamily)) {
      return null
    }

    const template = step.template?.trim()
    if (!template) {
      return null
    }

    return {
      id: step.id,
      title: step.title?.trim() || null,
      order: index + 1,
      assistantFamily,
      mode: WORKFLOW_FAMILY_TO_MODE[assistantFamily],
      template,
      variableNames: step.variableNames,
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
    variables,
    steps: normalizedSteps as PromptWorkflowInput['steps'],
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const workflows = await neonPromptWorkflowsRepository.list(auth.user.id)
  const response = NextResponse.json(workflows)

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const body = await request.json().catch(() => null)
  const parsed = parseWorkflowBody(body)

  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const workflow = await neonPromptWorkflowsRepository.create(auth.user.id, parsed)
  const response = NextResponse.json(workflow, { status: 201 })

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
