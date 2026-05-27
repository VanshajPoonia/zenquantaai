import 'server-only'

import { and, desc, eq } from 'drizzle-orm'
import {
  createSessionSettings,
  DEFAULT_PROJECT_ID,
  DEFAULT_PROJECT_NAME,
} from '@/lib/config'
import { getAssistantFamilyFromMode } from '@/lib/config/assistants'
import {
  AIMode,
  AssistantFamily,
  MemoryVaultConversationSummary,
  MemoryVaultResponse,
  Project,
  SessionSettings,
} from '@/types'
import { getDatabaseClient } from '../client'
import { zenConversations, zenProjects } from '../schema'
import {
  toIsoString,
  toJsonObject,
  toNullableIsoString,
} from './helpers'

type ProjectRow = typeof zenProjects.$inferSelect
type ConversationRow = typeof zenConversations.$inferSelect

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

function createFallbackProject(projectId: string, generatedAt: string): Project {
  return {
    id: projectId,
    name: projectId === DEFAULT_PROJECT_ID ? DEFAULT_PROJECT_NAME : 'Unknown project',
    description:
      projectId === DEFAULT_PROJECT_ID
        ? 'Default home for new chats'
        : 'Project metadata is unavailable.',
    color: 'general',
    createdAt: generatedAt,
    updatedAt: generatedAt,
    isDefault: projectId === DEFAULT_PROJECT_ID,
  }
}

function memoryEnabled(row: Pick<ConversationRow, 'mode' | 'sessionSettings'>): boolean {
  return createSessionSettings(row.mode as AIMode, {
    ...toJsonObject<Partial<SessionSettings>>(row.sessionSettings, {}),
  }).memory
}

function hasMemorySummary(row: Pick<ConversationRow, 'memorySummary'>): boolean {
  return Boolean(row.memorySummary?.trim())
}

function latestMemoryTimestamp(
  conversations: MemoryVaultConversationSummary[]
): string | null {
  return (
    conversations
      .map((conversation) => conversation.memoryUpdatedAt)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null
  )
}

class NeonMemoryVaultRepository {
  private async getProjectsById(userId: string) {
    const rows = await getDatabaseClient()
      .select()
      .from(zenProjects)
      .where(eq(zenProjects.userId, userId))
      .orderBy(desc(zenProjects.isDefault), desc(zenProjects.updatedAt))

    return new Map(rows.map((row) => [row.id, rowToProject(row)]))
  }

  private conversationToSummary(
    row: ConversationRow,
    project: Project
  ): MemoryVaultConversationSummary {
    const mode = row.mode as AIMode
    const assistantFamily =
      (row.assistantFamily as AssistantFamily | null) ?? getAssistantFamilyFromMode(mode)

    return {
      id: row.id,
      title: row.title,
      projectId: row.projectId ?? DEFAULT_PROJECT_ID,
      projectName: project.name,
      mode,
      assistantFamily,
      preview: row.preview,
      messageCount: row.messageCount,
      memoryEnabled: memoryEnabled(row),
      memorySummary: row.memorySummary ?? null,
      memoryUpdatedAt: toNullableIsoString(row.memoryUpdatedAt),
      createdAt: toIsoString(row.createdAt),
      updatedAt: toIsoString(row.updatedAt),
    }
  }

  async getConversationSummary(
    userId: string,
    conversationId: string
  ): Promise<MemoryVaultConversationSummary | null> {
    const generatedAt = new Date().toISOString()
    const db = getDatabaseClient()
    const [conversationRows, projectsById] = await Promise.all([
      db
        .select()
        .from(zenConversations)
        .where(
          and(
            eq(zenConversations.userId, userId),
            eq(zenConversations.id, conversationId)
          )
        )
        .limit(1),
      this.getProjectsById(userId),
    ])
    const row = conversationRows[0]
    if (!row) return null

    const projectId = row.projectId ?? DEFAULT_PROJECT_ID
    const project =
      projectsById.get(projectId) ?? createFallbackProject(projectId, generatedAt)

    return this.conversationToSummary(row, project)
  }

