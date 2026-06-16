import 'server-only'

import { desc, eq, sql } from 'drizzle-orm'
import { buildWorkspaceHomeSuggestions } from '@/lib/workspace-home/suggestions'
import { normalizeFileKnowledge } from '@/lib/files/intelligence'
import {
  AssistantFamily,
  PromptWorkflowRunStatus,
  SearchResultTarget,
  WorkspaceHomeArtifactSummary,
  WorkspaceHomeContinueItem,
  WorkspaceHomeConversationSummary,
  WorkspaceHomeFileSummary,
  WorkspaceHomeImageSummary,
  WorkspaceHomePlaybookRunSummary,
  WorkspaceHomeProjectSummary,
  WorkspaceHomeResponse,
  WorkspaceHomeUsageSnapshot,
} from '@/types'
import { getDatabaseClient } from '../client'
import {
  zenArtifacts,
  zenConversations,
  zenFiles,
  zenGeneratedImages,
  zenProjects,
  zenPromptWorkflowRuns,
  zenPromptWorkflows,
} from '../schema'
import {
  toIsoString,
  toJsonObject,
  toNullableIsoString,
  toNumber,
} from './helpers'

const WORKSPACE_HOME_ITEM_LIMIT = 6
const WORKSPACE_HOME_PROJECT_NAME_LIMIT = 100

function truncate(value: string | null | undefined, fallback: string): string {
  const normalized = value?.replace(/\s+/g, ' ').trim() || fallback
  if (normalized.length <= 140) return normalized
  return `${normalized.slice(0, 137).trimEnd()}...`
}

function projectLabel(
  projectId: string | null | undefined,
  projectNames: Map<string, string>
): Pick<WorkspaceHomeConversationSummary, 'projectId' | 'projectName'> {
  if (!projectId) return { projectId: null, projectName: null }
  return {
    projectId,
    projectName: projectNames.get(projectId) ?? null,
  }
}

function continueItem(input: {
  id: string
  type: WorkspaceHomeContinueItem['type']
  title: string
  description: string
  occurredAt: string
  projectId?: string | null
  projectName?: string | null
  target: SearchResultTarget
}): WorkspaceHomeContinueItem {
  return input
}

function buildContinueItems(input: {
  projects: WorkspaceHomeProjectSummary[]
  conversations: WorkspaceHomeConversationSummary[]
  artifacts: WorkspaceHomeArtifactSummary[]
  playbookRuns: WorkspaceHomePlaybookRunSummary[]
  files: WorkspaceHomeFileSummary[]
  images: WorkspaceHomeImageSummary[]
}): WorkspaceHomeContinueItem[] {
  const items: WorkspaceHomeContinueItem[] = []

  for (const conversation of input.conversations.slice(0, 3)) {
    items.push(
      continueItem({
        id: `conversation:${conversation.id}`,
        type: 'conversation',
        title: conversation.title,
        description: truncate(conversation.preview, 'Continue this conversation.'),
        occurredAt: conversation.updatedAt,
        projectId: conversation.projectId,
        projectName: conversation.projectName,
        target: {
          type: 'open_conversation',
          conversationId: conversation.id,
        },
      })
    )
  }

  for (const project of input.projects.slice(0, 2)) {
    items.push(
      continueItem({
        id: `project:${project.id}`,
        type: 'project',
        title: project.name,
        description: truncate(project.description, 'Open this project home.'),
        occurredAt: project.updatedAt,
        projectId: project.id,
        projectName: project.name,
        target: {
          type: 'open_project',
          projectId: project.id,
        },
      })
    )
  }

  for (const artifact of input.artifacts.slice(0, 2)) {
    items.push(
      continueItem({
        id: `artifact:${artifact.id}`,
        type: 'artifact',
        title: artifact.title,
        description: `${artifact.artifactType} artifact`,
        occurredAt: artifact.updatedAt,
        projectId: artifact.projectId,
        projectName: artifact.projectName,
        target: {
          type: 'open_artifact',
          artifactId: artifact.id,
          projectId: artifact.projectId,
        },
      })
    )
  }

  for (const run of input.playbookRuns.slice(0, 1)) {
    items.push(
      continueItem({
        id: `playbook:${run.id}`,
        type: 'playbook_run',
        title: run.workflowTitle,
        description: `Playbook run ${run.status}`,
        occurredAt: run.completedAt ?? run.updatedAt,
        projectId: run.projectId,
        projectName: run.projectName,
        target: run.workflowId
          ? { type: 'open_prompt_library', workflowId: run.workflowId }
          : { type: 'open_url', url: '/?tool=playbooks' },
      })
    )
  }

  for (const file of input.files.slice(0, 1)) {
    const url = `/?tool=ask-files${file.projectId ? `&projectId=${encodeURIComponent(file.projectId)}` : ''}&fileId=${file.id}`
    items.push(
      continueItem({
        id: `file:${file.id}`,
        type: 'file',
        title: file.fileName,
        description: file.knowledgeStatusLabel,
        occurredAt: file.updatedAt,
        projectId: file.projectId,
        projectName: file.projectName,
        target: { type: 'open_url', url },
      })
    )
  }

  for (const image of input.images.slice(0, 1)) {
    items.push(
      continueItem({
        id: `image:${image.id}`,
        type: 'image',
        title: 'Prism image',
        description: truncate(image.prompt, 'Open this Prism image.'),
        occurredAt: image.createdAt,
        projectId: image.projectId,
        projectName: image.projectName,
        target: {
          type: 'open_prism_history',
          imageId: image.id,
          conversationId: image.conversationId ?? undefined,
          projectId: image.projectId,
        },
      })
    )
  }

  return items
    .sort(
      (left, right) =>
        new Date(right.occurredAt).getTime() -
        new Date(left.occurredAt).getTime()
    )
    .slice(0, 5)
}

