import 'server-only'

import { desc, eq } from 'drizzle-orm'
import {
  AssistantRecommendationAnalyticsSummary,
  AssistantRecommendationEvent,
  RecommendationOutcome,
} from '@/types'
import { getDatabaseClient } from '../client'
import { zenAssistantRecommendationEvents, zenConversations } from '../schema'
import { toIsoString, toJsonArray, toNumber } from './helpers'
import { neonUsersRepository } from './users'

type AssistantRecommendationEventRow =
  typeof zenAssistantRecommendationEvents.$inferSelect

function rowToAssistantRecommendationEvent(
  row: AssistantRecommendationEventRow
): AssistantRecommendationEvent {
  return {
    id: row.id,
    userId: row.userId,
    conversationId: row.conversationId,
    currentAssistant: row.currentAssistant as AssistantRecommendationEvent['currentAssistant'],
    recommendedAssistant:
      row.recommendedAssistant as AssistantRecommendationEvent['recommendedAssistant'],
    confidence: toNumber(row.confidence),
    matchedSignals: toJsonArray<string>(row.matchedSignals),
    reason: row.reason,
    outcome: row.outcome as RecommendationOutcome,
    createdAt: toIsoString(row.createdAt),
  }
}

function buildAnalyticsSummary(
  events: AssistantRecommendationEvent[]
): AssistantRecommendationAnalyticsSummary {
  const counts: Record<RecommendationOutcome, number> = {
    shown: 0,
    accepted: 0,
    continued: 0,
    cancelled: 0,
    autoswitched: 0,
    not_shown: 0,
  }

  const switchCounts = new Map<string, number>()

  for (const event of events) {
    counts[event.outcome] += 1

    const key = `${event.currentAssistant}:${event.recommendedAssistant}`
    switchCounts.set(key, (switchCounts.get(key) ?? 0) + 1)
  }

  return {
    totalEvents: events.length,
    shown: counts.shown,
    accepted: counts.accepted,
    continued: counts.continued,
    cancelled: counts.cancelled,
    autoswitched: counts.autoswitched,
    notShown: counts.not_shown,
    topSuggestedSwitches: [...switchCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([key, count]) => {
        const [currentAssistant, recommendedAssistant] = key.split(':') as [
          AssistantRecommendationEvent['currentAssistant'],
          AssistantRecommendationEvent['recommendedAssistant'],
        ]

        return {
          currentAssistant,
          recommendedAssistant,
          count,
        }
      }),
  }
}

class NeonAssistantRecommendationEventsRepository {
  async list(): Promise<AssistantRecommendationEvent[]> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenAssistantRecommendationEvents)
      .orderBy(desc(zenAssistantRecommendationEvents.createdAt))

    return rows.map(rowToAssistantRecommendationEvent)
  }

  async listByUser(userId: string): Promise<AssistantRecommendationEvent[]> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenAssistantRecommendationEvents)
      .where(eq(zenAssistantRecommendationEvents.userId, userId))
      .orderBy(desc(zenAssistantRecommendationEvents.createdAt))

    return rows.map(rowToAssistantRecommendationEvent)
  }

  async create(
    event: Omit<AssistantRecommendationEvent, 'id' | 'createdAt'>
  ): Promise<AssistantRecommendationEvent> {
    await neonUsersRepository.ensureUserReference(event.userId)
    let conversationId = event.conversationId ?? null

    if (conversationId) {
      const conversation = await getDatabaseClient()
        .select({ id: zenConversations.id })
        .from(zenConversations)
        .where(eq(zenConversations.id, conversationId))
        .limit(1)

      conversationId = conversation[0]?.id ?? null
    }

    const rows = await getDatabaseClient()
      .insert(zenAssistantRecommendationEvents)
      .values({
        userId: event.userId,
        conversationId,
        currentAssistant: event.currentAssistant,
        recommendedAssistant: event.recommendedAssistant,
        confidence: String(event.confidence),
        matchedSignals: event.matchedSignals,
        reason: event.reason,
        outcome: event.outcome,
      })
      .returning()

    return rowToAssistantRecommendationEvent(rows[0])
  }

  async getAnalyticsSummary(): Promise<AssistantRecommendationAnalyticsSummary> {
    const events = await this.list()
    return buildAnalyticsSummary(events)
  }
}

export const neonAssistantRecommendationEventsRepository =
  new NeonAssistantRecommendationEventsRepository()
