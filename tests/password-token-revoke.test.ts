import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  updateLocalPassword: vi.fn(async () => undefined),
  revokeAllForUser: vi.fn(async () => undefined),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db/client', () => {
  const chain = {
    update: () => chain,
    set: () => chain,
    where: async () => [],
  }
  return { getDatabaseClient: () => chain }
})
vi.mock('@/lib/db/repositories', () => ({
  neonApiTokensRepository: { revokeAllForUser: mocks.revokeAllForUser },
  neonProfilesRepository: {},
  neonUsersRepository: { updateLocalPassword: mocks.updateLocalPassword },
}))

import { setUserPasswordByAdmin } from '@/lib/auth/session'

describe('password reset', () => {
  it('revokes the user zq tokens along with their sessions', async () => {
    await setUserPasswordByAdmin('user-a', 'a-new-password')

    expect(mocks.updateLocalPassword).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-a' })
    )
    expect(mocks.revokeAllForUser).toHaveBeenCalledWith('user-a')
  })
})
