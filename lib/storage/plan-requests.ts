import { PlanChangeRequest, PlanRequestStatus, SubscriptionTier } from '@/types'
import { supabaseRequest } from './supabase'

const PLAN_REQUESTS_TABLE = 'zen_plan_change_requests'
const AUDIT_LOGS_TABLE = 'zen_admin_audit_logs'

type PlanRequestRow = {
  id: string
  user_id: string
  current_tier: SubscriptionTier
  requested_tier: Exclude<SubscriptionTier, 'free'>
  note: string | null
  contact: string | null
  admin_note: string | null
  status: PlanRequestStatus
  approved_at: string | null
  rejected_at: string | null
  activated_at: string | null
  created_at: string
  updated_at: string
}

type AuditLogRow = {
  id: string
  admin_user_id: string
  target_user_id: string
  action: string
  details: Record<string, unknown> | null
  created_at: string
}

function rowToPlanRequest(row: PlanRequestRow): PlanChangeRequest {
  return {
    id: row.id,
    userId: row.user_id,
    currentTier: row.current_tier,
    requestedTier: row.requested_tier,
    note: row.note,
    contact: row.contact,
    adminNote: row.admin_note,
    status: row.status,
    approvedAt: row.approved_at,
    rejectedAt: row.rejected_at,
    activatedAt: row.activated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToAuditLog(row: AuditLogRow) {
  return {
    id: row.id,
    adminUserId: row.admin_user_id,
    targetUserId: row.target_user_id,
    action: row.action,
    details: row.details ?? {},
    createdAt: row.created_at,
  }
}

class PlanRequestsStore {
  async list(): Promise<PlanChangeRequest[]> {
    const rows = await supabaseRequest<PlanRequestRow[]>(PLAN_REQUESTS_TABLE, {
      query: {
        select: '*',
        order: 'created_at.desc',
      },
    })

    return rows.map(rowToPlanRequest)
  }

  async listByUser(userId: string): Promise<PlanChangeRequest[]> {
    const rows = await supabaseRequest<PlanRequestRow[]>(PLAN_REQUESTS_TABLE, {
      query: {
        user_id: `eq.${userId}`,
        select: '*',
        order: 'created_at.desc',
      },
    })

    return rows.map(rowToPlanRequest)
  }

  async getLatestPendingForUser(userId: string): Promise<PlanChangeRequest | null> {
    const rows = await supabaseRequest<PlanRequestRow[]>(PLAN_REQUESTS_TABLE, {
      query: {
        user_id: `eq.${userId}`,
        status: 'eq.pending',
        select: '*',
        order: 'created_at.desc',
        limit: 1,
      },
    })

    return rows[0] ? rowToPlanRequest(rows[0]) : null
  }

  async create(input: {
    userId: string
    currentTier: SubscriptionTier
    requestedTier: Exclude<SubscriptionTier, 'free'>
    note?: string
    contact?: string
  }): Promise<PlanChangeRequest> {
    const rows = await supabaseRequest<PlanRequestRow[]>(PLAN_REQUESTS_TABLE, {
      method: 'POST',
      body: {
        user_id: input.userId,
        current_tier: input.currentTier,
        requested_tier: input.requestedTier,
        note: input.note ?? null,
        contact: input.contact ?? null,
        status: 'pending',
      },
      prefer: 'return=representation',
    })

    return rowToPlanRequest(rows[0])
  }

  async updateStatus(
    id: string,
    status: PlanRequestStatus,
    adminNote?: string | null
  ): Promise<PlanChangeRequest> {
    const now = new Date().toISOString()
    const rows = await supabaseRequest<PlanRequestRow[]>(PLAN_REQUESTS_TABLE, {
      method: 'PATCH',
      query: {
        id: `eq.${id}`,
      },
      body: {
        status,
        admin_note: typeof adminNote === 'undefined' ? null : adminNote,
        ...(status === 'approved' ? { approved_at: now } : {}),
        ...(status === 'rejected' ? { rejected_at: now } : {}),
        ...(status === 'activated' ? { activated_at: now } : {}),
      },
      prefer: 'return=representation',
    })

    return rowToPlanRequest(rows[0])
  }
}

class AdminAuditLogsStore {
  async create(input: {
    adminUserId: string
    targetUserId: string
    action: string
    details: Record<string, unknown>
  }) {
    const rows = await supabaseRequest<AuditLogRow[]>(AUDIT_LOGS_TABLE, {
      method: 'POST',
      body: {
        admin_user_id: input.adminUserId,
        target_user_id: input.targetUserId,
        action: input.action,
        details: input.details,
      },
      prefer: 'return=representation',
    })

    return rowToAuditLog(rows[0])
  }

  async listByTargetUser(userId: string) {
    const rows = await supabaseRequest<AuditLogRow[]>(AUDIT_LOGS_TABLE, {
      query: {
        target_user_id: `eq.${userId}`,
        select: '*',
        order: 'created_at.desc',
      },
    })

    return rows.map(rowToAuditLog)
  }
}

export const planRequestsStore = new PlanRequestsStore()
export const adminAuditLogsStore = new AdminAuditLogsStore()
