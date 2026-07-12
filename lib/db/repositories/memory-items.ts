import 'server-only'

import { and, desc, eq, isNull, or, sql, type SQL } from 'drizzle-orm'
import {
  AIMode,
  MemoryCandidate,
  MemoryItem,
  MemoryItemKind,
  MemoryItemStatus,
} from '@/types'
import { resolveMemoryProjectScope } from '@/lib/context/memory-scope'
import { getDatabaseClient } from '../client'
import { zenMemoryItems } from '../schema'
import { toIsoString, toJsonObject, toNullableIsoString, toNumber } from './helpers'
import { neonUsersRepository } from './users'

type MemoryItemRow = typeof zenMemoryItems.$inferSelect
type MemoryItemInsert = typeof zenMemoryItems.$inferInsert

function normalizeContent(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase()
}

function vectorLiteral(embedding: number[]): string {
  return `[${embedding.map((value) => Number(value).toFixed(8)).join(',')}]`
}

// Write-time scope: match the exact bucket a candidate will be stored in, so
// supersession finds the right prior item (a global correction must not collide
// with a same-key project item, and vice versa).
function writeScopeCondition(scope: string | null): SQL {
  return scope === null
    ? isNull(zenMemoryItems.projectId)
    : eq(zenMemoryItems.projectId, scope)
}

// Read-time scope: globals surface everywhere; inside a real project, globals
// AND that project's items surface. See AI_CONTEXT_ENGINE.md §4.2.
function readScopeCondition(scope: string | null): SQL {
  if (scope === null) return isNull(zenMemoryItems.projectId)
  return or(
    isNull(zenMemoryItems.projectId),
    eq(zenMemoryItems.projectId, scope)
  ) as SQL
}

function rowToMemoryItem(row: MemoryItemRow): MemoryItem {
  return {
    id: row.id,
    userId: row.userId,
    projectId: row.projectId ?? null,
    sourceConversationId: row.sourceConversationId ?? null,
    kind: row.kind as MemoryItemKind,
    canonicalKey: row.canonicalKey,
    content: row.content,
    contentJson: row.contentJson
      ? toJsonObject<Record<string, unknown>>(row.contentJson, {})
      : null,
    mode: (row.mode as AIMode | null) ?? null,
    importance: row.importance,
    confidence: toNumber(row.confidence),
    status: row.status as MemoryItemStatus,
    supersedesId: row.supersedesId ?? null,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
    lastConfirmedAt: toIsoString(row.lastConfirmedAt),
    validUntil: toNullableIsoString(row.validUntil),
  }
}

class NeonMemoryItemsRepository {
  /**
   * Persist write-gate candidates with canonical-key dedupe and supersession:
   * an unchanged fact bumps `last_confirmed_at`; a changed fact for the same key
   * inserts a new active row and marks the prior one superseded (corrections
   * win); a novel fact is inserted. Filters by `user_id` at every step so a
   * candidate can never touch another user's memory.
   */
  async record(userId: string, candidates: MemoryCandidate[]): Promise<void> {
    if (candidates.length === 0) return
    await neonUsersRepository.ensureUserReference(userId)

    const db = getDatabaseClient()

    for (const candidate of candidates) {
      const scope = resolveMemoryProjectScope(candidate.projectId)

      const existingRows = await db
        .select()
        .from(zenMemoryItems)
        .where(
          and(
            eq(zenMemoryItems.userId, userId),
            eq(zenMemoryItems.status, 'active'),
            eq(zenMemoryItems.canonicalKey, candidate.canonicalKey),
            writeScopeCondition(scope)
          )
        )
        .orderBy(desc(zenMemoryItems.createdAt))
        .limit(1)

      const existing = existingRows[0]
      const now = new Date()

      if (existing) {
        if (normalizeContent(existing.content) === normalizeContent(candidate.content)) {
          // Unchanged: reinforce it without reordering or re-embedding.
          await db
            .update(zenMemoryItems)
            .set({
              lastConfirmedAt: now,
              updatedAt: now,
              importance: Math.max(existing.importance, candidate.importance),
              confidence: Math.max(
                toNumber(existing.confidence),
                candidate.confidence
              ).toFixed(3),
            })
            .where(eq(zenMemoryItems.id, existing.id))
          continue
        }

        // Changed: the new value supersedes the old one.
        await db.insert(zenMemoryItems).values(
          this.buildInsert(userId, candidate, scope, existing.id)
        )
        await db
          .update(zenMemoryItems)
          .set({ status: 'superseded', updatedAt: now })
          .where(eq(zenMemoryItems.id, existing.id))
        continue
      }

      await db
        .insert(zenMemoryItems)
        .values(this.buildInsert(userId, candidate, scope, null))
    }
  }

