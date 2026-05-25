import 'server-only'

import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { createId, nowIso } from '@/lib/utils/chat'
import {
  extractWorkflowVariableNames,
  mergeWorkflowVariables,
  WORKFLOW_FAMILY_TO_MODE,
} from '@/lib/utils/prompt-workflows'
import {
  PromptWorkflow,
  PromptWorkflowInput,
  PromptWorkflowRun,
  PromptWorkflowRunStatus,
  PromptWorkflowStep,
  PromptWorkflowStepRun,
} from '@/types'
import { getDatabaseClient } from '../client'
import {
  zenPromptWorkflowRuns,
  zenPromptWorkflows,
  zenPromptWorkflowStepRuns,
  zenPromptWorkflowSteps,
} from '../schema'
import {
  compactObject,
  toDate,
  toIsoString,
  toJsonArray,
  toJsonObject,
  toNullableIsoString,
} from './helpers'
import { neonUsersRepository } from './users'

type WorkflowRow = typeof zenPromptWorkflows.$inferSelect
type WorkflowStepRow = typeof zenPromptWorkflowSteps.$inferSelect
type WorkflowRunRow = typeof zenPromptWorkflowRuns.$inferSelect
type WorkflowStepRunRow = typeof zenPromptWorkflowStepRuns.$inferSelect

function isTerminalRunStatus(status: PromptWorkflowRunStatus | undefined): boolean {
  return status === 'complete' || status === 'failed' || status === 'cancelled'
}

function rowToStep(row: WorkflowStepRow): PromptWorkflowStep {
  return {
    id: row.id,
    title: row.title,
    order: row.stepOrder,
    assistantFamily: row.assistantFamily as PromptWorkflowStep['assistantFamily'],
    mode: row.mode as PromptWorkflowStep['mode'],
    template: row.template,
    variableNames: toJsonArray<string>(row.variableNames),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  }
}

function rowToWorkflow(
  row: WorkflowRow,
  steps: WorkflowStepRow[]
): PromptWorkflow {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    projectId: row.projectId,
    variables: toJsonArray<PromptWorkflow['variables'][number]>(row.variables),
    steps: steps
      .map(rowToStep)
      .sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt)),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  }
}

function rowToStepRun(row: WorkflowStepRunRow): PromptWorkflowStepRun {
  return {
    id: row.id,
    runId: row.runId,
    workflowStepId: row.workflowStepId,
    stepOrder: row.stepOrder,
    assistantFamily: row.assistantFamily as PromptWorkflowStepRun['assistantFamily'],
    mode: row.mode as PromptWorkflowStepRun['mode'],
    messageId: row.messageId,
    status: row.status as PromptWorkflowStepRun['status'],
    error: row.error,
    startedAt: toNullableIsoString(row.startedAt),
    completedAt: toNullableIsoString(row.completedAt),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  }
}

function rowToRun(
  row: WorkflowRunRow,
  stepRuns: WorkflowStepRunRow[]
): PromptWorkflowRun {
  return {
    id: row.id,
    workflowId: row.workflowId,
    userId: row.userId,
    conversationId: row.conversationId,
    projectId: row.projectId,
    status: row.status as PromptWorkflowRun['status'],
    variableValues: toJsonObject<Record<string, string>>(row.variableValues, {}),
    error: row.error,
    startedAt: toIsoString(row.startedAt),
    completedAt: toNullableIsoString(row.completedAt),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
    stepRuns: stepRuns
      .map(rowToStepRun)
      .sort((a, b) => a.stepOrder - b.stepOrder),
  }
}

function normalizeWorkflowInput(
  input: PromptWorkflowInput,
  fallbackId?: string
): PromptWorkflow {
  const now = nowIso()
  const normalizedSteps = input.steps
    .map((step, index) => {
      const assistantFamily = step.assistantFamily
      const mode = WORKFLOW_FAMILY_TO_MODE[assistantFamily]
      const variableNames =
        step.variableNames && step.variableNames.length > 0
          ? step.variableNames
          : extractWorkflowVariableNames(step.template)

      return {
        id: step.id ?? createId('workflow-step'),
        title: step.title?.trim() || null,
        order: step.order ?? index + 1,
        assistantFamily,
        mode,
        template: step.template.trim(),
        variableNames,
        createdAt: now,
        updatedAt: now,
      }
    })
    .sort((a, b) => a.order - b.order)
    .map((step, index) => ({
      ...step,
      order: index + 1,
    }))

  const variableNames = normalizedSteps.flatMap((step) => step.variableNames)

  return {
    id: fallbackId ?? createId('workflow'),
    title: input.title.trim(),
    description: input.description?.trim() || null,
    projectId: input.projectId?.trim() || null,
    variables: mergeWorkflowVariables(input.variables, variableNames),
    steps: normalizedSteps,
    createdAt: now,
    updatedAt: now,
  }
}

