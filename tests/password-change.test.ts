import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

type PasswordRecord = {
  userId: string
  passwordHash: string
  passwordSalt: string
  passwordParams: Record<string, unknown>
}

const mocks = vi.hoisted(() => ({
  getCredentialByLoginId: vi.fn(),
  updateLocalPassword: vi.fn(async (record: unknown) => {
    void record
  }),
  revokeAllForUser: vi.fn(async () => undefined),
}))

// Selects with a join read the session, the rest read sign-in lockout rows.
const db = vi.hoisted(() => {
  const state = {
    sessionRows: [] as unknown[],
    attemptRows: [] as unknown[],
    inserts: 0,
  }

  function query(kind: 'select' | 'write'): object {
    let joined = false
    const proxy: object = new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === 'then') {
            const rows =
              kind === 'select' ? (joined ? state.sessionRows : state.attemptRows) : []
            return (resolve: (value: unknown) => void) => resolve(rows)
          }
          return () => {
            if (prop === 'innerJoin') joined = true
            return proxy
          }
        },
      }
    )
    return proxy
  }

  const client = {
    select: () => query('select'),
    insert: () => {
      state.inserts += 1
      return query('write')
    },
    update: () => query('write'),
    delete: () => query('write'),
  }

  return { state, client }
})

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db/client', () => ({ getDatabaseClient: () => db.client }))
vi.mock('@/lib/db/repositories', () => ({
  neonApiTokensRepository: { revokeAllForUser: mocks.revokeAllForUser },
  neonProfilesRepository: {},
  neonUsersRepository: {
    getCredentialByLoginId: mocks.getCredentialByLoginId,
    updateLocalPassword: mocks.updateLocalPassword,
  },
}))

import { POST } from '@/app/api/auth/password/update/route'
import { setUserPasswordByAdmin } from '@/lib/auth/session'

const user = { id: 'user-a', loginId: 'alice', email: null, role: 'user' }
let oldRecord: PasswordRecord

function useCredential(record: PasswordRecord) {
  mocks.getCredentialByLoginId.mockResolvedValue({
    user,
    passwordHash: record.passwordHash,
    passwordSalt: record.passwordSalt,
    passwordParams: record.passwordParams,
  })
}

function lastSavedRecord(): PasswordRecord {
  return mocks.updateLocalPassword.mock.calls.at(-1)?.[0] as PasswordRecord
}

function changePassword(body: unknown) {
  return POST(
    new NextRequest('http://localhost/api/auth/password/update', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        cookie: 'zenquanta-session-token=session-token',
        'x-forwarded-for': '203.0.113.7',
      },
    })
  )
}

describe('changing the password', () => {
  beforeAll(async () => {
    await setUserPasswordByAdmin(user.id, 'old-password-1')
    oldRecord = lastSavedRecord()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    db.state.sessionRows = [{ session: { id: 'session-1' }, user, profile: null }]
    db.state.attemptRows = []
    db.state.inserts = 0
    useCredential(oldRecord)
  })

  it('requires the current password', async () => {
    const response = await changePassword({ password: 'new-password-1' })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Enter your current password.' })
    expect(mocks.updateLocalPassword).not.toHaveBeenCalled()
  })

  it('refuses a wrong current password and counts the failure', async () => {
    const response = await changePassword({
      currentPassword: 'not-my-password',
      password: 'new-password-1',
    })

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      error: 'Your current password is not correct.',
    })
    expect(mocks.updateLocalPassword).not.toHaveBeenCalled()
    expect(mocks.revokeAllForUser).not.toHaveBeenCalled()
    expect(db.state.inserts).toBeGreaterThan(0)
  })

  it('stops checking once sign-in is locked for the account', async () => {
    db.state.attemptRows = [{ lockedUntil: new Date(Date.now() + 60_000) }]

    const response = await changePassword({
      currentPassword: 'old-password-1',
      password: 'new-password-1',
    })

    expect(response.status).toBe(429)
    expect(mocks.getCredentialByLoginId).not.toHaveBeenCalled()
    expect(mocks.updateLocalPassword).not.toHaveBeenCalled()
  })

  it('saves the new password and signs out zq when the current one is right', async () => {
    const response = await changePassword({
      currentPassword: 'old-password-1',
      password: 'new-password-1',
    })

    expect(response.status).toBe(200)
    expect(lastSavedRecord().userId).toBe(user.id)
    expect(lastSavedRecord().passwordHash).not.toBe(oldRecord.passwordHash)
    expect(mocks.revokeAllForUser).toHaveBeenCalledWith(user.id)

    // The saved hash must match the new password, and the old one must stop working.
    useCredential(lastSavedRecord())
    const withOld = await changePassword({
      currentPassword: 'old-password-1',
      password: 'third-password-1',
    })
    expect(withOld.status).toBe(403)

    const withNew = await changePassword({
      currentPassword: 'new-password-1',
      password: 'third-password-1',
    })
    expect(withNew.status).toBe(200)
  })
})
