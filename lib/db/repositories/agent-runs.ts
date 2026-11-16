import 'server-only'

import { and, eq, sql } from 'drizzle-orm'
import type { ConversationSurface } from '@/types'
import { getDatabaseClient } from '../client'
import { zenAgentRuns } from '../schema'

export type AgentRunStatus = 'running' | 'completed' | 'failed' | 'stopped'

export interface AgentRunRecord {
  id: string
  userId: string
  conversationId: string | null
  surface: ConversationSurface
  stepCount: number
  status: AgentRunStatus
}

function toRecord(row: typeof zenAgentRuns.$inferSelect): AgentRunRecord {
  return {
    id: row.id,
    userId: row.userId,
    conversationId: row.conversationId,
    surface: row.surface as ConversationSurface,
    stepCount: row.stepCount,
    status: row.status as AgentRunStatus,
  }
}

class NeonAgentRunsRepository {
  async create(input: {
    userId: string
    conversationId?: string | null
    surface: ConversationSurface
  }): Promise<AgentRunRecord> {
    const rows = await getDatabaseClient()
      .insert(zenAgentRuns)
      .values({
        userId: input.userId,
        conversationId: input.conversationId ?? null,
        surface: input.surface,
      })
      .returning()
    return toRecord(rows[0])
  }

  /** Finds or creates the run a CLI request belongs to, keyed by the client's run id. */
  async findOrCreateClientRun(input: {
    userId: string
    clientRunId: string
    clientSessionId?: string | null
    conversationId?: string | null
  }): Promise<AgentRunRecord> {
    const rows = await getDatabaseClient()
      .insert(zenAgentRuns)
      .values({
        userId: input.userId,
        surface: 'cli',
        clientRunId: input.clientRunId,
        clientSessionId: input.clientSessionId ?? null,
        conversationId: input.conversationId ?? null,
      })
      .onConflictDoUpdate({
        target: [zenAgentRuns.userId, zenAgentRuns.clientRunId],
        targetWhere: sql`${zenAgentRuns.clientRunId} is not null`,
        set: { updatedAt: new Date() },
      })
      .returning()
    return toRecord(rows[0])
  }

  async recordStep(input: {
    userId: string
    runId: string
    promptTokens: number
    completionTokens: number
  }): Promise<void> {
    await getDatabaseClient()
      .update(zenAgentRuns)
      .set({
        stepCount: sql`${zenAgentRuns.stepCount} + 1`,
        promptTokens: sql`${zenAgentRuns.promptTokens} + ${input.promptTokens}`,
        completionTokens: sql`${zenAgentRuns.completionTokens} + ${input.completionTokens}`,
        updatedAt: new Date(),
      })
      .where(and(eq(zenAgentRuns.id, input.runId), eq(zenAgentRuns.userId, input.userId)))
  }

  async finish(input: { userId: string; runId: string; status: AgentRunStatus }): Promise<void> {
    await getDatabaseClient()
      .update(zenAgentRuns)
      .set({ status: input.status, updatedAt: new Date() })
      .where(and(eq(zenAgentRuns.id, input.runId), eq(zenAgentRuns.userId, input.userId)))
  }
}

export const neonAgentRunsRepository = new NeonAgentRunsRepository()
