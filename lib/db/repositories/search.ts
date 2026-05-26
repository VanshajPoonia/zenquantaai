import 'server-only'

import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { SearchResult } from '@/types'
import { getDatabaseClient } from '../client'
import {
  zenArtifacts,
  zenConversations,
  zenCustomAssistants,
  zenFiles,
  zenGeneratedImages,
  zenMessages,
  zenModelComparisons,
  zenProjects,
  zenPromptLibrary,
  zenPromptWorkflows,
  zenPromptWorkflowSteps,
} from '../schema'
import { toIsoString } from './helpers'

const MIN_QUERY_LENGTH = 2
const MAX_QUERY_LENGTH = 120
const PER_ENTITY_LIMIT = 10
const MAX_TOTAL_RESULTS = 50

function normalizeQuery(query: string): string {
  return query.replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_LENGTH)
}

function toPattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, (match) => `\\${match}`)}%`
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function buildSnippet(query: string, ...values: Array<string | null | undefined>) {
  const normalizedValues = values.map(normalizeText).filter(Boolean)
  const normalizedQuery = query.toLowerCase()
  const matchingValue =
    normalizedValues.find((value) => value.toLowerCase().includes(normalizedQuery)) ??
    normalizedValues[0] ??
    ''

  if (!matchingValue) return ''

  const matchIndex = matchingValue.toLowerCase().indexOf(normalizedQuery)
  if (matchIndex === -1) {
    return matchingValue.length > 180
      ? `${matchingValue.slice(0, 177).trimEnd()}...`
      : matchingValue
  }

  const start = Math.max(0, matchIndex - 70)
  const end = Math.min(matchingValue.length, matchIndex + query.length + 110)
  const prefix = start > 0 ? '...' : ''
  const suffix = end < matchingValue.length ? '...' : ''

  return `${prefix}${matchingValue.slice(start, end).trim()}${suffix}`
}

function sortResults(results: SearchResult[]): SearchResult[] {
  return [...results]
    .sort((a, b) => {
      const aTime = new Date(a.updatedAt ?? a.createdAt).getTime()
      const bTime = new Date(b.updatedAt ?? b.createdAt).getTime()

      return bTime - aTime || a.title.localeCompare(b.title)
    })
    .slice(0, MAX_TOTAL_RESULTS)
}

class NeonSearchRepository {
  async search(
    userId: string,
    rawQuery: string,
    options: { projectId?: string | null } = {}
  ): Promise<SearchResult[]> {
    const query = normalizeQuery(rawQuery)
    if (query.length < MIN_QUERY_LENGTH) return []

    const pattern = toPattern(query)
    const projectId = options.projectId?.trim() || null

    if (projectId) {
      const [
        conversations,
        messages,
        artifacts,
        workflows,
        files,
        generatedImages,
        modelComparisons,
      ] = await Promise.all([
        this.searchConversations(userId, query, pattern, projectId),
        this.searchMessages(userId, query, pattern, projectId),
        this.searchArtifacts(userId, query, pattern, projectId),
        this.searchWorkflows(userId, query, pattern, projectId),
        this.searchFiles(userId, query, pattern, projectId),
        this.searchGeneratedImages(userId, query, pattern, projectId),
        this.searchModelComparisons(userId, query, pattern, projectId),
      ])

      return sortResults([
        ...conversations,
        ...messages,
        ...artifacts,
        ...workflows,
        ...files,
        ...generatedImages,
        ...modelComparisons,
      ])
    }

    const [
      projects,
      conversations,
      messages,
      artifacts,
      prompts,
      workflows,
      customAssistants,
      files,
      generatedImages,
      modelComparisons,
    ] = await Promise.all([
      this.searchProjects(userId, query, pattern),
      this.searchConversations(userId, query, pattern),
      this.searchMessages(userId, query, pattern),
      this.searchArtifacts(userId, query, pattern),
      this.searchPrompts(userId, query, pattern),
      this.searchWorkflows(userId, query, pattern),
      this.searchCustomAssistants(userId, query, pattern),
      this.searchFiles(userId, query, pattern),
      this.searchGeneratedImages(userId, query, pattern),
      this.searchModelComparisons(userId, query, pattern),
    ])

    return sortResults([
      ...projects,
      ...conversations,
      ...messages,
      ...artifacts,
      ...prompts,
      ...workflows,
      ...customAssistants,
      ...files,
      ...generatedImages,
      ...modelComparisons,
    ])
  }

  private async searchProjects(
    userId: string,
    query: string,
    pattern: string
  ): Promise<SearchResult[]> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenProjects)
      .where(
        and(
          eq(zenProjects.userId, userId),
          or(
            ilike(zenProjects.name, pattern),
            ilike(zenProjects.description, pattern),
            ilike(zenProjects.color, pattern)
          )
        )
      )
      .orderBy(desc(zenProjects.updatedAt))
      .limit(PER_ENTITY_LIMIT)

    return rows.map((row) => ({
      id: row.id,
      entityType: 'project',
      title: row.name,
      snippet: buildSnippet(query, row.description, row.name, row.color),
      url: '/',
      target: { type: 'open_project', projectId: row.id },
      projectId: row.id,
      conversationId: null,
      createdAt: toIsoString(row.createdAt),
      updatedAt: toIsoString(row.updatedAt),
      metadata: {
        color: row.color,
        default: row.isDefault,
      },
    }))
  }

  private async searchConversations(
    userId: string,
    query: string,
    pattern: string,
    projectId?: string | null
  ): Promise<SearchResult[]> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenConversations)
      .where(
        projectId
          ? and(
              eq(zenConversations.userId, userId),
              eq(zenConversations.projectId, projectId),
              or(
                ilike(zenConversations.title, pattern),
                ilike(zenConversations.preview, pattern),
                ilike(zenConversations.memorySummary, pattern)
              )
            )
          : and(
              eq(zenConversations.userId, userId),
              or(
                ilike(zenConversations.title, pattern),
                ilike(zenConversations.preview, pattern),
                ilike(zenConversations.memorySummary, pattern)
              )
            )
      )
      .orderBy(desc(zenConversations.updatedAt))
      .limit(PER_ENTITY_LIMIT)

    return rows.map((row) => ({
      id: row.id,
      entityType: 'conversation',
      title: row.title,
      snippet: buildSnippet(query, row.preview, row.memorySummary, row.title),
      url: '/',
      target: { type: 'open_conversation', conversationId: row.id },
      projectId: row.projectId,
      conversationId: row.id,
      createdAt: toIsoString(row.createdAt),
      updatedAt: toIsoString(row.updatedAt),
      metadata: {
        assistant: row.assistantFamily,
        mode: row.mode,
        messages: row.messageCount,
        pinned: row.isPinned,
      },
    }))
  }

  private async searchMessages(
    userId: string,
    query: string,
    pattern: string,
    projectId?: string | null
  ): Promise<SearchResult[]> {
    const rows = await getDatabaseClient()
      .select({
        id: zenMessages.id,
        conversationId: zenMessages.conversationId,
        role: zenMessages.role,
        content: zenMessages.content,
        mode: zenMessages.mode,
        assistantFamily: zenMessages.assistantFamily,
        model: zenMessages.model,
        createdAt: zenMessages.createdAt,
        conversationTitle: zenConversations.title,
        projectId: zenConversations.projectId,
      })
      .from(zenMessages)
      .innerJoin(
        zenConversations,
        eq(zenMessages.conversationId, zenConversations.id)
      )
      .where(
        projectId
          ? and(
              eq(zenConversations.userId, userId),
              eq(zenConversations.projectId, projectId),
              or(
                ilike(zenMessages.content, pattern),
                ilike(zenMessages.model, pattern)
              )
            )
          : and(
              eq(zenConversations.userId, userId),
              or(
                ilike(zenMessages.content, pattern),
                ilike(zenMessages.model, pattern)
              )
            )
      )
      .orderBy(desc(zenMessages.createdAt))
      .limit(PER_ENTITY_LIMIT)

    return rows.map((row) => ({
      id: row.id,
      entityType: 'message',
      title: `Message in ${row.conversationTitle}`,
      snippet: buildSnippet(query, row.content, row.model),
      url: '/',
      target: {
        type: 'open_conversation',
        conversationId: row.conversationId,
        messageId: row.id,
      },
      projectId: row.projectId,
      conversationId: row.conversationId,
      createdAt: toIsoString(row.createdAt),
      updatedAt: null,
      metadata: {
        role: row.role,
        assistant: row.assistantFamily,
        mode: row.mode,
        model: row.model,
      },
    }))
  }

  private async searchPrompts(
    userId: string,
    query: string,
    pattern: string
  ): Promise<SearchResult[]> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenPromptLibrary)
      .where(
        and(
          eq(zenPromptLibrary.userId, userId),
          or(
            ilike(zenPromptLibrary.title, pattern),
            ilike(zenPromptLibrary.content, pattern),
            ilike(zenPromptLibrary.mode, pattern)
          )
        )
      )
      .orderBy(desc(zenPromptLibrary.updatedAt))
      .limit(PER_ENTITY_LIMIT)

    return rows.map((row) => ({
      id: row.id,
      entityType: 'prompt',
      title: row.title,
      snippet: buildSnippet(query, row.content, row.mode, row.title),
      url: '/',
      target: { type: 'open_prompt_library', promptId: row.id },
      projectId: null,
      conversationId: null,
      createdAt: toIsoString(row.createdAt),
      updatedAt: toIsoString(row.updatedAt),
      metadata: {
        mode: row.mode,
      },
    }))
  }

  private async searchArtifacts(
    userId: string,
    query: string,
    pattern: string,
    projectId?: string | null
  ): Promise<SearchResult[]> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenArtifacts)
      .where(
        projectId
          ? and(
              eq(zenArtifacts.userId, userId),
              eq(zenArtifacts.projectId, projectId),
              or(
                ilike(zenArtifacts.title, pattern),
                ilike(zenArtifacts.content, pattern),
                ilike(zenArtifacts.artifactType, pattern),
                ilike(zenArtifacts.sourceType, pattern),
                sql`${zenArtifacts.metadata}::text ILIKE ${pattern}`
              )
            )
          : and(
              eq(zenArtifacts.userId, userId),
              or(
                ilike(zenArtifacts.title, pattern),
                ilike(zenArtifacts.content, pattern),
                ilike(zenArtifacts.artifactType, pattern),
                ilike(zenArtifacts.sourceType, pattern),
                sql`${zenArtifacts.metadata}::text ILIKE ${pattern}`
              )
            )
      )
      .orderBy(desc(zenArtifacts.updatedAt))
      .limit(PER_ENTITY_LIMIT)

    return rows.map((row) => ({
      id: row.id,
      entityType: 'artifact',
      title: row.title,
      snippet: buildSnippet(
        query,
        row.content,
        row.artifactType,
        row.sourceType,
        row.title
      ),
      url: '/',
      target: {
        type: 'open_artifact',
        artifactId: row.id,
        projectId: row.projectId,
      },
      projectId: row.projectId,
      conversationId: row.conversationId,
      createdAt: toIsoString(row.createdAt),
      updatedAt: toIsoString(row.updatedAt),
      metadata: {
        artifactType: row.artifactType,
        sourceType: row.sourceType,
      },
    }))
  }

  private async searchWorkflows(
    userId: string,
    query: string,
    pattern: string,
    projectId?: string | null
  ): Promise<SearchResult[]> {
    const db = getDatabaseClient()
    const workflowRows = await db
      .select({ id: zenPromptWorkflows.id })
      .from(zenPromptWorkflows)
      .where(
        projectId
          ? and(
              eq(zenPromptWorkflows.userId, userId),
              eq(zenPromptWorkflows.projectId, projectId),
              or(
                ilike(zenPromptWorkflows.title, pattern),
                ilike(zenPromptWorkflows.description, pattern)
              )
            )
          : and(
              eq(zenPromptWorkflows.userId, userId),
              or(
                ilike(zenPromptWorkflows.title, pattern),
                ilike(zenPromptWorkflows.description, pattern)
              )
            )
      )
      .orderBy(desc(zenPromptWorkflows.updatedAt))
      .limit(PER_ENTITY_LIMIT)

    const stepRows = await db
      .select({ id: zenPromptWorkflows.id })
      .from(zenPromptWorkflowSteps)
      .innerJoin(
        zenPromptWorkflows,
        eq(zenPromptWorkflowSteps.workflowId, zenPromptWorkflows.id)
      )
      .where(
        projectId
          ? and(
              eq(zenPromptWorkflows.userId, userId),
              eq(zenPromptWorkflows.projectId, projectId),
              or(
                ilike(zenPromptWorkflowSteps.title, pattern),
                ilike(zenPromptWorkflowSteps.template, pattern),
                ilike(zenPromptWorkflowSteps.assistantFamily, pattern),
                ilike(zenPromptWorkflowSteps.mode, pattern)
              )
            )
          : and(
              eq(zenPromptWorkflows.userId, userId),
              or(
                ilike(zenPromptWorkflowSteps.title, pattern),
                ilike(zenPromptWorkflowSteps.template, pattern),
                ilike(zenPromptWorkflowSteps.assistantFamily, pattern),
                ilike(zenPromptWorkflowSteps.mode, pattern)
              )
            )
      )
      .limit(PER_ENTITY_LIMIT)

    const workflowIds = Array.from(
      new Set([...workflowRows, ...stepRows].map((row) => row.id))
    ).slice(0, PER_ENTITY_LIMIT)

    if (workflowIds.length === 0) return []

    const rows = await db
      .select()
      .from(zenPromptWorkflows)
      .where(
        projectId
          ? and(
              eq(zenPromptWorkflows.userId, userId),
              eq(zenPromptWorkflows.projectId, projectId),
              inArray(zenPromptWorkflows.id, workflowIds)
            )
          : and(
              eq(zenPromptWorkflows.userId, userId),
              inArray(zenPromptWorkflows.id, workflowIds)
            )
      )
      .orderBy(desc(zenPromptWorkflows.updatedAt))

    const stepCounts = await db
      .select({
        workflowId: zenPromptWorkflowSteps.workflowId,
        count: sql<number>`count(*)`,
      })
      .from(zenPromptWorkflowSteps)
      .where(inArray(zenPromptWorkflowSteps.workflowId, workflowIds))
      .groupBy(zenPromptWorkflowSteps.workflowId)

    const stepCountByWorkflow = new Map(
      stepCounts.map((row) => [row.workflowId, Number(row.count)])
    )

    return rows.map((row) => ({
      id: row.id,
      entityType: 'prompt_workflow',
      title: row.title,
      snippet: buildSnippet(query, row.description, row.title),
      url: '/',
      target: { type: 'open_prompt_library', workflowId: row.id },
      projectId: row.projectId,
      conversationId: null,
      createdAt: toIsoString(row.createdAt),
      updatedAt: toIsoString(row.updatedAt),
      metadata: {
        steps: stepCountByWorkflow.get(row.id) ?? 0,
      },
    }))
  }

  private async searchCustomAssistants(
    userId: string,
    query: string,
    pattern: string
  ): Promise<SearchResult[]> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenCustomAssistants)
      .where(
        and(
          eq(zenCustomAssistants.userId, userId),
          or(
            ilike(zenCustomAssistants.name, pattern),
            ilike(zenCustomAssistants.description, pattern),
            ilike(zenCustomAssistants.systemInstructions, pattern),
            ilike(zenCustomAssistants.baseMode, pattern)
          )
        )
      )
      .orderBy(desc(zenCustomAssistants.updatedAt))
      .limit(PER_ENTITY_LIMIT)

    return rows.map((row) => ({
      id: row.id,
      entityType: 'custom_assistant',
      title: row.name,
      snippet: buildSnippet(
        query,
        row.description,
        row.systemInstructions,
        row.baseMode,
        row.name
      ),
      url: '/',
      target: row.isEnabled
        ? { type: 'switch_custom_assistant', assistantId: row.id }
        : { type: 'open_custom_assistants', assistantId: row.id },
      projectId: null,
      conversationId: null,
      createdAt: toIsoString(row.createdAt),
      updatedAt: toIsoString(row.updatedAt),
      metadata: {
        mode: row.baseMode,
        enabled: row.isEnabled,
      },
    }))
  }

  private async searchFiles(
    userId: string,
    query: string,
    pattern: string,
    projectId?: string | null
  ): Promise<SearchResult[]> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenFiles)
      .where(
        projectId
          ? and(
              eq(zenFiles.userId, userId),
              eq(zenFiles.projectId, projectId),
              or(
                ilike(zenFiles.fileName, pattern),
                ilike(zenFiles.mimeType, pattern),
                sql`${zenFiles.metadata}::text ILIKE ${pattern}`
              )
            )
          : and(
              eq(zenFiles.userId, userId),
              or(
                ilike(zenFiles.fileName, pattern),
                ilike(zenFiles.mimeType, pattern),
                sql`${zenFiles.metadata}::text ILIKE ${pattern}`
              )
            )
      )
      .orderBy(desc(zenFiles.updatedAt))
      .limit(PER_ENTITY_LIMIT)

    return rows.map((row) => ({
      id: row.id,
      entityType: 'file',
      title: row.fileName,
      snippet: buildSnippet(query, row.fileName, row.mimeType, row.visibility),
      url: '/',
      target: row.conversationId
        ? {
            type: 'open_conversation',
            conversationId: row.conversationId,
            messageId: row.messageId ?? undefined,
          }
        : row.projectId
          ? { type: 'open_project', projectId: row.projectId }
          : { type: 'open_url', url: '/' },
      projectId: row.projectId,
      conversationId: row.conversationId,
      createdAt: toIsoString(row.createdAt),
      updatedAt: toIsoString(row.updatedAt),
      metadata: {
        fileType: row.mimeType,
        size: row.byteSize,
        visibility: row.visibility,
        provider: row.provider,
      },
    }))
  }

  private async searchGeneratedImages(
    userId: string,
    query: string,
    pattern: string,
    projectId?: string | null
  ): Promise<SearchResult[]> {
    const rows = await getDatabaseClient()
      .select({
        id: zenGeneratedImages.id,
        conversationId: zenGeneratedImages.conversationId,
        messageId: zenGeneratedImages.messageId,
        prompt: zenGeneratedImages.prompt,
        negativePrompt: zenGeneratedImages.negativePrompt,
        model: zenGeneratedImages.model,
        provider: zenGeneratedImages.provider,
        status: zenGeneratedImages.status,
        width: zenGeneratedImages.width,
        height: zenGeneratedImages.height,
        metadata: zenGeneratedImages.metadata,
        createdAt: zenGeneratedImages.createdAt,
        updatedAt: zenGeneratedImages.updatedAt,
        projectId: zenConversations.projectId,
      })
      .from(zenGeneratedImages)
      .leftJoin(
        zenConversations,
        and(
          eq(zenGeneratedImages.conversationId, zenConversations.id),
          eq(zenConversations.userId, userId)
        )
      )
      .where(
        projectId
          ? and(
              eq(zenGeneratedImages.userId, userId),
              eq(zenConversations.userId, userId),
              eq(zenConversations.projectId, projectId),
              or(
                ilike(zenGeneratedImages.prompt, pattern),
                ilike(zenGeneratedImages.negativePrompt, pattern),
                ilike(zenGeneratedImages.model, pattern),
                sql`${zenGeneratedImages.metadata}::text ILIKE ${pattern}`
              )
            )
          : and(
              eq(zenGeneratedImages.userId, userId),
              or(
                ilike(zenGeneratedImages.prompt, pattern),
                ilike(zenGeneratedImages.negativePrompt, pattern),
                ilike(zenGeneratedImages.model, pattern),
                sql`${zenGeneratedImages.metadata}::text ILIKE ${pattern}`
              )
            )
      )
      .orderBy(desc(zenGeneratedImages.updatedAt))
      .limit(PER_ENTITY_LIMIT)

    return rows.map((row) => ({
      id: row.id,
      entityType: 'generated_image',
      title: 'Prism image',
      snippet: buildSnippet(query, row.prompt, row.negativePrompt, row.model),
      url: row.conversationId ? '/' : '/dashboard',
      target: row.conversationId
        ? {
            type: 'open_conversation',
            conversationId: row.conversationId,
            messageId: row.messageId ?? undefined,
          }
        : { type: 'open_prism_history', imageId: row.id },
      projectId: row.projectId,
      conversationId: row.conversationId,
      createdAt: toIsoString(row.createdAt),
      updatedAt: toIsoString(row.updatedAt),
      metadata: {
        assistant: 'prism',
        model: row.model,
        provider: row.provider,
        status: row.status,
        width: row.width,
        height: row.height,
      },
    }))
  }

  private async searchModelComparisons(
    userId: string,
    query: string,
    pattern: string,
    projectId?: string | null
  ): Promise<SearchResult[]> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenModelComparisons)
      .where(
        projectId
          ? and(
              eq(zenModelComparisons.userId, userId),
              eq(zenModelComparisons.projectId, projectId),
              or(
                ilike(zenModelComparisons.prompt, pattern),
                ilike(zenModelComparisons.status, pattern)
              )
            )
          : and(
              eq(zenModelComparisons.userId, userId),
              or(
                ilike(zenModelComparisons.prompt, pattern),
                ilike(zenModelComparisons.status, pattern)
              )
            )
      )
      .orderBy(desc(zenModelComparisons.updatedAt))
      .limit(PER_ENTITY_LIMIT)

    return rows.map((row) => ({
      id: row.id,
      entityType: 'model_comparison',
      title: 'Model comparison',
      snippet: buildSnippet(query, row.prompt, row.status),
      url: '/',
      target: {
        type: 'open_model_comparison',
        comparisonId: row.id,
        conversationId: row.conversationId,
      },
      projectId: row.projectId,
      conversationId: row.conversationId,
      createdAt: toIsoString(row.createdAt),
      updatedAt: toIsoString(row.updatedAt),
      metadata: {
        status: row.status,
      },
    }))
  }
}

export const neonSearchRepository = new NeonSearchRepository()
