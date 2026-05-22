import { AuthUser, Profile, Role } from '@/types'
import { neonQuery } from './neon'

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

class ProfilesStore {
  async list(): Promise<Profile[]> {
    const rows = await neonQuery<ProfileRow>(
      'select * from public.zen_profiles order by updated_at desc'
    )

    return rows.map(rowToProfile)
  }

  async get(userId: string): Promise<Profile | null> {
    const rows = await neonQuery<ProfileRow>(
      'select * from public.zen_profiles where user_id = $1',
      [userId]
    )

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

      const updated = await neonQuery<ProfileRow>(
        `
          update public.zen_profiles
          set login_id = $2,
              email = $3,
              role = coalesce($4, role)
          where user_id = $1
          returning *
        `,
        [user.id, user.loginId ?? null, user.email ?? null, forcedAdminRole ?? null]
      )

      return rowToProfile(updated[0])
    }

    const created = await neonQuery<ProfileRow>(
      `
        insert into public.zen_profiles (user_id, login_id, email, role)
        values ($1, $2, $3, $4)
        on conflict (user_id) do update
        set login_id = excluded.login_id,
            email = excluded.email,
            role = excluded.role
        returning *
      `,
      [user.id, user.loginId ?? null, user.email ?? null, forcedAdminRole ?? 'user']
    )

    return rowToProfile(created[0])
  }

  async updateRole(userId: string, role: Role): Promise<Profile> {
    const rows = await neonQuery<ProfileRow>(
      `
        update public.zen_profiles
        set role = $2
        where user_id = $1
        returning *
      `,
      [userId, role]
    )

    return rowToProfile(rows[0])
  }
}

export const profilesStore = new ProfilesStore()
