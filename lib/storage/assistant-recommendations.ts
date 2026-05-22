import {
  AssistantRecommendationAnalyticsSummary,
  AssistantRecommendationEvent,
  RecommendationOutcome,
} from '@/types'
import { supabaseRequest } from './supabase'

const ASSISTANT_RECOMMENDATION_EVENTS_TABLE = 'zen_assistant_recommendation_events'

type AssistantRecommendationEventRow = {
  id: string
  user_id: string
  conversation_id: string | null
  current_assistant: AssistantRecommendationEvent['currentAssistant']
  recommended_assistant: AssistantRecommendationEvent['recommendedAssistant']
  confidence: number
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
    confidence: row.confidence,
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
    const rows = await supabaseRequest<AssistantRecommendationEventRow[]>(
      ASSISTANT_RECOMMENDATION_EVENTS_TABLE,
      {
        query: {
          select: '*',
          order: 'created_at.desc',
        },
      }
    )

    return rows.map(rowToAssistantRecommendationEvent)
  }

  async listByUser(userId: string): Promise<AssistantRecommendationEvent[]> {
    const rows = await supabaseRequest<AssistantRecommendationEventRow[]>(
      ASSISTANT_RECOMMENDATION_EVENTS_TABLE,
      {
        query: {
          user_id: `eq.${userId}`,
          select: '*',
          order: 'created_at.desc',
        },
      }
    )

    return rows.map(rowToAssistantRecommendationEvent)
  }

  async create(
    event: Omit<AssistantRecommendationEvent, 'id' | 'createdAt'>
  ): Promise<AssistantRecommendationEvent> {
    const rows = await supabaseRequest<AssistantRecommendationEventRow[]>(
      ASSISTANT_RECOMMENDATION_EVENTS_TABLE,
      {
        method: 'POST',
        body: {
          user_id: event.userId,
          conversation_id: event.conversationId ?? null,
          current_assistant: event.currentAssistant,
          recommended_assistant: event.recommendedAssistant,
          confidence: event.confidence,
          matched_signals: event.matchedSignals,
          reason: event.reason,
          outcome: event.outcome,
        },
        prefer: 'return=representation',
      }
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
