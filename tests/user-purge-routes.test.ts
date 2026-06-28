import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  appendAuthCookies: vi.fn(),
  appendClearedAuthCookies: vi.fn(),
  requireAdminApiUser: vi.fn(),
  ensureFromAuthUser: vi.fn(),
  createAuditLog: vi.fn(),
  previewUserPurge: vi.fn(),
  executeUserPurge: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/session', () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
  appendAuthCookies: mocks.appendAuthCookies,
  appendClearedAuthCookies: mocks.appendClearedAuthCookies,
}))
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdminApiUser: mocks.requireAdminApiUser,
}))
vi.mock('@/lib/db/repositories', () => ({
  neonProfilesRepository: { ensureFromAuthUser: mocks.ensureFromAuthUser },
  neonAdminAuditLogsRepository: { create: mocks.createAuditLog },
}))
vi.mock('@/lib/account/user-purge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/account/user-purge')>()
  return {
    ...actual,
    previewUserPurge: mocks.previewUserPurge,
    executeUserPurge: mocks.executeUserPurge,
  }
})

import { POST as previewOwnData } from '@/app/api/account/delete-data/preview/route'
import { POST as deleteOwnData } from '@/app/api/account/delete-data/route'
import { POST as previewAdminPurge } from '@/app/api/admin/users/[id]/purge/preview/route'
import { POST as executeAdminPurge } from '@/app/api/admin/users/[id]/purge/route'

const userAuth = {
  user: { id: 'user-a', loginId: 'alpha', email: null, role: 'user' },
  session: { refreshed: false },
}
const adminAuth = {
  user: { id: 'admin-a', loginId: 'admin', email: null, role: 'admin' },
  profile: { role: 'admin' },
  session: { refreshed: false },
}
const counts = {
  conversations: 0,
  projects: 0,
  files: 0,
  generatedImages: 0,
  artifacts: 0,
  prompts: 0,
  playbooks: 0,
  customAssistants: 0,
  modelComparisons: 0,
  integrations: 0,
  usageAndPlanData: 0,
  telemetry: 0,
  sessions: 1,
  objectRefs: 0,
}

function postRequest(path: string, body: Record<string, unknown>) {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function requireRouteResponse(response: Response | undefined): Response {
  if (!response) throw new Error('Route did not return a response.')
  return response
}

describe('user purge routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuthenticatedUser.mockResolvedValue(userAuth)
    mocks.requireAdminApiUser.mockResolvedValue(adminAuth)
    mocks.ensureFromAuthUser.mockResolvedValue({ role: 'user' })
    mocks.createAuditLog.mockResolvedValue(undefined)
    mocks.previewUserPurge.mockResolvedValue({
      userId: 'user-a',
      scope: 'workspace_data',
      requiresConfirmation: 'DELETE DATA',
      counts,
      generatedAt: '2026-06-20T00:00:00.000Z',
      warnings: [],
    })
    mocks.executeUserPurge.mockResolvedValue({
      userId: 'user-a',
      scope: 'workspace_data',
      deletedAt: '2026-06-20T00:00:00.000Z',
      counts,
      objectDeletion: { attempted: 0, deleted: 0, failed: 0 },
      partialFailure: false,
      signedOut: false,
    })
  })

  it('derives self-service preview scope from the session, not a guessed body id', async () => {
    const response = requireRouteResponse(await previewOwnData(
      postRequest('/api/account/delete-data/preview', {
        scope: 'workspace_data',
        userId: 'user-b',
        targetUserId: 'user-b',
      })
    ))

    expect(response.status).toBe(200)
    expect(mocks.previewUserPurge).toHaveBeenCalledWith({
      userId: 'user-a',
      scope: 'workspace_data',
      actor: 'user',
    })
  })

  it('derives self-service deletion from the session and clears cookies for full accounts', async () => {
    mocks.executeUserPurge.mockResolvedValueOnce({
      userId: 'user-a',
      scope: 'full_account',
      deletedAt: '2026-06-20T00:00:00.000Z',
      counts,
      objectDeletion: { attempted: 0, deleted: 0, failed: 0 },
      partialFailure: false,
      signedOut: true,
    })

    const response = requireRouteResponse(await deleteOwnData(
      postRequest('/api/account/delete-data', {
        scope: 'full_account',
        confirmation: 'alpha',
        userId: 'user-b',
      })
    ))

    expect(mocks.executeUserPurge).toHaveBeenCalledWith({
      userId: 'user-a',
      scope: 'full_account',
      confirmation: 'alpha',
      actor: 'user',
    })
    expect(mocks.appendClearedAuthCookies).toHaveBeenCalledTimes(1)
    await expect(response.json()).resolves.toMatchObject({
      redirectTo: '/?accountDeleted=1',
      result: { signedOut: true },
    })
  })

  it('returns the admin guard response before previewing another user', async () => {
    mocks.requireAdminApiUser.mockResolvedValueOnce({
      response: NextResponse.json({ error: 'Admin access is required.' }, { status: 403 }),
    })

    const response = requireRouteResponse(await previewAdminPurge(
      postRequest('/api/admin/users/user-b/purge/preview', {}),
      { params: Promise.resolve({ id: 'user-b' }) }
    ))

    expect(response.status).toBe(403)
    expect(mocks.previewUserPurge).not.toHaveBeenCalled()
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })

  it('blocks an admin from purging their own account', async () => {
    const response = requireRouteResponse(await executeAdminPurge(
      postRequest('/api/admin/users/admin-a/purge', {
        scope: 'full_account',
        confirmation: 'admin-a PURGE',
      }),
      { params: Promise.resolve({ id: 'admin-a' }) }
    ))

    expect(response.status).toBe(400)
    expect(mocks.executeUserPurge).not.toHaveBeenCalled()
  })

  it('uses the protected path target for admin purge and records safe audit data', async () => {
    mocks.executeUserPurge.mockResolvedValueOnce({
      userId: 'user-b',
      scope: 'full_account',
      deletedAt: '2026-06-20T00:00:00.000Z',
      counts,
      objectDeletion: { attempted: 2, deleted: 1, failed: 1 },
      partialFailure: true,
      signedOut: true,
    })

    const response = requireRouteResponse(await executeAdminPurge(
      postRequest('/api/admin/users/user-b/purge', {
        scope: 'full_account',
        confirmation: 'user-b PURGE',
        userId: 'user-c',
      }),
      { params: Promise.resolve({ id: 'user-b' }) }
    ))

    expect(response.status).toBe(200)
    expect(mocks.executeUserPurge).toHaveBeenCalledWith({
      userId: 'user-b',
      scope: 'full_account',
      confirmation: 'user-b PURGE',
      actor: 'admin',
    })
    expect(mocks.createAuditLog).toHaveBeenCalledWith({
      adminUserId: 'admin-a',
      targetUserId: 'user-b',
      action: 'admin_user_purged',
      details: {
        scope: 'full_account',
        counts,
        objectDeletion: { attempted: 2, deleted: 1, failed: 1 },
        partialFailure: true,
      },
    })
    const serialized = JSON.stringify(await response.json())
    expect(serialized).not.toContain('bucket')
    expect(serialized).not.toContain('storagePath')
    expect(serialized).not.toContain('providerToken')
  })
})
