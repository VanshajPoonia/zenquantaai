import 'server-only'

import { and, desc, eq } from 'drizzle-orm'
import { AuthUser, Role } from '@/types'
import { getDatabaseClient } from '../client'
import {
  zenAuthCredentials,
  zenAuthIdentities,
  zenProfiles,
  zenUsers,
} from '../schema'
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
    const loginId = user.loginId?.trim().toLowerCase() ?? null

    await getDatabaseClient()
      .insert(zenUsers)
      .values({
        id: user.id,
        externalAuthProvider: 'local',
        externalAuthUserId: user.id,
        loginId,
        email: user.email ?? null,
        role,
      })
      .onConflictDoUpdate({
        target: zenUsers.id,
        set: {
          externalAuthProvider: 'local',
          externalAuthUserId: user.id,
          loginId,
          email: user.email ?? null,
          role,
          updatedAt: new Date(),
        },
      })

    await getDatabaseClient()
      .insert(zenAuthIdentities)
      .values({
        userId: user.id,
        provider: 'local',
        providerUserId: loginId ?? user.id,
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

  async createLocalUser(input: {
    loginId: string
    passwordHash: string
    passwordSalt: string
    passwordParams: Record<string, unknown>
  }): Promise<NeonUserRecord> {
    const loginId = input.loginId.trim().toLowerCase()

    const existingCredential = await getDatabaseClient()
      .select({ userId: zenAuthCredentials.userId })
      .from(zenAuthCredentials)
      .where(eq(zenAuthCredentials.loginId, loginId))
      .limit(1)

    if (existingCredential[0]) {
      throw new Error('That ID is already taken.')
    }

    const createdUsers = await getDatabaseClient()
      .insert(zenUsers)
      .values({
        externalAuthProvider: 'local',
        loginId,
        displayName: loginId,
        role: 'user',
      })
      .returning()

    const createdUser = createdUsers[0]

    await getDatabaseClient()
      .update(zenUsers)
      .set({
        externalAuthUserId: createdUser.id,
        updatedAt: new Date(),
      })
      .where(eq(zenUsers.id, createdUser.id))

    await getDatabaseClient()
      .insert(zenAuthCredentials)
      .values({
        userId: createdUser.id,
        loginId,
        passwordHash: input.passwordHash,
        passwordSalt: input.passwordSalt,
        passwordParams: input.passwordParams,
      })

    await getDatabaseClient()
      .insert(zenAuthIdentities)
      .values({
        userId: createdUser.id,
        provider: 'local',
        providerUserId: loginId,
        lastSeenAt: new Date(),
      })

    await getDatabaseClient()
      .insert(zenProfiles)
      .values({
        userId: createdUser.id,
        loginId,
        displayName: loginId,
        role: 'user',
      })
      .onConflictDoNothing({ target: zenProfiles.userId })

    const user = await this.get(createdUser.id)
    if (!user) {
      throw new Error('Unable to create local Neon user.')
    }

    return user
  }

  async getCredentialByLoginId(loginId: string): Promise<{
    user: NeonUserRecord
    passwordHash: string
    passwordSalt: string
    passwordParams: Record<string, unknown>
  } | null> {
    const rows = await getDatabaseClient()
      .select({
        user: zenUsers,
        credential: zenAuthCredentials,
      })
      .from(zenAuthCredentials)
      .innerJoin(zenUsers, eq(zenAuthCredentials.userId, zenUsers.id))
      .where(eq(zenAuthCredentials.loginId, loginId.trim().toLowerCase()))
      .limit(1)

    const row = rows[0]
    if (!row) return null

    return {
      user: rowToUser(row.user),
      passwordHash: row.credential.passwordHash,
      passwordSalt: row.credential.passwordSalt,
      passwordParams:
        row.credential.passwordParams &&
        typeof row.credential.passwordParams === 'object' &&
        !Array.isArray(row.credential.passwordParams)
          ? (row.credential.passwordParams as Record<string, unknown>)
          : {},
    }
  }

  async updateLocalPassword(input: {
    userId: string
    passwordHash: string
    passwordSalt: string
    passwordParams: Record<string, unknown>
  }): Promise<void> {
    await this.ensureUserReference(input.userId)

    await getDatabaseClient()
      .update(zenAuthCredentials)
      .set({
        passwordHash: input.passwordHash,
        passwordSalt: input.passwordSalt,
        passwordParams: input.passwordParams,
        passwordUpdatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(zenAuthCredentials.userId, input.userId))
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