class NeonWorkspaceHomeRepository {
  async get(
    userId: string,
    usageSnapshot: WorkspaceHomeUsageSnapshot
  ): Promise<WorkspaceHomeResponse> {
    const db = getDatabaseClient()

    const projectRows = await db
      .select({
        id: zenProjects.id,
        name: zenProjects.name,
        description: zenProjects.description,
        color: zenProjects.color,
        isDefault: zenProjects.isDefault,
        createdAt: zenProjects.createdAt,
        updatedAt: zenProjects.updatedAt,
      })
      .from(zenProjects)
      .where(eq(zenProjects.userId, userId))
      .orderBy(desc(zenProjects.updatedAt))
      .limit(WORKSPACE_HOME_PROJECT_NAME_LIMIT)

    const projectNames = new Map(projectRows.map((row) => [row.id, row.name]))

    const [
      conversationRows,
      artifactRows,
      playbookRunRows,
      fileRows,
      imageRows,
      workflowCountRows,
    ] = await Promise.all([
      db
        .select({
          id: zenConversations.id,
          title: zenConversations.title,
          preview: zenConversations.preview,
          mode: zenConversations.mode,
          assistantFamily: zenConversations.assistantFamily,
          projectId: zenConversations.projectId,
          messageCount: zenConversations.messageCount,
          isPinned: zenConversations.isPinned,
          createdAt: zenConversations.createdAt,
          updatedAt: zenConversations.updatedAt,
        })
        .from(zenConversations)
        .where(eq(zenConversations.userId, userId))
        .orderBy(desc(zenConversations.updatedAt))
        .limit(WORKSPACE_HOME_ITEM_LIMIT),
      db
        .select({
          id: zenArtifacts.id,
          title: zenArtifacts.title,
          artifactType: zenArtifacts.artifactType,
          sourceType: zenArtifacts.sourceType,
          projectId: zenArtifacts.projectId,
          conversationId: zenArtifacts.conversationId,
          sourceMessageId: zenArtifacts.sourceMessageId,
          createdAt: zenArtifacts.createdAt,
          updatedAt: zenArtifacts.updatedAt,
        })
        .from(zenArtifacts)
        .where(eq(zenArtifacts.userId, userId))
        .orderBy(desc(zenArtifacts.updatedAt))
        .limit(WORKSPACE_HOME_ITEM_LIMIT),
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
        .where(eq(zenPromptWorkflowRuns.userId, userId))
        .orderBy(desc(zenPromptWorkflowRuns.updatedAt))
        .limit(WORKSPACE_HOME_ITEM_LIMIT),
      db
        .select({
          id: zenFiles.id,
          fileName: zenFiles.fileName,
          mimeType: zenFiles.mimeType,
          byteSize: zenFiles.byteSize,
          projectId: zenFiles.projectId,
          conversationId: zenFiles.conversationId,
          messageId: zenFiles.messageId,
          metadata: zenFiles.metadata,
          createdAt: zenFiles.createdAt,
          updatedAt: zenFiles.updatedAt,
        })
        .from(zenFiles)
        .where(eq(zenFiles.userId, userId))
        .orderBy(desc(zenFiles.createdAt))
        .limit(WORKSPACE_HOME_ITEM_LIMIT),
      db
        .select({
          id: zenGeneratedImages.id,
          prompt: zenGeneratedImages.prompt,
          model: zenGeneratedImages.model,
          status: zenGeneratedImages.status,
          projectId: zenGeneratedImages.projectId,
          conversationId: zenGeneratedImages.conversationId,
          messageId: zenGeneratedImages.messageId,
          width: zenGeneratedImages.width,
          height: zenGeneratedImages.height,
          isFavorite: zenGeneratedImages.isFavorite,
          createdAt: zenGeneratedImages.createdAt,
          updatedAt: zenGeneratedImages.updatedAt,
        })
        .from(zenGeneratedImages)
        .where(eq(zenGeneratedImages.userId, userId))
        .orderBy(desc(zenGeneratedImages.createdAt))
        .limit(WORKSPACE_HOME_ITEM_LIMIT),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(zenPromptWorkflows)
        .where(eq(zenPromptWorkflows.userId, userId)),
    ])

    const recentProjects: WorkspaceHomeProjectSummary[] = projectRows
      .slice(0, WORKSPACE_HOME_ITEM_LIMIT)
      .map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        color: row.color,
        isDefault: row.isDefault,
        createdAt: toIsoString(row.createdAt),
        updatedAt: toIsoString(row.updatedAt),
      }))

    const recentConversations: WorkspaceHomeConversationSummary[] =
      conversationRows.map((row) => ({
        id: row.id,
        title: row.title,
        preview: row.preview,
        mode: row.mode as WorkspaceHomeConversationSummary['mode'],
        assistantFamily: row.assistantFamily as AssistantFamily,
        ...projectLabel(row.projectId, projectNames),
        messageCount: row.messageCount,
        isPinned: row.isPinned,
        createdAt: toIsoString(row.createdAt),
        updatedAt: toIsoString(row.updatedAt),
      }))

    const recentArtifacts: WorkspaceHomeArtifactSummary[] = artifactRows.map(
      (row) => ({
        id: row.id,
        title: row.title,
        artifactType: row.artifactType as WorkspaceHomeArtifactSummary['artifactType'],
        sourceType: row.sourceType as WorkspaceHomeArtifactSummary['sourceType'],
        ...projectLabel(row.projectId, projectNames),
        conversationId: row.conversationId,
        sourceMessageId: row.sourceMessageId,
        createdAt: toIsoString(row.createdAt),
        updatedAt: toIsoString(row.updatedAt),
      })
    )

    const recentPlaybookRuns: WorkspaceHomePlaybookRunSummary[] =
      playbookRunRows.map((row) => ({
        id: row.id,
        workflowId: row.workflowId,
        workflowTitle: row.workflowTitle ?? 'Playbook',
        status: row.status as PromptWorkflowRunStatus,
        ...projectLabel(row.projectId, projectNames),
        conversationId: row.conversationId,
        startedAt: toIsoString(row.startedAt),
        completedAt: toNullableIsoString(row.completedAt),
        updatedAt: toIsoString(row.updatedAt),
      }))

    const recentFiles: WorkspaceHomeFileSummary[] = fileRows.map((row) => {
      const knowledge = normalizeFileKnowledge(
        toJsonObject<Record<string, unknown>>(row.metadata, {})
      )

      return {
        id: row.id,
        fileName: row.fileName,
        mimeType: row.mimeType,
        byteSize: row.byteSize,
        ...projectLabel(row.projectId, projectNames),
        conversationId: row.conversationId,
        messageId: row.messageId,
        knowledgeStatus: knowledge.knowledgeStatus,
        knowledgeStatusLabel: knowledge.knowledgeStatusLabel,
        knowledgeReason: knowledge.knowledgeReason,
        createdAt: toIsoString(row.createdAt),
        updatedAt: toIsoString(row.updatedAt),
      }
    })

    const recentImages: WorkspaceHomeImageSummary[] = imageRows.map((row) => ({
      id: row.id,
      prompt: row.prompt,
      model: row.model,
      status: row.status,
      ...projectLabel(row.projectId, projectNames),
      conversationId: row.conversationId,
      messageId: row.messageId,
      width: row.width,
      height: row.height,
      isFavorite: row.isFavorite,
      createdAt: toIsoString(row.createdAt),
      updatedAt: toIsoString(row.updatedAt),
    }))

    const continueItems = buildContinueItems({
      projects: recentProjects,
      conversations: recentConversations,
      artifacts: recentArtifacts,
      playbookRuns: recentPlaybookRuns,
      files: recentFiles,
      images: recentImages,
    })
    const defaultProject =
      recentProjects.find((project) => project.isDefault) ?? recentProjects[0] ?? null

    return {
      continueItems,
      recentProjects,
      recentConversations,
      recentArtifacts,
      recentPlaybookRuns,
      recentFiles,
      recentImages,
      suggestedActions: buildWorkspaceHomeSuggestions({
        projectCount: projectRows.length,
        conversationCount: recentConversations.length,
        artifactCount: recentArtifacts.length,
        playbookRunCount: recentPlaybookRuns.length,
        fileCount: recentFiles.length,
        imageCount: recentImages.length,
        hasPlaybooks: toNumber(workflowCountRows[0]?.count) > 0,
        defaultProjectId: defaultProject?.id ?? null,
        usageSnapshot,
      }),
      usageSnapshot,
      generatedAt: new Date().toISOString(),
    }
  }
}

export const neonWorkspaceHomeRepository = new NeonWorkspaceHomeRepository()
