import 'server-only'

import { and, asc, eq, gt, lt, sql } from 'drizzle-orm'
import {
  APPROVAL_TTL_MS,
  effectiveApprovalStatus,
  type CliApprovalStatus,
} from '@/lib/cli/approvals'
import { getDatabaseClient } from '../client'
import { zenCliApprovals, zenConversations } from '../schema'

const KEEP_DECIDED_MS = 24 * 60 * 60_000
const MAX_PENDING_LISTED = 20

export interface CliApprovalRecord {
  id: string
  sessionId: string
  tool: string
  title: string
  detail: string
  status: CliApprovalStatus
  createdAt: Date
  decidedAt: Date | null
  expiresAt: Date
}

/** A write that only applies to a pending row. `status` is the row's state when it did not apply. */
export type CliApprovalWrite =
  | { ok: true }
  | { ok: false; status: CliApprovalStatus | null }

function toRecord(row: typeof zenCliApprovals.$inferSelect): CliApprovalRecord {
  const record = {
    id: row.id,
    sessionId: row.sessionId,
    tool: row.tool,
    title: row.title,
    detail: row.detail,
    status: row.status as CliApprovalStatus,
    createdAt: row.createdAt,
    decidedAt: row.decidedAt,
    expiresAt: row.expiresAt,
  }
  return { ...record, status: effectiveApprovalStatus(record) }
}

class NeonCliApprovalsRepository {
  async create(input: {
    userId: string
    tokenId: string
    sessionId: string
    tool: string
    title: string
    detail: string
  }): Promise<{ id: string; expiresAt: Date }> {
    const db = getDatabaseClient()
    // Old rows hold exact commands, so they are not kept past a day.
    await db
      .delete(zenCliApprovals)
      .where(
        and(
          eq(zenCliApprovals.userId, input.userId),
          lt(zenCliApprovals.createdAt, new Date(Date.now() - KEEP_DECIDED_MS))
        )
      )
    const rows = await db
      .insert(zenCliApprovals)
      .values({ ...input, expiresAt: new Date(Date.now() + APPROVAL_TTL_MS) })
      .returning({ id: zenCliApprovals.id, expiresAt: zenCliApprovals.expiresAt })
    return rows[0]
  }

  /** One approval, only for the token that created it. */
  async getForToken(userId: string, tokenId: string, id: string): Promise<CliApprovalRecord | null> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenCliApprovals)
      .where(
        and(
          eq(zenCliApprovals.id, id),
          eq(zenCliApprovals.userId, userId),
          eq(zenCliApprovals.tokenId, tokenId)
        )
      )
      .limit(1)
    return rows[0] ? toRecord(rows[0]) : null
  }

  /** zq closes its own pending approval when the terminal answered first or it stopped waiting. */
  async closeForToken(
    userId: string,
    tokenId: string,
    id: string,
    status: 'answered_locally' | 'expired'
  ): Promise<CliApprovalWrite> {
    const updated = await getDatabaseClient()
      .update(zenCliApprovals)
      .set({ status, decidedAt: new Date() })
      .where(
        and(
          eq(zenCliApprovals.id, id),
          eq(zenCliApprovals.userId, userId),
          eq(zenCliApprovals.tokenId, tokenId),
          eq(zenCliApprovals.status, 'pending')
        )
      )
      .returning({ id: zenCliApprovals.id })
    if (updated.length) return { ok: true }
    const current = await this.getForToken(userId, tokenId, id)
    return { ok: false, status: current?.status ?? null }
  }

  async listPending(userId: string): Promise<CliApprovalRecord[]> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenCliApprovals)
      .where(
        and(
          eq(zenCliApprovals.userId, userId),
          eq(zenCliApprovals.status, 'pending'),
          gt(zenCliApprovals.expiresAt, new Date())
        )
      )
      .orderBy(asc(zenCliApprovals.createdAt))
      .limit(MAX_PENDING_LISTED)
    return rows.map(toRecord)
  }

  /** Approves once or denies. Applies only while pending and unexpired, so it is decided once. */
  async decide(userId: string, id: string, approve: boolean): Promise<CliApprovalWrite> {
    const db = getDatabaseClient()
    const updated = await db
      .update(zenCliApprovals)
      .set({ status: approve ? 'approved' : 'denied', decidedAt: new Date() })
      .where(
        and(
          eq(zenCliApprovals.id, id),
          eq(zenCliApprovals.userId, userId),
          eq(zenCliApprovals.status, 'pending'),
          gt(zenCliApprovals.expiresAt, new Date())
        )
      )
      .returning({ id: zenCliApprovals.id })
    if (updated.length) return { ok: true }
    const rows = await db
      .select()
      .from(zenCliApprovals)
      .where(and(eq(zenCliApprovals.id, id), eq(zenCliApprovals.userId, userId)))
      .limit(1)
    return { ok: false, status: rows[0] ? toRecord(rows[0]).status : null }
  }

  /** When any of the user's zq sessions last synced. */
  async latestCliActivity(userId: string): Promise<Date | null> {
    const rows = await getDatabaseClient()
      .select({ latest: sql<Date | string | null>`max(${zenConversations.updatedAt})` })
      .from(zenConversations)
      .where(and(eq(zenConversations.userId, userId), eq(zenConversations.surface, 'cli')))
    const latest = rows[0]?.latest
    return latest ? new Date(latest) : null
  }
}

export const neonCliApprovalsRepository = new NeonCliApprovalsRepository()