  private buildInsert(
    userId: string,
    candidate: MemoryCandidate,
    scope: string | null,
    supersedesId: string | null
  ): MemoryItemInsert {
    return {
      userId,
      projectId: scope,
      sourceConversationId: candidate.sourceConversationId ?? null,
      kind: candidate.kind,
      canonicalKey: candidate.canonicalKey,
      content: candidate.content,
      mode: candidate.mode ?? null,
      importance: candidate.importance,
      confidence: candidate.confidence.toFixed(3),
      status: 'active',
      supersedesId,
      embedding: candidate.embedding ?? null,
    }
  }

  /** Similarity search over active memory in scope. Ignores unembedded rows. */
  async search(input: {
    userId: string
    embedding: number[]
    projectId?: string | null
    limit?: number
  }): Promise<MemoryItem[]> {
    const scope = resolveMemoryProjectScope(input.projectId)
    const distance = sql`${zenMemoryItems.embedding} <=> ${vectorLiteral(
      input.embedding
    )}::vector`

    const rows = await getDatabaseClient()
      .select()
      .from(zenMemoryItems)
      .where(
        and(
          eq(zenMemoryItems.userId, input.userId),
          eq(zenMemoryItems.status, 'active'),
          readScopeCondition(scope),
          sql`${zenMemoryItems.embedding} is not null`
        )
      )
      .orderBy(distance)
      .limit(input.limit ?? 6)

    return rows.map(rowToMemoryItem)
  }

  /**
   * Non-vector fallback for when embeddings are unconfigured: return the most
   * important, most-recently-confirmed active items in scope.
   */
  async listActiveForScope(input: {
    userId: string
    projectId?: string | null
    limit?: number
  }): Promise<MemoryItem[]> {
    const scope = resolveMemoryProjectScope(input.projectId)

    const rows = await getDatabaseClient()
      .select()
      .from(zenMemoryItems)
      .where(
        and(
          eq(zenMemoryItems.userId, input.userId),
          eq(zenMemoryItems.status, 'active'),
          readScopeCondition(scope)
        )
      )
      .orderBy(desc(zenMemoryItems.importance), desc(zenMemoryItems.lastConfirmedAt))
      .limit(input.limit ?? 6)

    return rows.map(rowToMemoryItem)
  }

  /**
   * Every active durable item for a user across all scopes (global + each
   * project), for the Memory Vault surface (Phase 3c). Ordered most-important
   * and most-recently-confirmed first. User-scoped like every other query here.
   */
  async listAllActiveForUser(userId: string, limit = 200): Promise<MemoryItem[]> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenMemoryItems)
      .where(
        and(
          eq(zenMemoryItems.userId, userId),
          eq(zenMemoryItems.status, 'active')
        )
      )
      .orderBy(desc(zenMemoryItems.importance), desc(zenMemoryItems.lastConfirmedAt))
      .limit(limit)

    return rows.map(rowToMemoryItem)
  }

  /**
   * Forget a durable item the user asked to remove: flip it to `expired` so
   * retrieval ignores it, while the row (and any supersession chain) is
   * preserved rather than hard-deleted — consistent with "raw is truth, this
   * layer is additive". Scoped to the user, so it can never expire another
   * user's memory. Returns true when an active item was found and expired.
   */
  async expire(userId: string, id: string): Promise<boolean> {
    const db = getDatabaseClient()

    const existing = await db
      .select({ id: zenMemoryItems.id })
      .from(zenMemoryItems)
      .where(
        and(
          eq(zenMemoryItems.userId, userId),
          eq(zenMemoryItems.id, id),
          eq(zenMemoryItems.status, 'active')
        )
      )
      .limit(1)

    if (existing.length === 0) return false

    await db
      .update(zenMemoryItems)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(and(eq(zenMemoryItems.userId, userId), eq(zenMemoryItems.id, id)))

    return true
  }
}

export const neonMemoryItemsRepository = new NeonMemoryItemsRepository()
