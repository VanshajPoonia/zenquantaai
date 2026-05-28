import 'server-only'

import { and, desc, eq, inArray, or, sql } from 'drizzle-orm'
import { normalizeFileKnowledge } from '@/lib/files/intelligence'
import { createPrivateFileUrl } from '@/lib/storage/object-store'
import {
  AssistantFamily,
  Project,
  ProjectHomeArtifactSummary,
  ProjectHomeConversationSummary,
  ProjectHomeFileSummary,
  ProjectHomeGeneratedImageSummary,
  ProjectHomeResponse,
  ProjectHomeSuggestedAction,
  ProjectHomeWorkflowSummary,
} from '@/types'
import { getDatabaseClient } from '../client'
import {
  zenArtifacts,
  zenConversations,
  zenFiles,
  zenGeneratedImages,
  zenIntegrationAccounts,
  zenIntegrationItems,
  zenProjects,
  zenPromptWorkflows,
  zenPromptWorkflowSteps,
} from '../schema'
import { toIsoString, toNullableIsoString } from './helpers'

const PROJECT_HOME_ITEM_LIMIT = 8

type ProjectRow = typeof zenProjects.$inferSelect

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    color: row.color,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
    isDefault: row.isDefault,
  }
}

function toNumber(value: unknown): number {
  const numberValue = Number(value ?? 0)
  return Number.isFinite(numberValue) ? numberValue : 0
}

function jsonArrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0
}

function toPrivateFileUrl(
  bucket: string | null,
  storagePath: string | null,
  download = false
): string | null {
  if (!bucket || !storagePath) return null

  return createPrivateFileUrl({ bucket, storagePath, download })
}

function buildSuggestedActions(input: {
  conversationCount: number
  fileCount: number
  workflowCount: number
  generatedImageCount: number
  webSearchEnabled: boolean
}): ProjectHomeSuggestedAction[] {
  const actions: ProjectHomeSuggestedAction[] = []

  if (input.conversationCount === 0) {
    actions.push({
      id: 'start-chat',
      type: 'start_chat',
      title: 'Start a project chat',
      description: 'Create the first conversation scoped to this project.',
    })
  }

  if (input.fileCount === 0) {
    actions.push({
      id: 'upload-files',
      type: 'upload_file',
      title: 'Upload reference files',
      description: 'Add source material that future project chats can use.',
    })
  }

  if (input.workflowCount === 0) {
    actions.push({
      id: 'create-playbook',
      type: 'run_workflow',
      title: 'Create or run a playbook',
      description: 'Use prompt workflows to repeat project-specific steps.',
    })
  }

  if (input.generatedImageCount > 0) {
    actions.push({
      id: 'review-images',
      type: 'review_images',
      title: 'Review image history',
      description: 'Open recent Prism outputs connected to this project.',
    })
  }

  if (input.webSearchEnabled) {
    actions.push({
      id: 'research-topic',
      type: 'research_project',
      title: 'Research this project topic',
      description: 'Switch to Pulse and draft a research prompt for the project.',
    })
  }

  return actions
}