class NeonPromptWorkflowsRepository {
  async list(userId: string): Promise<PromptWorkflow[]> {
    const db = getDatabaseClient()
    const rows = await db
      .select()
      .from(zenPromptWorkflows)
      .where(eq(zenPromptWorkflows.userId, userId))
      .orderBy(desc(zenPromptWorkflows.updatedAt))

    if (rows.length === 0) return []

    const steps = await db
      .select()
      .from(zenPromptWorkflowSteps)
      .where(
        inArray(
          zenPromptWorkflowSteps.workflowId,
          rows.map((row) => row.id)
        )
      )
      .orderBy(asc(zenPromptWorkflowSteps.stepOrder))

    const stepsByWorkflow = new Map<string, WorkflowStepRow[]>()
    for (const step of steps) {
      stepsByWorkflow.set(step.workflowId, [
        ...(stepsByWorkflow.get(step.workflowId) ?? []),
        step,
      ])
    }

    return rows.map((row) => rowToWorkflow(row, stepsByWorkflow.get(row.id) ?? []))
  }

  async get(userId: string, id: string): Promise<PromptWorkflow | null> {
    const db = getDatabaseClient()
    const rows = await db
      .select()
      .from(zenPromptWorkflows)
      .where(and(eq(zenPromptWorkflows.userId, userId), eq(zenPromptWorkflows.id, id)))
      .limit(1)

    if (!rows[0]) return null

    const steps = await db
      .select()
      .from(zenPromptWorkflowSteps)
      .where(eq(zenPromptWorkflowSteps.workflowId, id))
      .orderBy(asc(zenPromptWorkflowSteps.stepOrder))

    return rowToWorkflow(rows[0], steps)
  }

  async create(userId: string, input: PromptWorkflowInput): Promise<PromptWorkflow> {
    await neonUsersRepository.ensureUserReference(userId)
    const workflow = normalizeWorkflowInput(input)
    const now = toDate(workflow.createdAt)
    const db = getDatabaseClient()

    await db.insert(zenPromptWorkflows).values({
      id: workflow.id,
      userId,
      projectId: workflow.projectId,
      title: workflow.title,
      description: workflow.description,
      variables: workflow.variables,
      createdAt: now,
      updatedAt: now,
    })

    if (workflow.steps.length > 0) {
      await db.insert(zenPromptWorkflowSteps).values(
        workflow.steps.map((step) => ({
          id: step.id,
          workflowId: workflow.id,
          stepOrder: step.order,
          assistantFamily: step.assistantFamily,
          mode: step.mode,
          title: step.title,
          template: step.template,
          variableNames: step.variableNames,
          metadata: {},
          createdAt: now,
          updatedAt: now,
        }))
      )
    }

    const saved = await this.get(userId, workflow.id)
    if (!saved) throw new Error('Unable to load saved workflow.')
    return saved
  }

  async update(
    userId: string,
    id: string,
    input: PromptWorkflowInput
  ): Promise<PromptWorkflow | null> {
    const current = await this.get(userId, id)
    if (!current) return null

    const workflow = normalizeWorkflowInput(input, id)
    const db = getDatabaseClient()
    const now = toDate(workflow.updatedAt)

    await db
      .update(zenPromptWorkflows)
      .set({
        title: workflow.title,
        description: workflow.description,
        projectId: workflow.projectId,
        variables: workflow.variables,
        updatedAt: now,
      })
      .where(and(eq(zenPromptWorkflows.userId, userId), eq(zenPromptWorkflows.id, id)))

    await db
      .delete(zenPromptWorkflowSteps)
      .where(eq(zenPromptWorkflowSteps.workflowId, id))

    if (workflow.steps.length > 0) {
      await db.insert(zenPromptWorkflowSteps).values(
        workflow.steps.map((step) => ({
          id: step.id,
          workflowId: id,
          stepOrder: step.order,
          assistantFamily: step.assistantFamily,
          mode: step.mode,
          title: step.title,
          template: step.template,
          variableNames: step.variableNames,
          metadata: {},
          createdAt: now,
          updatedAt: now,
        }))
      )
    }

    return await this.get(userId, id)
  }

