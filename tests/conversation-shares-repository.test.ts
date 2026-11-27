import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ rows: [] as unknown[], where: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db/client', () => {
  const chain = {
    select: () => chain,
    from: () => chain,
    where: (condition: unknown) => {
      db.where(condition)
      return chain
    },
    limit: async () => db.rows,
  }
  return { getDatabaseClient: () => chain }
})

import {
  createConversationShareToken,
  neonConversationSharesRepository,
} from '@/lib/db/repositories/conversation-shares'

const snapshot = { version: 1, title: 'Trip plan', mode: 'general', surface: 'web', messages: [] }

describe('conversation shares repository', () => {
  beforeEach(() => {
    db.rows = []
    db.where.mockClear()
  })

  it('makes long random url-safe tokens', () => {
    const token = createConversationShareToken()
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(createConversationShareToken()).not.toBe(token)
  })

  it('reads a live link by its token', async () => {
    db.rows = [{ snapshot, createdAt: new Date('2026-11-28T10:00:00.000Z'), revokedAt: null }]

    expect(await neonConversationSharesRepository.getPublicByToken('T'.repeat(43))).toEqual({
      createdAt: '2026-11-28T10:00:00.000Z',
      snapshot,
    })
  })

  it('treats revoked and unknown links as missing', async () => {
    db.rows = [{ snapshot, createdAt: new Date(), revokedAt: new Date() }]
    expect(await neonConversationSharesRepository.getPublicByToken('T'.repeat(43))).toBeNull()

    db.rows = []
    expect(await neonConversationSharesRepository.getPublicByToken('U'.repeat(43))).toBeNull()
  })
})