class NeonProjectHomeRepository {
  async get(
    userId: string,
    projectId: string,
    options: { webSearchEnabled?: boolean; embeddingsAvailable?: boolean } = {}
  ): Promise<ProjectHomeResponse | null> {
    const db = getDatabaseClient()
    const projectRows = await db
      .select()
      .from(zenProjects)
      .where(and(eq(zenProjects.userId, userId), eq(zenProjects.id, projectId)))
      .limit(1)
    const project = projectRows[0] ? rowToProject(projectRows[0]) : null

    if (!project) return null

    const conversationScope = and(
      eq(zenConversations.userId, userId),
      eq(zenConversations.projectId, projectId)
    )
    const fileScope = and(eq(zenFiles.userId, userId), eq(zenFiles.projectId, projectId))
    const workflowScope = and(
      eq(zenPromptWorkflows.userId, userId),
      eq(zenPromptWorkflows.projectId, projectId)
    )
    const artifactScope = and(
      eq(zenArtifacts.userId, userId),
      eq(zenArtifacts.projectId, projectId)
    )

    const [
      conversationStatsRows,
      recentConversationRows,
      fileStatsRows,
      fileRows,
      workflowStatsRows,
      workflowRows,
      imageStatsRows,
      imageRows,
      artifactStatsRows,
      artifactRows,
      githubAccountRows,
      githubRepoRows,
    ] = await Promise.all([
      db
        .select({
          conversationCount: sql<number>`count(*)::int`,
          messageCount: sql<number>`coalesce(sum(${zenConversations.messageCount}), 0)::int`,
          memoryConversationCount: sql<number>`count(*) filter (where ${zenConversations.memorySummary} is not null and length(trim(${zenConversations.memorySummary})) > 0)::int`,
          latestMemoryUpdatedAt: sql<Date | null>`max(${zenConversations.memoryUpdatedAt})`,
        })
        .from(zenConversations)
        .where(conversationScope),
      db
        .select()
        .from(zenConversations)
        .where(conversationScope)
        .orderBy(desc(zenConversations.updatedAt))
        .limit(PROJECT_HOME_ITEM_LIMIT),
      db
        .select({ fileCount: sql<number>`count(*)::int` })
        .from(zenFiles)
        .where(fileScope),
      db
        .select()
        .from(zenFiles)
        .where(fileScope)
        .orderBy(desc(zenFiles.createdAt))
        .limit(PROJECT_HOME_ITEM_LIMIT),
      db
        .select({ workflowCount: sql<number>`count(*)::int` })
        .from(zenPromptWorkflows)
        .where(workflowScope),
      db
        .select()
        .from(zenPromptWorkflows)
        .where(workflowScope)
        .orderBy(desc(zenPromptWorkflows.updatedAt))
        .limit(PROJECT_HOME_ITEM_LIMIT),
      db
        .select({ generatedImageCount: sql<number>`count(*)::int` })
        .from(zenGeneratedImages)
        .leftJoin(
          zenConversations,
          eq(zenGeneratedImages.conversationId, zenConversations.id)
        )
        .where(
          and(
            eq(zenGeneratedImages.userId, userId),
            or(
              eq(zenGeneratedImages.projectId, projectId),
              and(
                eq(zenConversations.userId, userId),
                eq(zenConversations.projectId, projectId)
              )
            )
          )
        ),
      db
        .select({
          id: zenGeneratedImages.id,
          projectId: zenGeneratedImages.projectId,
          conversationId: zenGeneratedImages.conversationId,
          messageId: zenGeneratedImages.messageId,
          prompt: zenGeneratedImages.prompt,
          model: zenGeneratedImages.model,
          status: zenGeneratedImages.status,
          storageBucket: zenGeneratedImages.storageBucket,
          storagePath: zenGeneratedImages.storagePath,
          width: zenGeneratedImages.width,
          height: zenGeneratedImages.height,
          isFavorite: zenGeneratedImages.isFavorite,
          createdAt: zenGeneratedImages.createdAt,
          updatedAt: zenGeneratedImages.updatedAt,
        })
        .from(zenGeneratedImages)
        .leftJoin(
          zenConversations,
          eq(zenGeneratedImages.conversationId, zenConversations.id)
        )
        .where(
          and(
            eq(zenGeneratedImages.userId, userId),
            or(
              eq(zenGeneratedImages.projectId, projectId),
              and(
                eq(zenConversations.userId, userId),
                eq(zenConversations.projectId, projectId)
              )
            )
          )
        )
        .orderBy(desc(zenGeneratedImages.createdAt))
        .limit(PROJECT_HOME_ITEM_LIMIT),
      db
        .select({ artifactCount: sql<number>`count(*)::int` })
        .from(zenArtifacts)
        .where(artifactScope),
      db
        .select()
        .from(zenArtifacts)
        .where(artifactScope)
        .orderBy(desc(zenArtifacts.updatedAt))
        .limit(PROJECT_HOME_ITEM_LIMIT),
      db
        .select()
        .from(zenIntegrationAccounts)
        .where(
          and(
            eq(zenIntegrationAccounts.userId, userId),
            eq(zenIntegrationAccounts.provider, 'github')
          )
        )
        .limit(1),
      db
        .select({
          fullName: zenIntegrationItems.repoFullName,
          branch: zenIntegrationItems.branch,
          importedCount: sql<number>`count(*)::int`,
          lastImportedAt: sql<Date | null>`max(${zenIntegrationItems.lastImportedAt})`,
        })
        .from(zenIntegrationItems)
        .where(
          and(
            eq(zenIntegrationItems.userId, userId),
            eq(zenIntegrationItems.provider, 'github'),
            eq(zenIntegrationItems.projectId, projectId),
            eq(zenIntegrationItems.status, 'imported')
          )
        )
        .groupBy(zenIntegrationItems.repoFullName, zenIntegrationItems.branch)
        .orderBy(sql`max(${zenIntegrationItems.lastImportedAt}) desc nulls last`)
        .limit(PROJECT_HOME_ITEM_LIMIT),
    ])

    const workflowIds = workflowRows.map((workflow) => workflow.id)
    const stepCountRows =
      workflowIds.length > 0
        ? await db
            .select({
              workflowId: zenPromptWorkflowSteps.workflowId,
              stepCount: sql<number>`count(*)::int`,
            })
            .from(zenPromptWorkflowSteps)
            .where(inArray(zenPromptWorkflowSteps.workflowId, workflowIds))
            .groupBy(zenPromptWorkflowSteps.workflowId)
        : []
    const stepCountByWorkflow = new Map(
      stepCountRows.map((row) => [row.workflowId, toNumber(row.stepCount)])
    )

    const conversationStats = conversationStatsRows[0]
    const conversationCount = toNumber(conversationStats?.conversationCount)
    const messageCount = toNumber(conversationStats?.messageCount)
    const memoryConversationCount = toNumber(
      conversationStats?.memoryConversationCount
    )
    const fileCount = toNumber(fileStatsRows[0]?.fileCount)
    const workflowCount = toNumber(workflowStatsRows[0]?.workflowCount)
    const generatedImageCount = toNumber(imageStatsRows[0]?.generatedImageCount)
    const artifactCount = toNumber(artifactStatsRows[0]?.artifactCount)

    const recentConversations: ProjectHomeConversationSummary[] =
      recentConversationRows.map((row) => ({
        id: row.id,
        title: row.title,
        mode: row.mode as ProjectHomeConversationSummary['mode'],
        assistantFamily: row.assistantFamily as AssistantFamily,
        preview: row.preview,
        messageCount: row.messageCount,
        isPinned: row.isPinned,
        memorySummary: row.memorySummary,
        memoryUpdatedAt: toNullableIsoString(row.memoryUpdatedAt),
        createdAt: toIsoString(row.createdAt),
        updatedAt: toIsoString(row.updatedAt),
      }))

    const uploadedFiles: ProjectHomeFileSummary[] = fileRows.map((row) => {
      const metadata =
        row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : {}
      const knowledge = normalizeFileKnowledge(metadata)

      return {
        id: row.id,
        fileName: row.fileName,
        mimeType: row.mimeType,
        byteSize: row.byteSize,
        projectId: row.projectId,
        conversationId: row.conversationId,
        messageId: row.messageId,
        visibility: row.visibility as ProjectHomeFileSummary['visibility'],
        viewUrl: toPrivateFileUrl(row.bucket, row.storagePath),
        downloadUrl: toPrivateFileUrl(row.bucket, row.storagePath, true),
        ...knowledge,
        embeddingsAvailable: Boolean(options.embeddingsAvailable),
        createdAt: toIsoString(row.createdAt),
        updatedAt: toIsoString(row.updatedAt),
        metadata: {
          private: row.visibility === 'private',
          provider: row.provider,
        },
      }
    })

    const generatedImages: ProjectHomeGeneratedImageSummary[] = imageRows.map(
      (row) => ({
        id: row.id,
        prompt: row.prompt,
        model: row.model,
        status: row.status,
        projectId: row.projectId,
        conversationId: row.conversationId,
        messageId: row.messageId,
        width: row.width,
        height: row.height,
        url: toPrivateFileUrl(row.storageBucket, row.storagePath),
        isFavorite: row.isFavorite,
        createdAt: toIsoString(row.createdAt),
        updatedAt: toIsoString(row.updatedAt),
      })
    )

    const workflows: ProjectHomeWorkflowSummary[] = workflowRows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      stepCount: stepCountByWorkflow.get(row.id) ?? 0,
      variableCount: jsonArrayLength(row.variables),
      createdAt: toIsoString(row.createdAt),
      updatedAt: toIsoString(row.updatedAt),
    }))

    const artifacts: ProjectHomeArtifactSummary[] = artifactRows.map((row) => ({
      id: row.id,
      title: row.title,
      artifactType: row.artifactType as ProjectHomeArtifactSummary['artifactType'],
      sourceType: row.sourceType as ProjectHomeArtifactSummary['sourceType'],
      conversationId: row.conversationId,
      sourceMessageId: row.sourceMessageId,
      createdAt: toIsoString(row.createdAt),
      updatedAt: toIsoString(row.updatedAt),
    }))

    const githubRepositories = githubRepoRows
      .filter((row) => row.fullName)
      .map((row) => ({
        fullName: row.fullName ?? '',
        branch: row.branch,
        importedCount: toNumber(row.importedCount),
        lastImportedAt: toNullableIsoString(row.lastImportedAt),
      }))
    const githubIntegration = {
      connected: githubAccountRows[0]?.status === 'connected',
      accountLogin: githubAccountRows[0]?.externalAccountLogin ?? null,
      importedCount: githubRepositories.reduce(
        (total, repo) => total + repo.importedCount,
        0
      ),
      lastImportedAt:
        githubRepositories
          .map((repo) => repo.lastImportedAt)
          .filter(Boolean)
          .sort()
          .at(-1) ?? null,
      repositories: githubRepositories,
    }

    return {
      project,
      overview: {
        conversationCount,
        messageCount,
        fileCount,
        workflowCount,
        generatedImageCount,
        artifactCount,
        memoryConversationCount,
      },
      recentConversations,
      uploadedFiles,
      generatedImages,
      workflows,
      artifacts,
      githubIntegration,
      memoryStatus: {
        status: memoryConversationCount > 0 ? 'active' : 'empty',
        conversationCount,
        memoryConversationCount,
        latestMemoryUpdatedAt: toNullableIsoString(
          conversationStats?.latestMemoryUpdatedAt ?? null
        ),
      },
      suggestedActions: buildSuggestedActions({
        conversationCount,
        fileCount,
        workflowCount,
        generatedImageCount,
        webSearchEnabled: Boolean(options.webSearchEnabled),
      }),
      generatedAt: new Date().toISOString(),
    }
  }
}

export const neonProjectHomeRepository = new NeonProjectHomeRepository()
