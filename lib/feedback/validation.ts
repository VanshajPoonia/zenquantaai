import {
  FeedbackEntityType,
  FeedbackRating,
  FeedbackSubmitRequest,
} from '@/types'

export const FEEDBACK_ENTITY_TYPES = [
  'message',
  'model_candidate',
  'artifact_action',
  'playbook_run',
  'image_generation',
  'search_result',
] as const satisfies readonly FeedbackEntityType[]

export const FEEDBACK_RATINGS = [
  'up',
  'down',
  'neutral',
] as const satisfies readonly FeedbackRating[]

const MAX_REASON_LENGTH = 500
const MAX_METADATA_KEYS = 20
const MAX_METADATA_KEY_LENGTH = 64
const MAX_METADATA_STRING_LENGTH = 240
const MAX_METADATA_ARRAY_ITEMS = 10
const PRIVATE_KEY_PATTERN =
  /(token|secret|password|credential|authorization|cookie|api[-_]?key|private|sourceurl|source_url|objectkey|storagepath|storage_path|bucket|content|snippet|rawcost|margin)/i

type SafeMetadataValue =
  | string
  | number
  | boolean
  | null
  | SafeMetadataValue[]
  | { [key: string]: SafeMetadataValue }

export interface ParsedFeedbackSubmitRequest {
  entityType: FeedbackEntityType
  entityId: string
  rating: FeedbackRating
  reason: string | null
  metadata: Record<string, unknown>
}

export type FeedbackParseResult =
  | { ok: true; value: ParsedFeedbackSubmitRequest }
  | { ok: false; error: string }

export function isFeedbackEntityType(value: unknown): value is FeedbackEntityType {
  return (
    typeof value === 'string' &&
    (FEEDBACK_ENTITY_TYPES as readonly string[]).includes(value)
  )
}

export function isFeedbackRating(value: unknown): value is FeedbackRating {
  return (
    typeof value === 'string' &&
    (FEEDBACK_RATINGS as readonly string[]).includes(value)
  )
}

export function normalizeFeedbackReason(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (!normalized) return null
  return normalized.slice(0, MAX_REASON_LENGTH)
}

function sanitizeMetadataKey(key: string): string | null {
  const normalized = key.replace(/[^\w.-]/g, '_').slice(0, MAX_METADATA_KEY_LENGTH)
  if (!normalized || PRIVATE_KEY_PATTERN.test(normalized)) return null
  return normalized
}

function sanitizeMetadataValue(value: unknown, depth: number): SafeMetadataValue | undefined {
  if (value === null) return null
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined
  }
  if (typeof value === 'string') {
    return value.replace(/\s+/g, ' ').trim().slice(0, MAX_METADATA_STRING_LENGTH)
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_METADATA_ARRAY_ITEMS)
      .map((item) => sanitizeMetadataValue(item, depth + 1))
      .filter((item): item is SafeMetadataValue => typeof item !== 'undefined')
  }
  if (value && typeof value === 'object' && depth < 2) {
    return sanitizeFeedbackMetadata(value, depth + 1) as {
      [key: string]: SafeMetadataValue
    }
  }

  return undefined
}

export function sanitizeFeedbackMetadata(
  value: unknown,
  depth = 0
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  const entries: Array<[string, SafeMetadataValue]> = []
  for (const [key, rawValue] of Object.entries(value)) {
    if (entries.length >= MAX_METADATA_KEYS) break
    const safeKey = sanitizeMetadataKey(key)
    if (!safeKey) continue

    const safeValue = sanitizeMetadataValue(rawValue, depth)
    if (typeof safeValue === 'undefined') continue
    entries.push([safeKey, safeValue])
  }

  return Object.fromEntries(entries)
}

export function parseFeedbackSubmitRequest(
  body: unknown
): FeedbackParseResult {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Feedback payload is required.' }
  }

  const input = body as Partial<FeedbackSubmitRequest>
  if (!isFeedbackEntityType(input.entityType)) {
    return { ok: false, error: 'Unsupported feedback entity type.' }
  }
  if (typeof input.entityId !== 'string' || !input.entityId.trim()) {
    return { ok: false, error: 'Feedback entity id is required.' }
  }
  if (!isFeedbackRating(input.rating)) {
    return { ok: false, error: 'Unsupported feedback rating.' }
  }

  return {
    ok: true,
    value: {
      entityType: input.entityType,
      entityId: input.entityId.trim().slice(0, 200),
      rating: input.rating,
      reason: normalizeFeedbackReason(input.reason),
      metadata: sanitizeFeedbackMetadata(input.metadata),
    },
  }
}
