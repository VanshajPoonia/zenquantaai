import { APPROVAL_DETAIL_MAX, APPROVAL_TITLE_MAX } from './approvals'
import { isValidCliSessionId } from './session-sync'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TOOL_PATTERN = /^[\w.-]{1,40}$/

export interface CliApprovalInput {
  sessionId: string
  tool: string
  title: string
  detail: string
}

export function isApprovalId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

/** Validates what zq sends. Long text is refused, never cut, so the web never shows half a command. */
export function parseApprovalInput(body: unknown): CliApprovalInput | null {
  if (!body || typeof body !== 'object') return null
  const value = body as Record<string, unknown>
  if (!isValidCliSessionId(value.sessionId)) return null
  if (typeof value.tool !== 'string' || !TOOL_PATTERN.test(value.tool)) return null
  if (typeof value.title !== 'string' || typeof value.detail !== 'string') return null
  const title = value.title.trim()
  if (!title || title.length > APPROVAL_TITLE_MAX) return null
  if (!value.detail.trim() || value.detail.length > APPROVAL_DETAIL_MAX) return null
  return { sessionId: value.sessionId, tool: value.tool, title, detail: value.detail }
}

/** zq can only close its own prompt. It can never approve or deny from here. */
export function parseApprovalClose(body: unknown): 'answered_locally' | 'expired' | null {
  const status = (body as { status?: unknown } | null)?.status
  return status === 'answered_locally' || status === 'expired' ? status : null
}

/** The web approves once or denies. There is no "always allow" from the web. */
export function parseApprovalDecision(body: unknown): 'approve' | 'deny' | null {
  const decision = (body as { decision?: unknown } | null)?.decision
  return decision === 'approve' || decision === 'deny' ? decision : null
}
