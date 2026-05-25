import 'server-only'

import { desc, eq } from 'drizzle-orm'
import { AuthUser, Profile, Role } from '@/types'
import { getDatabaseClient } from '../client'
import { zenProfiles } from '../schema'
import { toIsoString } from './helpers'
import { neonUsersRepository } from './users'

type ProfileRow = typeof zenProfiles.$inferSelect

const HARDCODED_ADMIN_LOGIN_IDS = new Set(['kayla.viehland'])
const HARDCODED_ADMIN_EMAILS = new Set(['kayla.viehland@login.zenquanta.local'])

function isHardcodedAdminIdentity(input: {
  loginId?: string | null
  email?: string | null
}): boolean {
  const loginId = input.loginId?.trim().toLowerCase() ?? null
  const email = input.email?.trim().toLowerCase() ?? null

  return Boolean(
    (loginId && HARDCODED_ADMIN_LOGIN_IDS.has(loginId)) ||
      (email && HARDCODED_ADMIN_EMAILS.has(email))
  )
}

function rowToProfile(row: ProfileRow): Profile {
  const forcedRole: Role = isHardcodedAdminIdentity({
    loginId: row.loginId,
    email: row.email,
  })
    ? 'admin'
    : (row.role as Role)

  return {
    userId: row.userId,
    loginId: row.loginId,
    email: row.email,
    displayName: row.displayName,
    role: forcedRole,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  }
}

class NeonProfilesRepository {
  async list(): Promise<Profile[]> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenProfiles)
      .orderBy(desc(zenProfiles.updatedAt))

    return rows.map(rowToProfile)
  }

  async get(userId: string): Promise<Profile | null> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenProfiles)
      .where(eq(zenProfiles.userId, userId))
      .limit(1)

    return rows[0] ? rowToProfile(rows[0]) : null
  }

  async ensureFromAuthUser(user: AuthUser): Promise<Profile> {
    const existing = await this.get(user.id)
    const forcedAdminRole: Role | undefined = isHardcodedAdminIdentity(user)
      ? 'admin'
      : undefined
    const role = forcedAdminRole ?? existing?.role ?? user.role ?? 'user'

    await neonUsersRepository.ensureFromAuthUser({
      ...user,
      role,
    })

    if (existing) {
      const needsUpdate =
        existing.loginId !== (user.loginId ?? null) ||
        existing.email !== (user.email ?? null) ||
        (forcedAdminRole === 'admin' && existing.role !== 'admin')

      if (!needsUpdate) return existing

      const updated = await getDatabaseClient()
        .update(zenProfiles)
        .set({
          loginId: user.loginId ?? null,
          email: user.email ?? null,
          ...(forcedAdminRole ? { role: forcedAdminRole } : {}),
          updatedAt: new Date(),
        })
        .where(eq(zenProfiles.userId, user.id))
        .returning()

      return rowToProfile(updated[0])
    }

    const created = await getDatabaseClient()
      .insert(zenProfiles)
      .values({
        userId: user.id,
        loginId: user.loginId ?? null,
        email: user.email ?? null,
        displayName: user.loginId ?? user.email ?? null,
        role,
      })
      .onConflictDoUpdate({
        target: zenProfiles.userId,
        set: {
          loginId: user.loginId ?? null,
          email: user.email ?? null,
          role,
          updatedAt: new Date(),
        },
      })
      .returning()

    return rowToProfile(created[0])
  }

  async updateRole(userId: string, role: Role): Promise<Profile> {
    await neonUsersRepository.updateRole(userId, role)

    const rows = await getDatabaseClient()
      .insert(zenProfiles)
      .values({
        userId,
        role,
      })
      .onConflictDoUpdate({
        target: zenProfiles.userId,
        set: {
          role,
          updatedAt: new Date(),
        },
      })
      .returning()

    if (rows[0]) return rowToProfile(rows[0])

    const fallback = await getDatabaseClient()
      .select()
      .from(zenProfiles)
      .where(eq(zenProfiles.userId, userId))
      .limit(1)

    return rowToProfile(fallback[0])
  }
}

export const neonProfilesRepository = new NeonProfilesRepository()
