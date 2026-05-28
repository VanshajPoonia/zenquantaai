import 'server-only'

import { and, desc, eq, inArray } from 'drizzle-orm'
import {
  DEFAULT_PROJECT_ID,
  DEFAULT_PROJECT_NAME,
} from '@/lib/config'
import {
  MessageSource,
  Project,
  PulseResearchConversationSummary,
  PulseResearchRoomResponse,
  PulseResearchSavedSource,
  PulseResearchSearchHistoryItem,
  PulseResearchSourceItem,
} from '@/types'
import { getDatabaseClient } from '../client'
import {
  zenArtifacts,
  zenConversations,
  zenMessages,
  zenProjects,
} from '../schema'
import {
  toIsoString,
  toJsonArray,
  toJsonObject,
} from './helpers'

type ProjectRow = typeof zenProjects.$inferSelect
type ArtifactRow = typeof zenArtifacts.$inferSelect

const MAX_RECENT_CONVERSATIONS = 16
const MAX_RECENT_SOURCES = 80
const MAX_RECENT_SEARCHES = 24
const MAX_SAVED_SOURCES = 40
const MAX_MESSAGE_ROWS = 700

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
    color: 'live',
    createdAt: generatedAt,
    updatedAt: generatedAt,
    isDefault: projectId === DEFAULT_PROJECT_ID,
  }
}

