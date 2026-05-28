import { PlanChangeRequest, PlanRequestStatus, SubscriptionTier } from '@/types'

export const UPGRADE_NUDGE_THRESHOLD = 0.8

export interface UsageLimitSnapshot {
  used: number
  limit: number
  remaining: number
  ratio: number
}

export interface DashboardLimitSnapshot {
  dailyMessages: UsageLimitSnapshot
  dailyImages: UsageLimitSnapshot
  imageCredits: UsageLimitSnapshot
  displayedCredits: UsageLimitSnapshot
}

export function buildUsageLimitSnapshot(
  used: number,
  limit: number
): UsageLimitSnapshot {
  const safeLimit = Math.max(0, limit)
  const safeUsed = Math.max(0, used)

  return {
    used: safeUsed,
    limit: safeLimit,
    remaining: Math.max(0, safeLimit - safeUsed),
    ratio: safeLimit > 0 ? safeUsed / safeLimit : 0,
  }
}

export function isNearLimit(limit: UsageLimitSnapshot) {
  return limit.limit > 0 && limit.ratio >= UPGRADE_NUDGE_THRESHOLD
}

export function getUpgradeNudgeForError(message?: string | null) {
  const normalized = message?.toLowerCase() ?? ''
  if (!normalized) return null

  if (normalized.includes('daily message limit')) {
    return {
      title: 'Daily message limit reached',
      description:
        'Your current plan has hit today\'s message cap. You can request a higher plan manually.',
    }
  }

  if (
    normalized.includes('daily image limit') ||
    normalized.includes('image credits')
  ) {
    return {
      title: 'Image limit reached',
      description:
        'Prism generations use image credits and daily image limits. A higher plan can add more room.',
    }
  }

  if (
    normalized.includes('premium assistant wallet') ||
    normalized.includes('core assistant wallet') ||
    normalized.includes('wallet is exhausted')
  ) {
    return {
      title: 'Plan usage exhausted',
      description:
        'Your assistant usage wallet is out for this cycle. You can request a higher plan for more capacity.',
    }
  }

  if (
    normalized.includes('not available for this account') ||
    normalized.includes('not available on your current plan') ||
    normalized.includes('available on your current plan') ||
    normalized.includes('model is not available') ||
    normalized.includes('current plan')
  ) {
    return {
      title: 'Plan upgrade may be needed',
      description:
        'This assistant, model, or request size may need a higher manual plan.',
    }
  }

  return null
}

export function getLatestPlanRequest(
  requests: PlanChangeRequest[]
): PlanChangeRequest | null {
  return requests[0] ?? null
}

export function getPlanRequestStatusLabel(status: PlanRequestStatus) {
  switch (status) {
    case 'pending':
      return 'Pending review'
    case 'approved':
      return 'Approved'
    case 'activated':
      return 'Activated'
    case 'rejected':
      return 'Not approved'
  }
}

export function sanitizePlanRequestAdminNote(note?: string | null) {
  const trimmed = note?.trim()
  if (!trimmed) return null
  return trimmed.length > 280 ? `${trimmed.slice(0, 277).trimEnd()}...` : trimmed
}

export function isUpgradeTier(
  currentTier: SubscriptionTier,
  requestedTier: SubscriptionTier
) {
  const order: SubscriptionTier[] = ['free', 'basic', 'pro', 'ultra', 'prime']
  return order.indexOf(requestedTier) > order.indexOf(currentTier)
}