  async delete(userId: string, id: string): Promise<void> {
    await getDatabaseClient()
      .delete(zenPromptWorkflows)
      .where(and(eq(zenPromptWorkflows.userId, userId), eq(zenPromptWorkflows.id, id)))
  }

  async createRun(
    userId: string,
    workflowId: string,
    input: {
      conversationId?: string | null
      projectId?: string | null
      variableValues?: Record<string, string>
    } = {}
  ): Promise<PromptWorkflowRun | null> {
    await neonUsersRepository.ensureUserReference(userId)
    const workflow = await this.get(userId, workflowId)
    if (!workflow) return null

    const db = getDatabaseClient()
    const now = new Date()
    const runRows = await db
      .insert(zenPromptWorkflowRuns)
      .values({
        workflowId: workflow.id,
        userId,
        conversationId: input.conversationId ?? null,
        projectId: input.projectId ?? workflow.projectId ?? null,
        status: 'queued',
        variableValues: input.variableValues ?? {},
        startedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    const run = runRows[0]
    if (!run) throw new Error('Unable to create workflow run.')

    if (workflow.steps.length > 0) {
      await db.insert(zenPromptWorkflowStepRuns).values(
        workflow.steps.map((step) => ({
          runId: run.id,
          workflowStepId: step.id,
          stepOrder: step.order,
          assistantFamily: step.assistantFamily,
          mode: step.mode,
          status: 'queued',
          createdAt: now,
          updatedAt: now,
        }))
      )
    }

    return await this.getRun(userId, run.id)
  }

  async getRun(userId: string, id: string): Promise<PromptWorkflowRun | null> {
    const db = getDatabaseClient()
    const rows = await db
      .select()
      .from(zenPromptWorkflowRuns)
      .where(and(eq(zenPromptWorkflowRuns.userId, userId), eq(zenPromptWorkflowRuns.id, id)))
      .limit(1)

    if (!rows[0]) return null

    const stepRuns = await db
      .select()
      .from(zenPromptWorkflowStepRuns)
      .where(eq(zenPromptWorkflowStepRuns.runId, id))
      .orderBy(asc(zenPromptWorkflowStepRuns.stepOrder))

    return rowToRun(rows[0], stepRuns)
  }

  async updateRunStatus(
    userId: string,
    id: string,
    patch: {
      status?: PromptWorkflowRun['status']
      conversationId?: string | null
      error?: string | null
    }
  ): Promise<PromptWorkflowRun | null> {
    const db = getDatabaseClient()
    await db
      .update(zenPromptWorkflowRuns)
      .set(
        compactObject({
          status: patch.status,
          conversationId: patch.conversationId,
          error: patch.error,
          completedAt: isTerminalRunStatus(patch.status) ? new Date() : undefined,
          updatedAt: new Date(),
        })
      )
      .where(and(eq(zenPromptWorkflowRuns.userId, userId), eq(zenPromptWorkflowRuns.id, id)))

    return await this.getRun(userId, id)
  }

  async updateStepRunStatus(
    userId: string,
    runId: string,
    patch: {
      workflowStepId?: string | null
      stepOrder?: number
      status: PromptWorkflowRunStatus
      messageId?: string | null
      error?: string | null
    }
  ): Promise<PromptWorkflowRun | null> {
    const run = await this.getRun(userId, runId)
    if (!run) return null

    const targetStep = run.stepRuns.find((stepRun) => {
      if (patch.workflowStepId) {
        return stepRun.workflowStepId === patch.workflowStepId
      }

      return typeof patch.stepOrder === 'number'
        ? stepRun.stepOrder === patch.stepOrder
        : false
    })

    if (!targetStep) return null

    await getDatabaseClient()
      .update(zenPromptWorkflowStepRuns)
      .set(
        compactObject({
          status: patch.status,
          messageId: patch.messageId,
          error: patch.error,
          startedAt: patch.status === 'running' ? new Date() : undefined,
          completedAt: isTerminalRunStatus(patch.status) ? new Date() : undefined,
          updatedAt: new Date(),
        })
      )
      .where(eq(zenPromptWorkflowStepRuns.id, targetStep.id))

    return await this.getRun(userId, runId)
  }
}

export const neonPromptWorkflowsRepository = new NeonPromptWorkflowsRepository()