  async getVault(
    userId: string,
    globalMemoryEnabled: boolean
  ): Promise<MemoryVaultResponse> {
    const generatedAt = new Date().toISOString()
    const db = getDatabaseClient()
    const [projectRows, conversationRows] = await Promise.all([
      db
        .select()
        .from(zenProjects)
        .where(eq(zenProjects.userId, userId))
        .orderBy(desc(zenProjects.isDefault), desc(zenProjects.updatedAt)),
      db
        .select()
        .from(zenConversations)
        .where(eq(zenConversations.userId, userId))
        .orderBy(desc(zenConversations.updatedAt)),
    ])

    const projectsById = new Map(projectRows.map((row) => [row.id, rowToProject(row)]))

    for (const row of conversationRows) {
      const projectId = row.projectId ?? DEFAULT_PROJECT_ID
      if (!projectsById.has(projectId)) {
        projectsById.set(projectId, createFallbackProject(projectId, generatedAt))
      }
    }

    const conversations = conversationRows.map((row) => {
      const projectId = row.projectId ?? DEFAULT_PROJECT_ID
      const project =
        projectsById.get(projectId) ?? createFallbackProject(projectId, generatedAt)
      return this.conversationToSummary(row, project)
    })

    const conversationsByProject = new Map<string, MemoryVaultConversationSummary[]>()
    for (const conversation of conversations) {
      conversationsByProject.set(conversation.projectId, [
        ...(conversationsByProject.get(conversation.projectId) ?? []),
        conversation,
      ])
    }

    const projects = [...projectsById.values()].map((project) => {
      const projectConversations = conversationsByProject.get(project.id) ?? []
      const memoryConversations = projectConversations.filter((conversation) =>
        Boolean(conversation.memorySummary?.trim())
      )

      return {
        project,
        conversationCount: projectConversations.length,
        memoryConversationCount: memoryConversations.length,
        memoryEnabledConversationCount: projectConversations.filter(
          (conversation) => conversation.memoryEnabled
        ).length,
        latestMemoryUpdatedAt: latestMemoryTimestamp(projectConversations),
        conversations: projectConversations,
      }
    })

    projects.sort((a, b) => {
      if (a.project.isDefault !== b.project.isDefault) {
        return a.project.isDefault ? -1 : 1
      }

      const aTime = a.latestMemoryUpdatedAt ?? a.project.updatedAt
      const bTime = b.latestMemoryUpdatedAt ?? b.project.updatedAt
      return new Date(bTime).getTime() - new Date(aTime).getTime()
    })

    const recentMemories = conversations
      .filter((conversation) => Boolean(conversation.memorySummary?.trim()))
      .sort((a, b) => {
        const aTime = a.memoryUpdatedAt ?? a.updatedAt
        const bTime = b.memoryUpdatedAt ?? b.updatedAt
        return new Date(bTime).getTime() - new Date(aTime).getTime()
      })
      .slice(0, 12)

    return {
      globalMemoryEnabled,
      totals: {
        projectCount: projects.length,
        conversationCount: conversations.length,
        memoryConversationCount: conversationRows.filter(hasMemorySummary).length,
        memoryEnabledConversationCount: conversationRows.filter(memoryEnabled).length,
        latestMemoryUpdatedAt: latestMemoryTimestamp(conversations),
      },
      projects,
      recentMemories,
      generatedAt,
    }
  }

  async setConversationMemoryEnabled(
    userId: string,
    conversationId: string,
    memory: boolean
  ): Promise<MemoryVaultConversationSummary | null> {
    const currentRows = await getDatabaseClient()
      .select({
        mode: zenConversations.mode,
        sessionSettings: zenConversations.sessionSettings,
      })
      .from(zenConversations)
      .where(
        and(
          eq(zenConversations.userId, userId),
          eq(zenConversations.id, conversationId)
        )
      )
      .limit(1)

    const current = currentRows[0]
    if (!current) return null

    const nextSessionSettings = createSessionSettings(current.mode as AIMode, {
      ...toJsonObject<Partial<SessionSettings>>(current.sessionSettings, {}),
      memory,
    })

    await getDatabaseClient()
      .update(zenConversations)
      .set({
        sessionSettings: nextSessionSettings,
      })
      .where(
        and(
          eq(zenConversations.userId, userId),
          eq(zenConversations.id, conversationId)
        )
      )

    return await this.getConversationSummary(userId, conversationId)
  }

  async clearConversationMemory(
    userId: string,
    conversationId: string
  ): Promise<MemoryVaultConversationSummary | null> {
    const current = await this.getConversationSummary(userId, conversationId)
    if (!current) return null

    await getDatabaseClient()
      .update(zenConversations)
      .set({
        memorySummary: null,
        memoryUpdatedAt: null,
      })
      .where(
        and(
          eq(zenConversations.userId, userId),
          eq(zenConversations.id, conversationId)
        )
      )

    return await this.getConversationSummary(userId, conversationId)
  }
}

export const neonMemoryVaultRepository = new NeonMemoryVaultRepository()
