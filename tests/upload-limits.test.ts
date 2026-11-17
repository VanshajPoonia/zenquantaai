import { describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  hitRateLimit: vi.fn(async () => false),
  uploadAttachmentBinary: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/session', () => ({
  appendAuthCookies: vi.fn(),
  requireAuthenticatedUser: vi.fn(async () => ({ user: { id: 'user-a' }, session: {} })),
}))
vi.mock('@/lib/security/rate-limit', () => ({ hitRateLimit: mocks.hitRateLimit }))
vi.mock('@/lib/db/repositories', () => ({ neonConversationRepository: {} }))
vi.mock('@/lib/security/ownership', () => ({ resolveOwnedProjectScope: vi.fn() }))
vi.mock('@/lib/security/user-scope', () => ({ conversationBelongsToProject: vi.fn() }))
vi.mock('@/lib/storage/attachments', () => ({ uploadAttachmentBinary: mocks.uploadAttachmentBinary }))

import { POST as upload } from '@/app/api/attachments/route'

describe('upload limits', () => {
  it('turns away a user who uploaded too much in the last hour', async () => {
    const response = await upload(
      new NextRequest('http://localhost/api/attachments', { method: 'POST', body: new FormData() })
    )

    expect(response?.status).toBe(429)
    expect(mocks.hitRateLimit).toHaveBeenCalledWith('uploads:user-a', 60, 3_600)
    expect(mocks.uploadAttachmentBinary).not.toHaveBeenCalled()
  })
})
