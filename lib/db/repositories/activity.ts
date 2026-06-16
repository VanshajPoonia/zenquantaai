import 'server-only'

import { and, desc, eq, lt, SQL } from 'drizzle-orm'
import {
  sortAndPageActivities,
  shouldEmitUpdatedActivity,
  truncateActivityText,
  workspaceActivityHref,
} from '@/lib/activity/timeline'
import { normalizeFileKnowledge } from '@/lib/files/intelligence'
import {
  SearchResultTarget,
  WorkspaceActivityItem,
  WorkspaceActivityType,
} from '@/types'
import { getDatabaseClient } from '../client'
import {
  zenArtifacts,
  zenConversations,
  zenCustomAssistants,
  zenFiles,
  zenGeneratedImages,
  zenMessages,
  zenModelComparisons,
  zenPlanChangeRequests,
  zenProjects,
  zenPromptWorkflowRuns,
  zenPromptWorkflows,
} from '../schema'
import { toIsoString, toJsonObject } from './helpers'

export interface ActivityListOptions {
  limit?: number
  before?: string | null
  projectId?: string | null
  type?: WorkspaceActivityType | null
}

export interface ActivityListResult {
  items: WorkspaceActivityItem[]
  nextCursor: string | null
}

const SOURCE_LIMIT_FLOOR = 30
const SOURCE_LIMIT_MAX = 120

function sourceLimit(limit: number | null | undefined): number {
  return Math.max(
    SOURCE_LIMIT_FLOOR,
    Math.min(SOURCE_LIMIT_MAX, (limit ?? 40) * 3)
  )
}

function projectDetails(
  projectId: string | null | undefined,
  projectNames: Map<string, string>
): Pick<WorkspaceActivityItem, 'projectId' | 'projectName'> {
  if (!projectId) return { projectId: null, projectName: null }
  return {
    projectId,
    projectName: projectNames.get(projectId) ?? null,
  }
}

function activity(
  input: Omit<WorkspaceActivityItem, 'href'> & { target: SearchResultTarget }
): WorkspaceActivityItem {
  return {
    ...input,
    href: workspaceActivityHref(input.target),
  }
}

function dateBeforeCondition<T>(
  column: T,
  before: string | null | undefined
): SQL | null {
  return before ? lt(column as never, new Date(before)) : null
}

function compactConditions(conditions: Array<SQL | null | undefined>): SQL[] {
  return conditions.filter(Boolean) as SQL[]
}

function safeDescription(value: string | null | undefined, fallback: string) {
  return truncateActivityText(value?.trim() ? value : fallback)
}

function safeMetadata(
  values: Record<string, string | number | boolean | null | undefined>
): Record<string, string | number | boolean | null> {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => typeof value !== 'undefined')
  ) as Record<string, string | number | boolean | null>
}

