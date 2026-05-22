import {
  AssistantRecommendationAnalyticsSummary,
  AssistantRecommendationEvent,
  RecommendationOutcome,
} from '@/types'
import { neonQuery, toNumber } from './neon'

type AssistantRecommendationEventRow = {
  id: string
  user_id: string
  conversation_id: string | null
  current_assistant: AssistantRecommendationEvent['currentAssistant']
  recommended_assistant: AssistantRecommendationEvent['recommendedAssistant']
  confidence: number | string
  matched_signals: string[] | null
  reason: string
  outcome: RecommendationOutcome
  created_at: string
}

function rowToAssistantRecommendationEvent(
  row: AssistantRecommendationEventRow
): AssistantRecommendationEvent {
  return {
    id: row.id,
    userId: row.user_id,
    conversationId: row.conversation_id,
    currentAssistant: row.current_assistant,
    recommendedAssistant: row.recommended_assistant,
    confidence: toNumber(row.confidence),
    matchedSignals: row.matched_signals ?? [],
    reason: row.reason,
    outcome: row.outcome,
    createdAt: row.created_at,
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

class AssistantRecommendationEventsStore {
  async list(): Promise<AssistantRecommendationEvent[]> {
    const rows = await neonQuery<AssistantRecommendationEventRow>(
      `
        select *
        from public.zen_assistant_recommendation_events
        order by created_at desc
      `
    )

    return rows.map(rowToAssistantRecommendationEvent)
  }

  async listByUser(userId: string): Promise<AssistantRecommendationEvent[]> {
    const rows = await neonQuery<AssistantRecommendationEventRow>(
      `
        select *
        from public.zen_assistant_recommendation_events
        where user_id = $1
        order by created_at desc
      `,
      [userId]
    )

    return rows.map(rowToAssistantRecommendationEvent)
  }

  async create(
    event: Omit<AssistantRecommendationEvent, 'id' | 'createdAt'>
  ): Promise<AssistantRecommendationEvent> {
    const rows = await neonQuery<AssistantRecommendationEventRow>(
      `
        insert into public.zen_assistant_recommendation_events (
          user_id,
          conversation_id,
          current_assistant,
          recommended_assistant,
          confidence,
          matched_signals,
          reason,
          outcome
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8)
        returning *
      `,
      [
        event.userId,
        event.conversationId ?? null,
        event.currentAssistant,
        event.recommendedAssistant,
        event.confidence,
        event.matchedSignals,
        event.reason,
        event.outcome,
      ]
    )

    return rowToAssistantRecommendationEvent(rows[0])
  }

  async getAnalyticsSummary(): Promise<AssistantRecommendationAnalyticsSummary> {
    const events = await this.list()
    return buildAnalyticsSummary(events)
  }
}

export const assistantRecommendationEventsStore =
  new AssistantRecommendationEventsStore()