function normalizeSnippet(input: string | null | undefined, maxLength = 260) {
  const text = (input ?? '').replace(/\s+/g, ' ').trim()
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1).trimEnd()}...`
}

function isWebSource(source: MessageSource): boolean {
  return (
    source.kind !== 'file' &&
    typeof source.url === 'string' &&
    /^https?:\/\//i.test(source.url)
  )
}

function matchesQuery(...values: Array<string | null | undefined>) {
  return (query: string) => {
    if (!query) return true
    const normalized = query.toLowerCase()
    return values.some((value) =>
      (value ?? '').toLowerCase().includes(normalized)
    )
  }
}

function artifactToSavedSource(row: ArtifactRow): PulseResearchSavedSource | null {
  const metadata = toJsonObject<Record<string, unknown>>(row.metadata, {})
  if (metadata.sourceKind !== 'pulse_source') return null

  const url = typeof metadata.url === 'string' ? metadata.url : null
  const domain = typeof metadata.domain === 'string' ? metadata.domain : null
  const snippet =
    typeof metadata.snippet === 'string'
      ? metadata.snippet
      : normalizeSnippet(row.content, 420)

  return {
    artifactId: row.id,
    title: row.title,
    url,
    domain,
    snippet,
    projectId: row.projectId,
    conversationId: row.conversationId,
    sourceMessageId: row.sourceMessageId,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  }
}

class NeonPulseResearchRepository {
  async getRoom(
    userId: string,
    options: {
      q?: string
      projectId?: string | null
      webSearchAvailable: boolean
    }
  ): Promise<PulseResearchRoomResponse> {
    const generatedAt = new Date().toISOString()
    const query = options.q?.trim().toLowerCase() ?? ''
    const projectId = options.projectId ?? null
    const db = getDatabaseClient()

    const [projectRows, conversationRows, artifactRows] = await Promise.all([
      db
        .select()
        .from(zenProjects)
        .where(eq(zenProjects.userId, userId))
        .orderBy(desc(zenProjects.isDefault), desc(zenProjects.updatedAt)),
      db
        .select()
        .from(zenConversations)
        .where(
          projectId
            ? and(
                eq(zenConversations.userId, userId),
                eq(zenConversations.projectId, projectId)
              )
            : eq(zenConversations.userId, userId)
        )
        .orderBy(desc(zenConversations.updatedAt)),
      db
        .select()
        .from(zenArtifacts)
        .where(
          projectId
            ? and(
                eq(zenArtifacts.userId, userId),
                eq(zenArtifacts.sourceType, 'pulse_report'),
                eq(zenArtifacts.artifactType, 'research_report'),
                eq(zenArtifacts.projectId, projectId)
              )
            : and(
                eq(zenArtifacts.userId, userId),
                eq(zenArtifacts.sourceType, 'pulse_report'),
                eq(zenArtifacts.artifactType, 'research_report')
              )
        )
        .orderBy(desc(zenArtifacts.updatedAt))
        .limit(MAX_SAVED_SOURCES),
    ])

    const projectsById = new Map(projectRows.map((row) => [row.id, rowToProject(row)]))
    const scopedProject = projectId ? projectsById.get(projectId) ?? null : null
    const conversationsById = new Map(conversationRows.map((row) => [row.id, row]))
    const conversationIds = conversationRows.map((row) => row.id)
    const messageRows =
      conversationIds.length > 0
        ? await db
            .select()
            .from(zenMessages)
            .where(inArray(zenMessages.conversationId, conversationIds))
            .orderBy(desc(zenMessages.createdAt))
            .limit(MAX_MESSAGE_ROWS)
        : []
    const userMessagesById = new Map(
      messageRows
        .filter((row) => row.role === 'user')
        .map((row) => [row.id, row])
    )
    const sourceCountByConversation = new Map<string, number>()
    const latestSourceAtByConversation = new Map<string, string>()

    const recentSources = messageRows
      .filter((row) => row.role === 'assistant')
      .flatMap((row): PulseResearchSourceItem[] => {
        const conversation = conversationsById.get(row.conversationId)
        if (!conversation) return []

        const project =
          projectsById.get(conversation.projectId ?? DEFAULT_PROJECT_ID) ??
          createFallbackProject(conversation.projectId ?? DEFAULT_PROJECT_ID, generatedAt)
        const parent = row.parentUserMessageId
          ? userMessagesById.get(row.parentUserMessageId) ?? null
          : null
        const sources = toJsonArray<MessageSource>(row.sources).filter(isWebSource)

        if (sources.length > 0) {
          sourceCountByConversation.set(
            conversation.id,
            (sourceCountByConversation.get(conversation.id) ?? 0) + sources.length
          )
          const createdAt = toIsoString(row.createdAt)
          const latest = latestSourceAtByConversation.get(conversation.id)
          if (!latest || new Date(createdAt).getTime() > new Date(latest).getTime()) {
            latestSourceAtByConversation.set(conversation.id, createdAt)
          }
        }

        return sources.map((source, index) => ({
          id: `${row.id}:${source.id}:${index}`,
          source,
          conversationId: conversation.id,
          conversationTitle: conversation.title,
          projectId: project.id,
          projectName: project.name,
          messageId: row.id,
          parentUserMessageId: row.parentUserMessageId,
          prompt: parent?.content ?? null,
          responsePreview: normalizeSnippet(row.content),
          createdAt: toIsoString(row.createdAt),
        }))
      })
      .filter((item) =>
        matchesQuery(
          item.source.title,
          item.source.domain,
          item.source.url,
          item.source.snippet,
          item.conversationTitle,
          item.prompt
        )(query)
      )
      .slice(0, MAX_RECENT_SOURCES)

    const conversations = conversationRows
      .filter((row) => {
        const hasSources = (sourceCountByConversation.get(row.id) ?? 0) > 0
        return row.mode === 'live' || row.assistantFamily === 'pulse' || hasSources
      })
      .map((row): PulseResearchConversationSummary => {
        const project =
          projectsById.get(row.projectId ?? DEFAULT_PROJECT_ID) ??
          createFallbackProject(row.projectId ?? DEFAULT_PROJECT_ID, generatedAt)

        return {
          id: row.id,
          title: row.title,
          projectId: project.id,
          projectName: project.name,
          preview: row.preview,
          messageCount: row.messageCount,
          sourceCount: sourceCountByConversation.get(row.id) ?? 0,
          latestSourceAt: latestSourceAtByConversation.get(row.id) ?? null,
          createdAt: toIsoString(row.createdAt),
          updatedAt: toIsoString(row.updatedAt),
        }
      })
      .filter((item) =>
        matchesQuery(item.title, item.preview, item.projectName)(query)
      )
      .slice(0, MAX_RECENT_CONVERSATIONS)

    const recentSearches = recentSources
      .filter((item) => Boolean(item.prompt?.trim()))
      .reduce<PulseResearchSearchHistoryItem[]>((items, source) => {
        if (!source.prompt) return items
        const key = `${source.conversationId}:${source.parentUserMessageId ?? source.prompt}`
        if (items.some((item) => item.id === key)) return items

        items.push({
          id: key,
          prompt: source.prompt,
          conversationId: source.conversationId,
          conversationTitle: source.conversationTitle,
          projectId: source.projectId,
          projectName: source.projectName,
          sourceCount: recentSources.filter(
            (item) =>
              item.conversationId === source.conversationId &&
              item.parentUserMessageId === source.parentUserMessageId
          ).length,
          createdAt: source.createdAt,
        })
        return items
      }, [])
      .slice(0, MAX_RECENT_SEARCHES)

    const savedSources = artifactRows
      .map(artifactToSavedSource)
      .filter((item): item is PulseResearchSavedSource => Boolean(item))
      .filter((item) =>
        matchesQuery(item.title, item.domain, item.url, item.snippet)(query)
      )

    return {
      webSearchAvailable: options.webSearchAvailable,
      project: scopedProject,
      conversations,
      recentSources,
      savedSources,
      recentSearches,
      generatedAt,
    }
  }
}

export const neonPulseResearchRepository = new NeonPulseResearchRepository()
