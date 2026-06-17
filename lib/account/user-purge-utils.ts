import {
  UserPurgeActor,
  UserPurgeCounts,
  UserPurgePreview,
  UserPurgeScope,
} from '@/types'

export interface UserPurgeObjectRef {
  bucket: string
  key: string
}

export interface UserPurgeConfirmationContext {
  actor: UserPurgeActor
  scope: UserPurgeScope
  loginId?: string | null
  targetUserId?: string | null
}

export interface RawUserPurgeObjectRef {
  bucket?: string | null
  key?: string | null
}

const EMPTY_COUNTS: UserPurgeCounts = {
  conversations: 0,
  projects: 0,
  files: 0,
  generatedImages: 0,
  artifacts: 0,
  prompts: 0,
  playbooks: 0,
  customAssistants: 0,
  modelComparisons: 0,
  integrations: 0,
  usageAndPlanData: 0,
  telemetry: 0,
  sessions: 0,
  objectRefs: 0,
}

export const USER_PURGE_DELETION_ORDER = [
  'collect_object_refs',
  'delete_database_rows',
  'revoke_sessions_or_credentials',
  'tombstone_account_if_full_account',
  'delete_object_storage',
] as const

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

export function isUserPurgeScope(value: unknown): value is UserPurgeScope {
  return value === 'workspace_data' || value === 'full_account'
}

export function parseUserPurgeScope(value: unknown): UserPurgeScope {
  return isUserPurgeScope(value) ? value : 'workspace_data'
}

export function expectedUserPurgeConfirmation(
  context: UserPurgeConfirmationContext
): string {
  if (context.actor === 'admin') {
    return `${context.targetUserId ?? ''} PURGE`.trim()
  }

  if (context.scope === 'workspace_data') return 'DELETE DATA'

  const loginId = context.loginId?.trim()
  return loginId || 'DELETE ACCOUNT'
}

export function validateUserPurgeConfirmation(
  confirmation: unknown,
  context: UserPurgeConfirmationContext
): boolean {
  if (typeof confirmation !== 'string') return false
  return confirmation.trim() === expectedUserPurgeConfirmation(context)
}

function isSafeObjectRefPart(value: string): boolean {
  if (!value || value.length > 1024) return false
  if (value.startsWith('/') || value.includes('\\')) return false
  if (value.includes('..') || value.includes('//')) return false
  return /^[A-Za-z0-9._/-]+$/.test(value)
}

export function normalizeUserPurgeObjectRefs(
  refs: RawUserPurgeObjectRef[]
): UserPurgeObjectRef[] {
  const seen = new Set<string>()
  const normalized: UserPurgeObjectRef[] = []

  for (const ref of refs) {
    const bucket = ref.bucket?.trim()
    const key = ref.key?.trim()
    if (!bucket || !key) continue
    if (!isSafeObjectRefPart(bucket) || !isSafeObjectRefPart(key)) continue

    const dedupeKey = `${bucket}\n${key}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    normalized.push({ bucket, key })
  }

  return normalized
}

export function normalizeUserPurgeCounts(
  counts: Partial<UserPurgeCounts>
): UserPurgeCounts {
  return Object.fromEntries(
    Object.entries(EMPTY_COUNTS).map(([key, fallback]) => {
      const value = counts[key as keyof UserPurgeCounts]
      return [
        key,
        typeof value === 'number' && Number.isFinite(value)
          ? Math.max(0, Math.floor(value))
          : fallback,
      ]
    })
  ) as UserPurgeCounts
}

export function buildSafeUserPurgePreview(input: {
  userId: string
  scope: UserPurgeScope
  loginId?: string | null
  actor?: UserPurgeActor
  counts: Partial<UserPurgeCounts>
  generatedAt?: string
}): UserPurgePreview {
  const actor = input.actor ?? 'user'
  const counts = normalizeUserPurgeCounts(input.counts)
  return {
    userId: input.userId,
    scope: input.scope,
    requiresConfirmation: expectedUserPurgeConfirmation({
      actor,
      scope: input.scope,
      loginId: input.loginId,
      targetUserId: input.userId,
    }),
    counts,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    warnings: [
      'Deletion is irreversible.',
      'Object storage cleanup is best-effort after database access is revoked.',
      ...(input.scope === 'full_account'
        ? ['Full account deletion signs you out and removes credentials.']
        : ['Workspace data deletion keeps your account and current sign-in access.']),
    ],
  }
}

export function sanitizeUserPurgePreviewPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeUserPurgePreviewPayload)
  }

  if (!isObjectRecord(value)) return value

  const blockedKeys = new Set([
    'bucket',
    'key',
    'storagePath',
    'storage_path',
    'storageBucket',
    'storage_bucket',
    'publicUrl',
    'sourceUrl',
    'source_url',
    'token',
    'tokenHash',
    'encryptedTokenPayload',
    'passwordHash',
    'passwordSalt',
    'rawCostUsd',
    'marginUsd',
    'content',
    'snippet',
    'outputUrls',
  ])

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !blockedKeys.has(key))
      .map(([key, child]) => [key, sanitizeUserPurgePreviewPayload(child)])
  )
}

export function buildTombstoneUserPatch() {
  return {
    externalAuthProvider: null,
    externalAuthUserId: null,
    loginId: null,
    email: null,
    displayName: null,
    role: 'user' as const,
    updatedAt: new Date(),
  }
}

