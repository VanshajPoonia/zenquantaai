import 'server-only'

import { MODEL_OVERRIDE_CONFIGS } from '@/lib/config'
import { SubscriptionStatus, SubscriptionTier, Role } from '@/types'

export const PLAN_TIER_RANK: Record<SubscriptionTier, number> = {
  free: 0,
  basic: 1,
  pro: 2,
  ultra: 3,
  prime: 4,
}

export function isSubscriptionTier(value: unknown): value is SubscriptionTier {
  return (
    value === 'free' ||
    value === 'basic' ||
    value === 'pro' ||
    value === 'ultra' ||
    value === 'prime'
  )
}

export function isPaidSubscriptionTier(
  value: unknown
): value is Exclude<SubscriptionTier, 'free'> {
  return (
    value === 'basic' ||
    value === 'pro' ||
    value === 'ultra' ||
    value === 'prime'
  )
}

export function isSubscriptionStatus(value: unknown): value is SubscriptionStatus {
  return value === 'active' || value === 'paused' || value === 'cancelled'
}

export function isRole(value: unknown): value is Role {
  return value === 'user' || value === 'admin'
}

export function requestedTierIsUpgrade(
  currentTier: SubscriptionTier,
  requestedTier: Exclude<SubscriptionTier, 'free'>
): boolean {
  return PLAN_TIER_RANK[requestedTier] > PLAN_TIER_RANK[currentTier]
}

export function parseNonNegativeInteger(
  value: unknown,
  fieldName: string
): number | undefined {
  if (value === null || typeof value === 'undefined' || value === '') {
    return undefined
  }

  const parsed = typeof value === 'number' ? value : Number(value)

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative integer.`)
  }

  return parsed
}

export function parseOptionalNote(value: unknown): string | null | undefined {
  if (value === null) return null
  if (typeof value === 'undefined') return undefined
  return String(value).trim() || null
}

export function parseAllowedModelOverrides(value: unknown): string[] | undefined {
  if (typeof value === 'undefined') return undefined

  const rawItems = Array.isArray(value)
    ? value
    : String(value)
        .split(',')
        .map((item) => item.trim())

  const allowedModels = new Set(
    Object.values(MODEL_OVERRIDE_CONFIGS).map((option) => option.model)
  )
  const models = [...new Set(rawItems.filter((item): item is string => {
    return typeof item === 'string' && item.length > 0
  }))]

  if (!models.every((model) => allowedModels.has(model))) {
    throw new Error('Allowed model overrides contain an unavailable model.')
  }

  return models
}
