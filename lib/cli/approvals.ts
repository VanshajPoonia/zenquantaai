/** Web approvals for zq permission prompts. Safe to import in the browser. */

export const APPROVAL_TTL_MS = 10 * 60_000
export const APPROVAL_TITLE_MAX = 200
export const APPROVAL_DETAIL_MAX = 4_000
export const APPROVALS_POLL_MS = 5_000
/** The web polls only while a zq session changed this recently. */
export const APPROVALS_ACTIVE_WINDOW_MS = 10 * 60_000

export type CliApprovalStatus = 'pending' | 'approved' | 'denied' | 'expired' | 'answered_locally'

export interface PendingCliApproval {
  id: string
  conversationId: string
  tool: string
  title: string
  detail: string
  createdAt: string
  expiresAt: string
}

export interface PendingCliApprovalsResponse {
  enabled: boolean
  serverNow: string
  latestCliActivityAt: string | null
  approvals: PendingCliApproval[]
}

/** A pending row past its expiry reads as expired, so expiry never approves anything. */
export function effectiveApprovalStatus(
  row: { status: CliApprovalStatus; expiresAt: Date },
  now = Date.now()
): CliApprovalStatus {
  return row.status === 'pending' && row.expiresAt.getTime() <= now ? 'expired' : row.status
}

/** Time left on the server clock, given the offset measured when the list arrived. */
export function approvalTimeLeftMs(expiresAt: string, serverOffsetMs: number, now = Date.now()): number {
  const left = Date.parse(expiresAt) - (now + serverOffsetMs)
  return Number.isFinite(left) ? Math.max(0, left) : 0
}

export function formatTimeLeft(ms: number): string {
  if (ms <= 0) return 'Expired'
  const seconds = Math.ceil(ms / 1_000)
  if (seconds < 60) return `${seconds} s left`
  return `${Math.ceil(seconds / 60)} min left`
}

/** Whether the web should keep asking for approvals. */
export function shouldPollApprovals(input: {
  enabled: boolean
  visible: boolean
  pendingCount: number
  latestActivityAt: number | null
  now?: number
}): boolean {
  if (!input.enabled || !input.visible) return false
  if (input.pendingCount > 0) return true
  const now = input.now ?? Date.now()
  return input.latestActivityAt !== null && now - input.latestActivityAt < APPROVALS_ACTIVE_WINDOW_MS
}
