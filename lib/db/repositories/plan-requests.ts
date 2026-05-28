import 'server-only'

import { and, desc, eq } from 'drizzle-orm'
import { PlanChangeRequest, PlanRequestStatus, SubscriptionTier } from '@/types'
import { getDatabaseClient } from '../client'
import { zenAdminAuditLogs, zenPlanChangeRequests } from '../schema'
import { toIsoString, toJsonObject, toNullableIsoString } from './helpers'
import { neonUsersRepository } from './users'

type PlanRequestRow = typeof zenPlanChangeRequests.$inferSelect
type AuditLogRow = typeof zenAdminAuditLogs.$inferSelect

function rowToPlanRequest(row: PlanRequestRow): PlanChangeRequest {
  return {
    id: row.id,
    userId: row.userId,
    currentTier: row.currentTier as SubscriptionTier,
    requestedTier: row.requestedTier as Exclude<SubscriptionTier, 'free'>,
    note: row.note,
    contact: row.contact,
    adminNote: row.adminNote,
    status: row.status as PlanRequestStatus,
    approvedAt: toNullableIsoString(row.approvedAt),
    rejectedAt: toNullableIsoString(row.rejectedAt),
    activatedAt: toNullableIsoString(row.activatedAt),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  }
}

function rowToAuditLog(row: AuditLogRow) {
  return {
    id: row.id,
    adminUserId: row.adminUserId,
    targetUserId: row.targetUserId,
    action: row.action,
    details: toJsonObject<Record<string, unknown>>(row.details, {}),
    createdAt: toIsoString(row.createdAt),
  }
}

class NeonPlanRequestsRepository {
  async list(): Promise<PlanChangeRequest[]> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenPlanChangeRequests)
      .orderBy(desc(zenPlanChangeRequests.createdAt))

    return rows.map(rowToPlanRequest)
  }

  async listByUser(userId: string): Promise<PlanChangeRequest[]> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenPlanChangeRequests)
      .where(eq(zenPlanChangeRequests.userId, userId))
      .orderBy(desc(zenPlanChangeRequests.createdAt))

    return rows.map(rowToPlanRequest)
  }

  async getLatestPendingForUser(userId: string): Promise<PlanChangeRequest | null> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenPlanChangeRequests)
      .where(
        and(
          eq(zenPlanChangeRequests.userId, userId),
          eq(zenPlanChangeRequests.status, 'pending')
        )
      )
      .orderBy(desc(zenPlanChangeRequests.createdAt))
      .limit(1)

    return rows[0] ? rowToPlanRequest(rows[0]) : null
  }

  async getLatestForUser(userId: string): Promise<PlanChangeRequest | null> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenPlanChangeRequests)
      .where(eq(zenPlanChangeRequests.userId, userId))
      .orderBy(desc(zenPlanChangeRequests.createdAt))
      .limit(1)

    return rows[0] ? rowToPlanRequest(rows[0]) : null
  }

  async create(input: {
    userId: string
    currentTier: SubscriptionTier
    requestedTier: Exclude<SubscriptionTier, 'free'>
    note?: string
    contact?: string
  }): Promise<PlanChangeRequest> {
    await neonUsersRepository.ensureUserReference(input.userId)

    const rows = await getDatabaseClient()
      .insert(zenPlanChangeRequests)
      .values({
        userId: input.userId,
        currentTier: input.currentTier,
        requestedTier: input.requestedTier,
        note: input.note ?? null,
        contact: input.contact ?? null,
        status: 'pending',
      })
      .returning()

    return rowToPlanRequest(rows[0])
  }

  async updateStatus(
    id: string,
    status: PlanRequestStatus,
    adminNote?: string | null
  ): Promise<PlanChangeRequest> {
    const now = new Date()
    const rows = await getDatabaseClient()
      .update(zenPlanChangeRequests)
      .set({
        status,
        adminNote: typeof adminNote === 'undefined' ? null : adminNote,
        ...(status === 'approved' ? { approvedAt: now } : {}),
        ...(status === 'rejected' ? { rejectedAt: now } : {}),
        ...(status === 'activated' ? { activatedAt: now } : {}),
        updatedAt: now,
      })
      .where(eq(zenPlanChangeRequests.id, id))
      .returning()

    return rowToPlanRequest(rows[0])
  }
}

class NeonAdminAuditLogsRepository {
  async create(input: {
    adminUserId: string
    targetUserId: string
    action: string
    details: Record<string, unknown>
  }) {
    await Promise.all([
      neonUsersRepository.ensureUserReference(input.adminUserId),
      neonUsersRepository.ensureUserReference(input.targetUserId),
    ])

    const rows = await getDatabaseClient()
      .insert(zenAdminAuditLogs)
      .values({
        adminUserId: input.adminUserId,
        targetUserId: input.targetUserId,
        action: input.action,
        details: input.details,
      })
      .returning()

    return rowToAuditLog(rows[0])
  }

  async listByTargetUser(userId: string) {
    const rows = await getDatabaseClient()
      .select()
      .from(zenAdminAuditLogs)
      .where(eq(zenAdminAuditLogs.targetUserId, userId))
      .orderBy(desc(zenAdminAuditLogs.createdAt))

    return rows.map(rowToAuditLog)
  }
}

export const neonPlanRequestsRepository = new NeonPlanRequestsRepository()
export const neonAdminAuditLogsRepository = new NeonAdminAuditLogsRepository()
