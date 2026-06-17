import 'server-only'

import { createHash, randomBytes } from 'crypto'
import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import {
  AIMode,
  AssistantFamily,
  PublicPlaybookShare,
  PublicPromptShare,
  PublicTemplateShare,
  TemplateCopyResult,
  TemplateShareCreated,
  TemplateShareInfo,
  TemplateShareInput,
  TemplateShareType,
  TemplateShareVisibility,
} from '@/types'
import { getDatabaseClient } from '../client'
import {
  zenPromptLibrary,
  zenPromptWorkflowSteps,
  zenPromptWorkflows,
  zenTemplateShares,
} from '../schema'
import { toIsoString, toJsonArray, toNullableIsoString } from './helpers'
import { createId } from '@/lib/utils/chat'
import { WORKFLOW_FAMILY_TO_MODE } from '@/lib/utils/prompt-workflows'
import { neonUsersRepository } from './users'

type ShareRow = typeof zenTemplateShares.$inferSelect

function createShareToken(): string {
  return randomBytes(32).toString('base64url')
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function rowToShareInfo(row: ShareRow): TemplateShareInfo {
  return {
    id: row.id,
    templateType: row.templateType as TemplateShareType,
    templateId: row.templateId,
    visibility: row.visibility as TemplateShareVisibility,
    expiresAt: toNullableIsoString(row.expiresAt),
    revokedAt: toNullableIsoString(row.revokedAt),
    createdAt: toIsoString(row.createdAt),
  }
}

class NeonTemplateSharesRepository {
  async create(
    userId: string,
    templateType: TemplateShareType,
    templateId: string,
    input: TemplateShareInput
  ): Promise<TemplateShareCreated> {
    const token = createShareToken()
    const tokenHash = hashToken(token)
    const visibility: TemplateShareVisibility = input.visibility ?? 'public_link'
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null

    const rows = await getDatabaseClient()
      .insert(zenTemplateShares)
      .values({ templateType, templateId, userId, tokenHash, visibility, expiresAt })
      .returning()

    const row = rows[0]
    if (!row) throw new Error('Unable to create template share.')

    return { ...rowToShareInfo(row), token }
  }

  async list(
    userId: string,
    templateType: TemplateShareType,
    templateId: string
  ): Promise<TemplateShareInfo[]> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenTemplateShares)
      .where(
        and(
          eq(zenTemplateShares.userId, userId),
          eq(zenTemplateShares.templateType, templateType),
          eq(zenTemplateShares.templateId, templateId),
          isNull(zenTemplateShares.revokedAt)
        )
      )
      .orderBy(desc(zenTemplateShares.createdAt))

    return rows.map(rowToShareInfo)
  }

  async revoke(userId: string, shareId: string): Promise<boolean> {
    const rows = await getDatabaseClient()
      .update(zenTemplateShares)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(zenTemplateShares.userId, userId),
          eq(zenTemplateShares.id, shareId),
          isNull(zenTemplateShares.revokedAt)
        )
      )
      .returning({ id: zenTemplateShares.id })

    return rows.length > 0
  }

  async getPublicByToken(token: string): Promise<PublicTemplateShare | null> {
    const tokenHash = hashToken(token)
    const db = getDatabaseClient()

    const shareRows = await db
      .select()
      .from(zenTemplateShares)
      .where(eq(zenTemplateShares.tokenHash, tokenHash))
      .limit(1)

    const share = shareRows[0]
    if (!share) return null
    if (share.revokedAt) return null
    if (share.expiresAt && share.expiresAt < new Date()) return null

    const shareInfo = {
      id: share.id,
      visibility: share.visibility as TemplateShareVisibility,
      expiresAt: toNullableIsoString(share.expiresAt),
      createdAt: toIsoString(share.createdAt),
    }

    if (share.templateType === 'prompt') {
      const promptRows = await db
        .select()
        .from(zenPromptLibrary)
        .where(
          and(
            eq(zenPromptLibrary.id, share.templateId),
            eq(zenPromptLibrary.userId, share.userId)
          )
        )
        .limit(1)

      const prompt = promptRows[0]
      if (!prompt) return null

      const result: PublicPromptShare = {
        share: shareInfo,
        template: {
          type: 'prompt',
          title: prompt.title,
          content: prompt.content,
          mode: prompt.mode as AIMode | 'any',
        },
      }
      return result
    }

    // playbook
    const workflowRows = await db
      .select()
      .from(zenPromptWorkflows)
      .where(
        and(
          eq(zenPromptWorkflows.id, share.templateId),
          eq(zenPromptWorkflows.userId, share.userId)
        )
      )
      .limit(1)

    const workflow = workflowRows[0]
    if (!workflow) return null

    const stepRows = await db
      .select()
      .from(zenPromptWorkflowSteps)
      .where(eq(zenPromptWorkflowSteps.workflowId, share.templateId))
      .orderBy(asc(zenPromptWorkflowSteps.stepOrder))

    const result: PublicPlaybookShare = {
      share: shareInfo,
      template: {
        type: 'playbook',
        title: workflow.title,
        description: workflow.description,
        variables: toJsonArray(workflow.variables),
        steps: stepRows.map((step) => ({
          title: step.title,
          order: step.stepOrder,
          assistantFamily: step.assistantFamily as AssistantFamily,
          mode: step.mode as AIMode,
          template: step.template,
          variableNames: toJsonArray<string>(step.variableNames),
        })),
      },
    }
    return result
  }

  async copyToWorkspace(
    userId: string,
    token: string
  ): Promise<TemplateCopyResult | null> {
    await neonUsersRepository.ensureUserReference(userId)
    const shared = await this.getPublicByToken(token)
    if (!shared) return null

    const db = getDatabaseClient()
    const now = new Date()

    if (shared.template.type === 'prompt') {
      const { title, content, mode } = shared.template
      const id = createId('prompt')
      await db.insert(zenPromptLibrary).values({
        id,
        userId,
        title,
        content,
        mode,
        createdAt: now,
        updatedAt: now,
      })
      return { type: 'prompt', id, title }
    }

    // playbook
    const { title, description, variables, steps } = shared.template
    const workflowId = createId('workflow')
    await db.insert(zenPromptWorkflows).values({
      id: workflowId,
      userId,
      projectId: null,
      title,
      description: description ?? null,
      variables,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    })

    if (steps.length > 0) {
      await db.insert(zenPromptWorkflowSteps).values(
        steps.map((step) => ({
          id: createId('workflow-step'),
          workflowId,
          stepOrder: step.order,
          assistantFamily: step.assistantFamily,
          mode: WORKFLOW_FAMILY_TO_MODE[step.assistantFamily],
          title: step.title ?? null,
          template: step.template,
          variableNames: step.variableNames,
          metadata: {},
          createdAt: now,
          updatedAt: now,
        }))
      )
    }

    return { type: 'playbook', id: workflowId, title }
  }
}

export const neonTemplateSharesRepository = new NeonTemplateSharesRepository()
