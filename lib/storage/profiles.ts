import { AuthUser, Profile, Role } from '@/types'
import { supabaseRequest } from './supabase'

const PROFILES_TABLE = 'zen_profiles'

type ProfileRow = {
  user_id: string
  login_id: string | null
  email: string | null
  role: Role
  created_at: string
  updated_at: string
}

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
    loginId: row.login_id,
    email: row.email,
  })
    ? 'admin'
    : row.role

  return {
    userId: row.user_id,
    loginId: row.login_id,
    email: row.email,
    role: forcedRole,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function profileToRow(profile: Partial<Profile> & Pick<Profile, 'userId'>): Partial<ProfileRow> {
  return {
    user_id: profile.userId,
    ...(typeof profile.loginId !== 'undefined' ? { login_id: profile.loginId } : {}),
    ...(typeof profile.email !== 'undefined' ? { email: profile.email } : {}),
    ...(typeof profile.role !== 'undefined' ? { role: profile.role } : {}),
  }
}

class ProfilesStore {
  async list(): Promise<Profile[]> {
    const rows = await supabaseRequest<ProfileRow[]>(PROFILES_TABLE, {
      query: {
        select: '*',
        order: 'updated_at.desc',
      },
    })

    return rows.map(rowToProfile)
  }

  async get(userId: string): Promise<Profile | null> {
    const rows = await supabaseRequest<ProfileRow[]>(PROFILES_TABLE, {
      query: {
        user_id: `eq.${userId}`,
        select: '*',
      },
    })

    return rows[0] ? rowToProfile(rows[0]) : null
  }

  async ensureFromAuthUser(user: AuthUser): Promise<Profile> {
    const existing = await this.get(user.id)
    const forcedAdminRole: Role | undefined = isHardcodedAdminIdentity(user)
      ? 'admin'
      : undefined

    if (existing) {
      const needsUpdate =
        existing.loginId !== (user.loginId ?? null) ||
        existing.email !== (user.email ?? null) ||
        (forcedAdminRole === 'admin' && existing.role !== 'admin')

      if (!needsUpdate) return existing

      const updated = await supabaseRequest<ProfileRow[]>(PROFILES_TABLE, {
        method: 'PATCH',
        query: {
          user_id: `eq.${user.id}`,
        },
        body: profileToRow({
          userId: user.id,
          loginId: user.loginId ?? null,
          email: user.email ?? null,
          role: forcedAdminRole,
        }),
        prefer: 'return=representation',
      })

      return rowToProfile(updated[0])
    }

    const created = await supabaseRequest<ProfileRow[]>(PROFILES_TABLE, {
      method: 'POST',
      body: {
        user_id: user.id,
        login_id: user.loginId ?? null,
        email: user.email ?? null,
        role: forcedAdminRole ?? 'user',
      },
      prefer: 'resolution=merge-duplicates,return=representation',
    })

    return rowToProfile(created[0])
  }

  async updateRole(userId: string, role: Role): Promise<Profile> {
    const rows = await supabaseRequest<ProfileRow[]>(PROFILES_TABLE, {
      method: 'PATCH',
      query: {
        user_id: `eq.${userId}`,
      },
      body: {
        role,
      },
      prefer: 'return=representation',
    })

    return rowToProfile(rows[0])
  }
}

export const profilesStore = new ProfilesStore()
