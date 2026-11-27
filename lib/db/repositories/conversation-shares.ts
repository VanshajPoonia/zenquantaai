import 'server-only'

import { randomBytes } from 'crypto'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import {
  ConversationShareInfo,
  ConversationShareSnapshot,
  PublicConversationShare,
} from '@/types'
import { getDatabaseClient } from '../client'
import { zenConversationShares } from '../schema'
import { toIsoString } from './helpers'

type ShareRow = typeof zenConversationShares.$inferSelect

// 32 random bytes, 43 base64url characters.
export function createConversationShareToken(): string {
  return randomBytes(32).toString('base64url')
}

function rowToShareInfo(row: ShareRow): ConversationShareInfo {
  return {
    id: row.id,
    conversationId: row.conversationId,
    token: row.token,
    title: row.title,
    messageCount: row.messageCount,
    redactionCount: row.redactionCount,
    createdAt: toIsoString(row.createdAt),
  }
}

class NeonConversationSharesRepository {
  async create(
    userId: string,
    conversationId: string,
    input: {
      title: string
      snapshot: ConversationShareSnapshot
      messageCount: number
      redactionCount: number
    }
  ): Promise<ConversationShareInfo> {
    const rows = await getDatabaseClient()
      .insert(zenConversationShares)
      .values({
        token: createConversationShareToken(),
        userId,
        conversationId,
        title: input.title,
        snapshot: input.snapshot,
        messageCount: input.messageCount,
        redactionCount: input.redactionCount,
      })
      .returning()

    const row = rows[0]
    if (!row) throw new Error('Unable to create the share link.')
    return rowToShareInfo(row)
  }

  async listActive(userId: string, conversationId: string): Promise<ConversationShareInfo[]> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenConversationShares)
      .where(
        and(
          eq(zenConversationShares.userId, userId),
          eq(zenConversationShares.conversationId, conversationId),
          isNull(zenConversationShares.revokedAt)
        )
      )
      .orderBy(desc(zenConversationShares.createdAt))

    return rows.map(rowToShareInfo)
  }

  async countActive(userId: string, conversationId: string): Promise<number> {
    const rows = await getDatabaseClient()
      .select({ value: sql<number>`count(*)::int` })
      .from(zenConversationShares)
      .where(
        and(
          eq(zenConversationShares.userId, userId),
          eq(zenConversationShares.conversationId, conversationId),
          isNull(zenConversationShares.revokedAt)
        )
      )

    return Number(rows[0]?.value ?? 0)
  }

  async revoke(userId: string, conversationId: string, shareId: string): Promise<boolean> {
    const rows = await getDatabaseClient()
      .update(zenConversationShares)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(zenConversationShares.id, shareId),
          eq(zenConversationShares.userId, userId),
          eq(zenConversationShares.conversationId, conversationId),
          isNull(zenConversationShares.revokedAt)
        )
      )
      .returning({ id: zenConversationShares.id })

    return rows.length > 0
  }

  /** Public read. Revoked links read as missing. */
  async getPublicByToken(token: string): Promise<PublicConversationShare | null> {
    const rows = await getDatabaseClient()
      .select({
        snapshot: zenConversationShares.snapshot,
        createdAt: zenConversationShares.createdAt,
        revokedAt: zenConversationShares.revokedAt,
      })
      .from(zenConversationShares)
      .where(eq(zenConversationShares.token, token))
      .limit(1)

    const row = rows[0]
    if (!row || row.revokedAt) return null

    return {
      createdAt: toIsoString(row.createdAt),
      snapshot: row.snapshot as ConversationShareSnapshot,
    }
  }
}

export const neonConversationSharesRepository = new NeonConversationSharesRepository()
