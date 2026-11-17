import 'server-only'

import { createHash, randomBytes } from 'node:crypto'
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm'
import { getDatabaseClient } from '../client'
import { zenApiTokens } from '../schema'
import { toIsoString, toNullableIsoString } from './helpers'
import { neonUsersRepository } from './users'

export const API_TOKEN_PREFIX = 'zq_'
const TOKEN_TTL_DAYS = 90
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

export type ApiTokenScope = 'cli'

export interface ApiTokenRecord {
  id: string
  userId: string
  name: string
  prefix: string
  scopes: string[]
  lastUsedAt: string | null
  expiresAt: string
  revokedAt: string | null
  createdAt: string
}

export function hashApiToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function generateApiToken(): string {
  const bytes = randomBytes(40)
  let body = ''
  for (const byte of bytes) body += BASE62[byte % 62]
  return `${API_TOKEN_PREFIX}${body}`
}

function toRecord(row: typeof zenApiTokens.$inferSelect): ApiTokenRecord {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    prefix: row.prefix,
    scopes: row.scopes,
    lastUsedAt: toNullableIsoString(row.lastUsedAt),
    expiresAt: toIsoString(row.expiresAt),
    revokedAt: toNullableIsoString(row.revokedAt),
    createdAt: toIsoString(row.createdAt),
  }
}

class NeonApiTokensRepository {
  /** Creates a token and returns its only plain copy. */
  async create(input: {
    userId: string
    name: string
    scopes: ApiTokenScope[]
  }): Promise<{ token: string; record: ApiTokenRecord }> {
    await neonUsersRepository.ensureUserReference(input.userId)
    const token = generateApiToken()
    const rows = await getDatabaseClient()
      .insert(zenApiTokens)
      .values({
        userId: input.userId,
        name: input.name.slice(0, 80),
        tokenHash: hashApiToken(token),
        prefix: token.slice(API_TOKEN_PREFIX.length, API_TOKEN_PREFIX.length + 8),
        scopes: input.scopes,
        expiresAt: new Date(Date.now() + TOKEN_TTL_DAYS * 86_400_000),
      })
      .returning()
    return { token, record: toRecord(rows[0]) }
  }

  async listForUser(userId: string): Promise<ApiTokenRecord[]> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenApiTokens)
      .where(and(eq(zenApiTokens.userId, userId), isNull(zenApiTokens.revokedAt)))
      .orderBy(desc(zenApiTokens.createdAt))
    return rows.map(toRecord)
  }

  async revoke(userId: string, id: string): Promise<boolean> {
    const rows = await getDatabaseClient()
      .update(zenApiTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(zenApiTokens.id, id), eq(zenApiTokens.userId, userId), isNull(zenApiTokens.revokedAt))
      )
      .returning({ id: zenApiTokens.id })
    return rows.length > 0
  }

  /** Revokes every live token the user has, such as after a password change. */
  async revokeAllForUser(userId: string): Promise<void> {
    await getDatabaseClient()
      .update(zenApiTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(zenApiTokens.userId, userId), isNull(zenApiTokens.revokedAt)))
  }

  /** Finds a live token by its plain value and marks it used at most once a minute. */
  async findActive(token: string): Promise<ApiTokenRecord | null> {
    if (!token.startsWith(API_TOKEN_PREFIX)) return null
    const rows = await getDatabaseClient()
      .select()
      .from(zenApiTokens)
      .where(
        and(
          eq(zenApiTokens.tokenHash, hashApiToken(token)),
          isNull(zenApiTokens.revokedAt),
          gt(zenApiTokens.expiresAt, new Date())
        )
      )
      .limit(1)
    const row = rows[0]
    if (!row) return null

    if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) {
      await getDatabaseClient()
        .update(zenApiTokens)
        .set({ lastUsedAt: sql`now()` })
        .where(eq(zenApiTokens.id, row.id))
    }
    return toRecord(row)
  }
}

export const neonApiTokensRepository = new NeonApiTokensRepository()