class NeonActivityRepository {
  async list(userId: string, options: ActivityListOptions = {}): Promise<ActivityListResult> {
    const db = getDatabaseClient()
    const limit = options.limit ?? 40
    const perSourceLimit = sourceLimit(limit)
    const before = options.before ?? null
    const projectId = options.projectId ?? null

    const projectRows = await db
      .select({
        id: zenProjects.id,
        name: zenProjects.name,
        description: zenProjects.description,
        createdAt: zenProjects.createdAt,
        updatedAt: zenProjects.updatedAt,
      })
      .from(zenProjects)
      .where(
        and(
          eq(zenProjects.userId, userId),
          ...(projectId ? [eq(zenProjects.id, projectId)] : [])
        )
      )
      .orderBy(desc(zenProjects.updatedAt))
      .limit(perSourceLimit)

    const projectNames = new Map(
      projectRows.map((project) => [project.id, project.name])
    )

    const conversationConditions = compactConditions([
      eq(zenConversations.userId, userId),
      projectId ? eq(zenConversations.projectId, projectId) : null,
      dateBeforeCondition(zenConversations.updatedAt, before),
    ])
    const messageConditions = compactConditions([
      eq(zenConversations.userId, userId),
      eq(zenMessages.role, 'user'),
      projectId ? eq(zenConversations.projectId, projectId) : null,
      dateBeforeCondition(zenMessages.createdAt, before),
    ])
    const artifactConditions = compactConditions([
      eq(zenArtifacts.userId, userId),
      projectId ? eq(zenArtifacts.projectId, projectId) : null,
      dateBeforeCondition(zenArtifacts.updatedAt, before),
    ])
    const fileConditions = compactConditions([
      eq(zenFiles.userId, userId),
      projectId ? eq(zenFiles.projectId, projectId) : null,
      dateBeforeCondition(zenFiles.updatedAt, before),
    ])
    const imageConditions = compactConditions([
      eq(zenGeneratedImages.userId, userId),
      projectId ? eq(zenGeneratedImages.projectId, projectId) : null,
      dateBeforeCondition(zenGeneratedImages.createdAt, before),
    ])
    const workflowConditions = compactConditions([
      eq(zenPromptWorkflowRuns.userId, userId),
      projectId ? eq(zenPromptWorkflowRuns.projectId, projectId) : null,
      dateBeforeCondition(zenPromptWorkflowRuns.updatedAt, before),
    ])
    const modelComparisonConditions = compactConditions([
      eq(zenModelComparisons.userId, userId),
      eq(zenModelComparisons.status, 'complete'),
      projectId ? eq(zenModelComparisons.projectId, projectId) : null,
      dateBeforeCondition(zenModelComparisons.updatedAt, before),
    ])

    const [
      conversationRows,
      messageRows,
      artifactRows,
      fileRows,
      imageRows,
      workflowRunRows,
      modelComparisonRows,
      customAssistantRows,
      planRequestRows,
    ] = await Promise.all([
      db
        .select({
          id: zenConversations.id,
          title: zenConversations.title,
          preview: zenConversations.preview,
          mode: zenConversations.mode,
          assistantFamily: zenConversations.assistantFamily,
          projectId: zenConversations.projectId,
          createdAt: zenConversations.createdAt,
          updatedAt: zenConversations.updatedAt,
        })
        .from(zenConversations)
        .where(and(...conversationConditions))
        .orderBy(desc(zenConversations.updatedAt))
        .limit(perSourceLimit),
      db
        .select({
          id: zenMessages.id,
          conversationId: zenMessages.conversationId,
          content: zenMessages.content,
          mode: zenMessages.mode,
          createdAt: zenMessages.createdAt,
          conversationTitle: zenConversations.title,
          projectId: zenConversations.projectId,
        })
        .from(zenMessages)
        .innerJoin(
          zenConversations,
          eq(zenMessages.conversationId, zenConversations.id)
        )
        .where(and(...messageConditions))
        .orderBy(desc(zenMessages.createdAt))
        .limit(perSourceLimit),
      db
        .select({
          id: zenArtifacts.id,
          title: zenArtifacts.title,
          artifactType: zenArtifacts.artifactType,
          sourceType: zenArtifacts.sourceType,
          projectId: zenArtifacts.projectId,
          conversationId: zenArtifacts.conversationId,
          createdAt: zenArtifacts.createdAt,
          updatedAt: zenArtifacts.updatedAt,
        })
        .from(zenArtifacts)
        .where(and(...artifactConditions))
        .orderBy(desc(zenArtifacts.updatedAt))
        .limit(perSourceLimit),
      db
        .select({
          id: zenFiles.id,
          fileName: zenFiles.fileName,
          mimeType: zenFiles.mimeType,
          byteSize: zenFiles.byteSize,
          metadata: zenFiles.metadata,
          projectId: zenFiles.projectId,
          conversationId: zenFiles.conversationId,
          createdAt: zenFiles.createdAt,
          updatedAt: zenFiles.updatedAt,
        })
        .from(zenFiles)
        .where(and(...fileConditions))
        .orderBy(desc(zenFiles.updatedAt))
        .limit(perSourceLimit),
      db
        .select({
          id: zenGeneratedImages.id,
          prompt: zenGeneratedImages.prompt,
          model: zenGeneratedImages.model,
          status: zenGeneratedImages.status,
          projectId: zenGeneratedImages.projectId,
          conversationId: zenGeneratedImages.conversationId,
          messageId: zenGeneratedImages.messageId,
          createdAt: zenGeneratedImages.createdAt,
        })
        .from(zenGeneratedImages)
        .where(and(...imageConditions))
        .orderBy(desc(zenGeneratedImages.createdAt))
        .limit(perSourceLimit),
      db
        .select({
          id: zenPromptWorkflowRuns.id,
          workflowId: zenPromptWorkflowRuns.workflowId,
          workflowTitle: zenPromptWorkflows.title,
          projectId: zenPromptWorkflowRuns.projectId,
          conversationId: zenPromptWorkflowRuns.conversationId,
          status: zenPromptWorkflowRuns.status,
          startedAt: zenPromptWorkflowRuns.startedAt,
          completedAt: zenPromptWorkflowRuns.completedAt,
          updatedAt: zenPromptWorkflowRuns.updatedAt,
        })
        .from(zenPromptWorkflowRuns)
        .leftJoin(
          zenPromptWorkflows,
          eq(zenPromptWorkflowRuns.workflowId, zenPromptWorkflows.id)
        )
        .where(and(...workflowConditions))
        .orderBy(desc(zenPromptWorkflowRuns.updatedAt))
        .limit(perSourceLimit),
      db
        .select({
          id: zenModelComparisons.id,
          prompt: zenModelComparisons.prompt,
          conversationId: zenModelComparisons.conversationId,
          projectId: zenModelComparisons.projectId,
          updatedAt: zenModelComparisons.updatedAt,
        })
        .from(zenModelComparisons)
        .where(and(...modelComparisonConditions))
        .orderBy(desc(zenModelComparisons.updatedAt))
        .limit(perSourceLimit),
      projectId
        ? Promise.resolve([])
        : db
            .select({
              id: zenCustomAssistants.id,
              name: zenCustomAssistants.name,
              description: zenCustomAssistants.description,
              baseMode: zenCustomAssistants.baseMode,
              createdAt: zenCustomAssistants.createdAt,
            })
            .from(zenCustomAssistants)
            .where(
              and(
                eq(zenCustomAssistants.userId, userId),
                ...(before
                  ? [lt(zenCustomAssistants.createdAt, new Date(before))]
                  : [])
              )
            )
            .orderBy(desc(zenCustomAssistants.createdAt))
            .limit(perSourceLimit),
      projectId
        ? Promise.resolve([])
        : db
            .select({
              id: zenPlanChangeRequests.id,
              currentTier: zenPlanChangeRequests.currentTier,
              requestedTier: zenPlanChangeRequests.requestedTier,
              status: zenPlanChangeRequests.status,
              createdAt: zenPlanChangeRequests.createdAt,
              updatedAt: zenPlanChangeRequests.updatedAt,
            })
            .from(zenPlanChangeRequests)
            .where(
              and(
                eq(zenPlanChangeRequests.userId, userId),
                ...(before
                  ? [lt(zenPlanChangeRequests.updatedAt, new Date(before))]
                  : [])
              )
            )
            .orderBy(desc(zenPlanChangeRequests.updatedAt))
            .limit(perSourceLimit),
    ])

    const items: WorkspaceActivityItem[] = []

    for (const row of projectRows) {
      const target: SearchResultTarget = {
        type: 'open_project',
        projectId: row.id,
      }
      items.push(
        activity({
          id: `project_created:${row.id}`,
          type: 'project_created',
          sourceType: 'project',
          sourceId: row.id,
          occurredAt: toIsoString(row.createdAt),
          title: `Project created: ${row.name}`,
          description: safeDescription(row.description, 'Project workspace created.'),
          target,
          ...projectDetails(row.id, projectNames),
        })
      )

      if (shouldEmitUpdatedActivity(row.createdAt, row.updatedAt)) {
        items.push(
          activity({
            id: `project_updated:${row.id}`,
            type: 'project_updated',
            sourceType: 'project',
            sourceId: row.id,
            occurredAt: toIsoString(row.updatedAt),
            title: `Project updated: ${row.name}`,
            description: safeDescription(row.description, 'Project workspace updated.'),
            target,
            ...projectDetails(row.id, projectNames),
          })
        )
      }
    }

    for (const row of conversationRows) {
      const target: SearchResultTarget = {
        type: 'open_conversation',
        conversationId: row.id,
      }
      items.push(
        activity({
          id: `conversation_created:${row.id}`,
          type: 'conversation_created',
          sourceType: 'conversation',
          sourceId: row.id,
          conversationId: row.id,
          occurredAt: toIsoString(row.createdAt),
          title: `Conversation started: ${row.title}`,
          description: safeDescription(row.preview, 'New conversation created.'),
          target,
          ...projectDetails(row.projectId, projectNames),
          metadata: safeMetadata({
            assistantFamily: row.assistantFamily,
            mode: row.mode,
          }),
        })
      )

      if (shouldEmitUpdatedActivity(row.createdAt, row.updatedAt)) {
        items.push(
          activity({
            id: `conversation_updated:${row.id}`,
            type: 'conversation_updated',
            sourceType: 'conversation',
            sourceId: row.id,
            conversationId: row.id,
            occurredAt: toIsoString(row.updatedAt),
            title: `Conversation updated: ${row.title}`,
            description: safeDescription(row.preview, 'Conversation activity updated.'),
            target,
            ...projectDetails(row.projectId, projectNames),
            metadata: safeMetadata({
              assistantFamily: row.assistantFamily,
              mode: row.mode,
            }),
          })
        )
      }
    }

    for (const row of messageRows) {
      items.push(
        activity({
          id: `message_sent:${row.id}`,
          type: 'message_sent',
          sourceType: 'message',
          sourceId: row.id,
          conversationId: row.conversationId,
          occurredAt: toIsoString(row.createdAt),
          title: `Message sent in ${row.conversationTitle}`,
          description: safeDescription(row.content, 'User message sent.'),
          target: {
            type: 'open_conversation',
            conversationId: row.conversationId,
            messageId: row.id,
          },
          ...projectDetails(row.projectId, projectNames),
          metadata: safeMetadata({ mode: row.mode }),
        })
      )
    }

    for (const row of artifactRows) {
      const target: SearchResultTarget = {
        type: 'open_artifact',
        artifactId: row.id,
        projectId: row.projectId,
      }
      items.push(
        activity({
          id: `artifact_created:${row.id}`,
          type: 'artifact_created',
          sourceType: 'artifact',
          sourceId: row.id,
          conversationId: row.conversationId,
          occurredAt: toIsoString(row.createdAt),
          title: `Artifact created: ${row.title}`,
          description: `${row.artifactType} artifact from ${row.sourceType}.`,
          target,
          ...projectDetails(row.projectId, projectNames),
          metadata: safeMetadata({
            artifactType: row.artifactType,
            sourceType: row.sourceType,
          }),
        })
      )

      if (shouldEmitUpdatedActivity(row.createdAt, row.updatedAt)) {
        items.push(
          activity({
            id: `artifact_updated:${row.id}`,
            type: 'artifact_updated',
            sourceType: 'artifact',
            sourceId: row.id,
            conversationId: row.conversationId,
            occurredAt: toIsoString(row.updatedAt),
            title: `Artifact updated: ${row.title}`,
            description: `${row.artifactType} artifact was edited or restored.`,
            target,
            ...projectDetails(row.projectId, projectNames),
            metadata: safeMetadata({
              artifactType: row.artifactType,
              sourceType: row.sourceType,
            }),
          })
        )
      }
    }

    for (const row of fileRows) {
      const target: SearchResultTarget = {
        type: 'open_url',
        url: `/?tool=ask-files${row.projectId ? `&projectId=${encodeURIComponent(row.projectId)}` : ''}&fileId=${row.id}`,
      }
      items.push(
        activity({
          id: `file_uploaded:${row.id}`,
          type: 'file_uploaded',
          sourceType: 'file',
          sourceId: row.id,
          conversationId: row.conversationId,
          occurredAt: toIsoString(row.createdAt),
          title: `File uploaded: ${row.fileName}`,
          description: row.mimeType
            ? `${row.mimeType}${row.byteSize ? ` · ${row.byteSize.toLocaleString()} bytes` : ''}`
            : 'Private workspace file uploaded.',
          target,
          ...projectDetails(row.projectId, projectNames),
          metadata: safeMetadata({
            mimeType: row.mimeType,
            byteSize: row.byteSize,
          }),
        })
      )

      const knowledge = normalizeFileKnowledge(
        toJsonObject<Record<string, unknown>>(row.metadata, {})
      )
      if (knowledge.knowledgeStatus !== 'pending') {
        const type = `file_${knowledge.knowledgeStatus}` as WorkspaceActivityType
        const occurredAt =
          knowledge.knowledgeUpdatedAt &&
          !Number.isNaN(new Date(knowledge.knowledgeUpdatedAt).getTime())
            ? new Date(knowledge.knowledgeUpdatedAt).toISOString()
            : toIsoString(row.updatedAt)
        items.push(
          activity({
            id: `${type}:${row.id}`,
            type,
            sourceType: 'file',
            sourceId: row.id,
            conversationId: row.conversationId,
            occurredAt,
            title: `File ${knowledge.knowledgeStatusLabel.toLowerCase()}: ${row.fileName}`,
            description: safeDescription(
              knowledge.knowledgeReason,
              knowledge.knowledgeStatus === 'indexed'
                ? `${knowledge.chunkCount} chunks are available for Ask Files.`
                : 'File knowledge status updated.'
            ),
            target,
            ...projectDetails(row.projectId, projectNames),
            metadata: safeMetadata({
              status: knowledge.knowledgeStatus,
              chunkCount: knowledge.chunkCount,
              embeddingModel: knowledge.embeddingModel,
            }),
          })
        )
      }
    }

    for (const row of imageRows) {
      items.push(
        activity({
          id: `image_generated:${row.id}`,
          type: 'image_generated',
          sourceType: 'generated_image',
          sourceId: row.id,
          conversationId: row.conversationId,
          occurredAt: toIsoString(row.createdAt),
          title: 'Image generated',
          description: safeDescription(row.prompt, 'Prism image generated.'),
          target: {
            type: 'open_prism_history',
            imageId: row.id,
            conversationId: row.conversationId ?? undefined,
            projectId: row.projectId,
          },
          ...projectDetails(row.projectId, projectNames),
          metadata: safeMetadata({
            model: row.model,
            status: row.status,
          }),
        })
      )
    }

    for (const row of workflowRunRows) {
      const workflowTitle = row.workflowTitle ?? 'Playbook'
      const target: SearchResultTarget = row.workflowId
        ? { type: 'open_prompt_library', workflowId: row.workflowId }
        : { type: 'open_url', url: '/?tool=playbooks' }

      items.push(
        activity({
          id: `playbook_run_started:${row.id}`,
          type: 'playbook_run_started',
          sourceType: 'playbook_run',
          sourceId: row.id,
          conversationId: row.conversationId,
          occurredAt: toIsoString(row.startedAt),
          title: `Playbook started: ${workflowTitle}`,
          description: 'Playbook run started.',
          target,
          ...projectDetails(row.projectId, projectNames),
          metadata: safeMetadata({ status: row.status }),
        })
      )

      if (row.status === 'complete' || row.status === 'failed') {
        const type =
          row.status === 'complete'
            ? 'playbook_run_completed'
            : 'playbook_run_failed'
        items.push(
          activity({
            id: `${type}:${row.id}`,
            type,
            sourceType: 'playbook_run',
            sourceId: row.id,
            conversationId: row.conversationId,
            occurredAt: toIsoString(row.completedAt ?? row.updatedAt),
            title:
              row.status === 'complete'
                ? `Playbook completed: ${workflowTitle}`
                : `Playbook failed: ${workflowTitle}`,
            description:
              row.status === 'complete'
                ? 'Playbook run finished successfully.'
                : 'Playbook run failed. Open Playbooks for details.',
            target,
            ...projectDetails(row.projectId, projectNames),
            metadata: safeMetadata({ status: row.status }),
          })
        )
      }
    }

    for (const row of modelComparisonRows) {
      items.push(
        activity({
          id: `model_duel_completed:${row.id}`,
          type: 'model_duel_completed',
          sourceType: 'model_comparison',
          sourceId: row.id,
          conversationId: row.conversationId,
          occurredAt: toIsoString(row.updatedAt),
          title: 'Model Duel completed',
          description: safeDescription(row.prompt, 'Text model comparison completed.'),
          target: {
            type: 'open_model_comparison',
            comparisonId: row.id,
            conversationId: row.conversationId,
          },
          ...projectDetails(row.projectId, projectNames),
        })
      )
    }

    for (const row of customAssistantRows) {
      items.push(
        activity({
          id: `custom_assistant_created:${row.id}`,
          type: 'custom_assistant_created',
          sourceType: 'custom_assistant',
          sourceId: row.id,
          occurredAt: toIsoString(row.createdAt),
          title: `Custom assistant created: ${row.name}`,
          description: safeDescription(
            row.description,
            `Private assistant based on ${row.baseMode}.`
          ),
          target: {
            type: 'open_custom_assistants',
            assistantId: row.id,
          },
          projectId: null,
          projectName: null,
          metadata: safeMetadata({ baseMode: row.baseMode }),
        })
      )
    }

    for (const row of planRequestRows) {
      items.push(
        activity({
          id: `plan_request_submitted:${row.id}`,
          type: 'plan_request_submitted',
          sourceType: 'plan_request',
          sourceId: row.id,
          occurredAt: toIsoString(row.createdAt),
          title: `Plan request submitted: ${row.requestedTier.toUpperCase()}`,
          description: `Requested ${row.requestedTier.toUpperCase()} from ${row.currentTier.toUpperCase()}.`,
          target: { type: 'open_url', url: '/pricing' },
          projectId: null,
          projectName: null,
          metadata: safeMetadata({ status: row.status }),
        })
      )

      if (shouldEmitUpdatedActivity(row.createdAt, row.updatedAt)) {
        items.push(
          activity({
            id: `plan_request_updated:${row.id}`,
            type: 'plan_request_updated',
            sourceType: 'plan_request',
            sourceId: row.id,
            occurredAt: toIsoString(row.updatedAt),
            title: `Plan request updated: ${row.status}`,
            description: `Manual plan request is now ${row.status}.`,
            target: { type: 'open_url', url: '/pricing' },
            projectId: null,
            projectName: null,
            metadata: safeMetadata({ status: row.status }),
          })
        )
      }
    }

    return sortAndPageActivities(items, {
      limit,
      before,
      projectId,
      type: options.type ?? null,
    })
  }
}

export const neonActivityRepository = new NeonActivityRepository()
