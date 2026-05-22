import { PlanChangeRequest, PlanRequestStatus, SubscriptionTier } from '@/types'
import { neonQuery } from './neon'

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
    const rows = await neonQuery<PlanRequestRow>(
      'select * from public.zen_plan_change_requests order by created_at desc'
    )

    return rows.map(rowToPlanRequest)
  }

  async listByUser(userId: string): Promise<PlanChangeRequest[]> {
    const rows = await neonQuery<PlanRequestRow>(
      `
        select *
        from public.zen_plan_change_requests
        where user_id = $1
        order by created_at desc
      `,
      [userId]
    )

    return rows.map(rowToPlanRequest)
  }

  async getLatestPendingForUser(userId: string): Promise<PlanChangeRequest | null> {
    const rows = await neonQuery<PlanRequestRow>(
      `
        select *
        from public.zen_plan_change_requests
        where user_id = $1 and status = 'pending'
        order by created_at desc
        limit 1
      `,
      [userId]
    )

    return rows[0] ? rowToPlanRequest(rows[0]) : null
  }

  async create(input: {
    userId: string
    currentTier: SubscriptionTier
    requestedTier: Exclude<SubscriptionTier, 'free'>
    note?: string
    contact?: string
  }): Promise<PlanChangeRequest> {
    const rows = await neonQuery<PlanRequestRow>(
      `
        insert into public.zen_plan_change_requests (
          user_id,
          current_tier,
          requested_tier,
          note,
          contact,
          status
        )
        values ($1, $2, $3, $4, $5, 'pending')
        returning *
      `,
      [
        input.userId,
        input.currentTier,
        input.requestedTier,
        input.note ?? null,
        input.contact ?? null,
      ]
    )

    return rowToPlanRequest(rows[0])
  }

  async updateStatus(
    id: string,
    status: PlanRequestStatus,
    adminNote?: string | null
  ): Promise<PlanChangeRequest> {
    const now = new Date().toISOString()
    const rows = await neonQuery<PlanRequestRow>(
      `
        update public.zen_plan_change_requests
        set status = $2,
            admin_note = $3,
            approved_at = case when $2 = 'approved' then $4 else approved_at end,
            rejected_at = case when $2 = 'rejected' then $4 else rejected_at end,
            activated_at = case when $2 = 'activated' then $4 else activated_at end
        where id = $1
        returning *
      `,
      [id, status, typeof adminNote === 'undefined' ? null : adminNote, now]
    )

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
    const rows = await neonQuery<AuditLogRow>(
      `
        insert into public.zen_admin_audit_logs (
          admin_user_id,
          target_user_id,
          action,
          details
        )
        values ($1, $2, $3, $4::jsonb)
        returning *
      `,
      [input.adminUserId, input.targetUserId, input.action, JSON.stringify(input.details)]
    )

    return rowToAuditLog(rows[0])
  }

  async listByTargetUser(userId: string) {
    const rows = await neonQuery<AuditLogRow>(
      `
        select *
        from public.zen_admin_audit_logs
        where target_user_id = $1
        order by created_at desc
      `,
      [userId]
    )

    return rows.map(rowToAuditLog)
  }
}

export const planRequestsStore = new PlanRequestsStore()
export const adminAuditLogsStore = new AdminAuditLogsStore()
