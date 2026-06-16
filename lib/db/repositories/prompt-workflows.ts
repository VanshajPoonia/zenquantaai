import 'server-only'

import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { createId, nowIso } from '@/lib/utils/chat'
import {
  extractWorkflowVariableNames,
  mergeWorkflowVariables,
  normalizePromptWorkflowMetadata,
  normalizePromptWorkflowStepMetadata,
  WORKFLOW_FAMILY_TO_MODE,
} from '@/lib/utils/prompt-workflows'
import {
  PromptWorkflow,
  PromptWorkflowInput,
  PromptWorkflowRun,
  PromptWorkflowRunHistoryItem,
  PromptWorkflowRunOutputMessage,
  PromptWorkflowRunStatus,
  PromptWorkflowStep,
  PromptWorkflowStepRun,
} from '@/types'
import { getDatabaseClient } from '../client'
import {
  zenConversations,
  zenMessages,
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
type MessageRow = typeof zenMessages.$inferSelect

const DEFAULT_WORKFLOW_LIST_LIMIT = 100
const MAX_WORKFLOW_LIST_LIMIT = 200

function normalizeListLimit(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_WORKFLOW_LIST_LIMIT
  }
  return Math.max(1, Math.min(MAX_WORKFLOW_LIST_LIMIT, Math.floor(value)))
}

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
    metadata: normalizePromptWorkflowStepMetadata(
      row.metadata,
      row.assistantFamily as PromptWorkflowStep['assistantFamily']
    ),
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
    metadata: normalizePromptWorkflowMetadata(row.metadata),
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

function stepRunOutputFromMessage(
  stepRun: PromptWorkflowStepRun,
  message: MessageRow
): PromptWorkflowRunOutputMessage {
  return {
    stepRunId: stepRun.id,
    stepOrder: stepRun.stepOrder,
    workflowStepId: stepRun.workflowStepId,
    messageId: message.id,
    conversationId: message.conversationId,
    assistantFamily: stepRun.assistantFamily,
    mode: stepRun.mode,
    content: message.content,
    createdAt: toIsoString(message.createdAt),
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
        metadata: normalizePromptWorkflowStepMetadata(
          step.metadata,
          assistantFamily
        ),
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
    metadata: normalizePromptWorkflowMetadata(input.metadata),
    variables: mergeWorkflowVariables(input.variables, variableNames),
    steps: normalizedSteps,
    createdAt: now,
    updatedAt: now,
  }
}

class NeonPromptWorkflowsRepository {
  async list(
    userId: string,
    options: { limit?: number | null } = {}
  ): Promise<PromptWorkflow[]> {
    const db = getDatabaseClient()
    const rows = await db
      .select()
      .from(zenPromptWorkflows)
      .where(eq(zenPromptWorkflows.userId, userId))
      .orderBy(desc(zenPromptWorkflows.updatedAt))
      .limit(normalizeListLimit(options.limit))

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
      metadata: workflow.metadata,
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
          metadata: step.metadata,
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
        metadata: workflow.metadata,
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
          metadata: step.metadata,
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

  async listRuns(
    userId: string,
    workflowId: string,
    limit = 20
  ): Promise<PromptWorkflowRunHistoryItem[] | null> {
    const workflow = await this.get(userId, workflowId)
    if (!workflow) return null

    const db = getDatabaseClient()
    const rows = await db
      .select()
      .from(zenPromptWorkflowRuns)
      .where(
        and(
          eq(zenPromptWorkflowRuns.userId, userId),
          eq(zenPromptWorkflowRuns.workflowId, workflowId)
        )
      )
      .orderBy(desc(zenPromptWorkflowRuns.createdAt))
      .limit(Math.min(Math.max(limit, 1), 50))

    if (rows.length === 0) return []

    const stepRuns = await db
      .select()
      .from(zenPromptWorkflowStepRuns)
      .where(
        inArray(
          zenPromptWorkflowStepRuns.runId,
          rows.map((row) => row.id)
        )
      )
      .orderBy(asc(zenPromptWorkflowStepRuns.stepOrder))

    const messageIds = stepRuns
      .map((stepRun) => stepRun.messageId)
      .filter((messageId): messageId is string => Boolean(messageId))

    const messages =
      messageIds.length > 0
        ? await db
            .select({ message: zenMessages })
            .from(zenMessages)
            .innerJoin(
              zenConversations,
              eq(zenConversations.id, zenMessages.conversationId)
            )
            .where(
              and(
                eq(zenConversations.userId, userId),
                inArray(zenMessages.id, messageIds)
              )
            )
        : []

    const messagesById = new Map(
      messages.map(({ message }) => [message.id, message])
    )
    const stepRunsByRun = new Map<string, WorkflowStepRunRow[]>()

    for (const stepRun of stepRuns) {
      stepRunsByRun.set(stepRun.runId, [
        ...(stepRunsByRun.get(stepRun.runId) ?? []),
        stepRun,
      ])
    }

    return rows.map((row) => {
      const run = rowToRun(row, stepRunsByRun.get(row.id) ?? [])
      const outputMessages = run.stepRuns
        .map((stepRun) => {
          const message = stepRun.messageId
            ? messagesById.get(stepRun.messageId)
            : null
          return message ? stepRunOutputFromMessage(stepRun, message) : null
        })
        .filter(
          (message): message is PromptWorkflowRunOutputMessage => Boolean(message)
        )
        .sort((a, b) => a.stepOrder - b.stepOrder)

      return {
        ...run,
        outputMessages,
        finalOutput: outputMessages.at(-1) ?? null,
      }
    })
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
