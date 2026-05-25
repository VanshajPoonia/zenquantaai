import 'server-only'

import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { SearchResult } from '@/types'
import { getDatabaseClient } from '../client'
import {
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
  async search(userId: string, rawQuery: string): Promise<SearchResult[]> {
    const query = normalizeQuery(rawQuery)
    if (query.length < MIN_QUERY_LENGTH) return []

    const pattern = toPattern(query)

    const [
      projects,
      conversations,
      messages,
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
    pattern: string
  ): Promise<SearchResult[]> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenConversations)
      .where(
        and(
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
