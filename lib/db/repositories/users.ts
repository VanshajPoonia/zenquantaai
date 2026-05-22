import 'server-only'

import { and, desc, eq } from 'drizzle-orm'
import { AuthUser, Role } from '@/types'
import { getDatabaseClient } from '../client'
import { zenAuthIdentities, zenProfiles, zenUsers } from '../schema'
import { toIsoString, toNullableIsoString } from './helpers'

type UserRow = typeof zenUsers.$inferSelect
type AuthIdentityRow = typeof zenAuthIdentities.$inferSelect

export interface NeonUserRecord {
  id: string
  externalAuthProvider: string | null
  externalAuthUserId: string | null
  loginId: string | null
  email: string | null
  displayName: string | null
  role: Role
  createdAt: string
  updatedAt: string
}

export interface NeonAuthIdentityRecord {
  id: string
  userId: string
  provider: string
  providerUserId: string
  providerEmail: string | null
  lastSeenAt: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

function rowToUser(row: UserRow): NeonUserRecord {
  return {
    id: row.id,
    externalAuthProvider: row.externalAuthProvider,
    externalAuthUserId: row.externalAuthUserId,
    loginId: row.loginId,
    email: row.email,
    displayName: row.displayName,
    role: row.role as Role,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  }
}

function rowToIdentity(row: AuthIdentityRow): NeonAuthIdentityRecord {
  return {
    id: row.id,
    userId: row.userId,
    provider: row.provider,
    providerUserId: row.providerUserId,
    providerEmail: row.providerEmail,
    lastSeenAt: toNullableIsoString(row.lastSeenAt),
    metadata:
      row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  }
}

class NeonUsersRepository {
  async list(): Promise<NeonUserRecord[]> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenUsers)
      .orderBy(desc(zenUsers.updatedAt))

    return rows.map(rowToUser)
  }

  async get(userId: string): Promise<NeonUserRecord | null> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenUsers)
      .where(eq(zenUsers.id, userId))
      .limit(1)

    return rows[0] ? rowToUser(rows[0]) : null
  }

  async getByExternalIdentity(
    provider: string,
    providerUserId: string
  ): Promise<NeonUserRecord | null> {
    const rows = await getDatabaseClient()
      .select({ user: zenUsers })
      .from(zenAuthIdentities)
      .innerJoin(zenUsers, eq(zenAuthIdentities.userId, zenUsers.id))
      .where(
        and(
          eq(zenAuthIdentities.provider, provider),
          eq(zenAuthIdentities.providerUserId, providerUserId)
        )
      )
      .limit(1)

    return rows[0] ? rowToUser(rows[0].user) : null
  }

  async ensureUserReference(userId: string): Promise<NeonUserRecord> {
    await getDatabaseClient()
      .insert(zenUsers)
      .values({ id: userId })
      .onConflictDoNothing({ target: zenUsers.id })

    const user = await this.get(userId)
    if (!user) {
      throw new Error('Unable to ensure Neon user reference.')
    }

    return user
  }

  async ensureFromAuthUser(user: AuthUser): Promise<NeonUserRecord> {
    const role = (user.role as Role | null | undefined) ?? 'user'

    await getDatabaseClient()
      .insert(zenUsers)
      .values({
        id: user.id,
        externalAuthProvider: 'supabase',
        externalAuthUserId: user.id,
        loginId: user.loginId ?? null,
        email: user.email ?? null,
        role,
      })
      .onConflictDoUpdate({
        target: zenUsers.id,
        set: {
          externalAuthProvider: 'supabase',
          externalAuthUserId: user.id,
          loginId: user.loginId ?? null,
          email: user.email ?? null,
          role,
          updatedAt: new Date(),
        },
      })

    await getDatabaseClient()
      .insert(zenAuthIdentities)
      .values({
        userId: user.id,
        provider: 'supabase',
        providerUserId: user.id,
        providerEmail: user.email ?? null,
        lastSeenAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [zenAuthIdentities.provider, zenAuthIdentities.providerUserId],
        set: {
          userId: user.id,
          providerEmail: user.email ?? null,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        },
      })

    const ensured = await this.get(user.id)
    if (!ensured) {
      throw new Error('Unable to ensure Neon user from auth session.')
    }

    return ensured
  }

  async listIdentities(userId: string): Promise<NeonAuthIdentityRecord[]> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenAuthIdentities)
      .where(eq(zenAuthIdentities.userId, userId))
      .orderBy(desc(zenAuthIdentities.updatedAt))

    return rows.map(rowToIdentity)
  }

  async updateRole(userId: string, role: Role): Promise<NeonUserRecord> {
    await this.ensureUserReference(userId)

    const rows = await getDatabaseClient()
      .update(zenUsers)
      .set({
        role,
        updatedAt: new Date(),
      })
      .where(eq(zenUsers.id, userId))
      .returning()

    await getDatabaseClient()
      .update(zenProfiles)
      .set({
        role,
        updatedAt: new Date(),
      })
      .where(eq(zenProfiles.userId, userId))

    return rowToUser(rows[0])
  }
}

export const neonUsersRepository = new NeonUsersRepository()
