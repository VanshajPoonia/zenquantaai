import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getIdentity: vi.fn(),
  preview: vi.fn(),
  collectObjectRefs: vi.fn(),
  deleteDatabaseRows: vi.fn(),
  deleteObject: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db/repositories', () => ({
  neonUserPurgeRepository: {
    getIdentity: mocks.getIdentity,
    preview: mocks.preview,
    collectObjectRefs: mocks.collectObjectRefs,
    deleteDatabaseRows: mocks.deleteDatabaseRows,
  },
}))
vi.mock('@/lib/storage/object-store', () => ({
  getObjectStore: () => ({ deleteObject: mocks.deleteObject }),
}))

import {
  executeUserPurge,
  previewUserPurge,
  UserPurgeConfirmationError,
} from '@/lib/account/user-purge'
import { UserPurgePreview } from '@/types'

const preview: UserPurgePreview = {
  userId: 'user-a',
  scope: 'full_account',
  requiresConfirmation: 'alpha',
  counts: {
    conversations: 1,
    projects: 1,
    files: 2,
    generatedImages: 1,
    artifacts: 1,
    prompts: 1,
    playbooks: 2,
    customAssistants: 1,
    modelComparisons: 1,
    integrations: 2,
    usageAndPlanData: 3,
    telemetry: 2,
    sessions: 1,
    objectRefs: 2,
  },
  generatedAt: '2026-06-20T00:00:00.000Z',
  warnings: ['Deletion is irreversible.'],
}

describe('user purge orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getIdentity.mockResolvedValue({ id: 'user-a', loginId: 'alpha' })
    mocks.preview.mockResolvedValue(preview)
    mocks.collectObjectRefs.mockResolvedValue([
      { bucket: 'test-bucket', key: 'user-a/file.txt' },
      { bucket: 'test-bucket', key: 'user-a/image.png' },
    ])
    mocks.deleteDatabaseRows.mockResolvedValue(undefined)
    mocks.deleteObject.mockResolvedValue(undefined)
  })

  it('delegates previews with the exact target and actor scope', async () => {
    await expect(
      previewUserPurge({
        userId: 'user-a',
        scope: 'workspace_data',
        actor: 'admin',
      })
    ).resolves.toBe(preview)

    expect(mocks.preview).toHaveBeenCalledWith('user-a', 'workspace_data', {
      actor: 'admin',
    })
  })

  it('collects refs before database deletion and deletes objects afterward', async () => {
    const result = await executeUserPurge({
      userId: 'user-a',
      scope: 'full_account',
      confirmation: 'alpha',
      actor: 'user',
    })

    expect(mocks.collectObjectRefs).toHaveBeenCalledWith('user-a')
    expect(mocks.deleteDatabaseRows).toHaveBeenCalledWith('user-a', 'full_account')
    expect(mocks.deleteObject).toHaveBeenCalledTimes(2)
    expect(mocks.collectObjectRefs.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteDatabaseRows.mock.invocationCallOrder[0]
    )
    expect(mocks.deleteDatabaseRows.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.deleteObject.mock.invocationCallOrder[0]
    )
    expect(result).toMatchObject({
      userId: 'user-a',
      scope: 'full_account',
      objectDeletion: { attempted: 2, deleted: 2, failed: 0 },
      partialFailure: false,
      signedOut: true,
    })
  })

  it('reports partial storage failure with counts and no provider internals', async () => {
    mocks.deleteObject.mockImplementation(async ({ key }: { key: string }) => {
      if (key.endsWith('image.png')) {
        throw new Error(
          's3://private-bucket/user-a/image.png token=provider-secret rawCostUsd=9'
        )
      }
    })

    const result = await executeUserPurge({
      userId: 'user-a',
      scope: 'full_account',
      confirmation: 'alpha',
    })
    const serialized = JSON.stringify(result)

    expect(result.objectDeletion).toEqual({ attempted: 2, deleted: 1, failed: 1 })
    expect(result.partialFailure).toBe(true)
    expect(serialized).not.toContain('private-bucket')
    expect(serialized).not.toContain('provider-secret')
    expect(serialized).not.toContain('rawCostUsd')
    expect(mocks.deleteDatabaseRows).toHaveBeenCalledTimes(1)
  })

  it('does not collect or delete anything when confirmation fails', async () => {
    await expect(
      executeUserPurge({
        userId: 'user-a',
        scope: 'full_account',
        confirmation: 'wrong',
      })
    ).rejects.toBeInstanceOf(UserPurgeConfirmationError)

    expect(mocks.preview).not.toHaveBeenCalled()
    expect(mocks.collectObjectRefs).not.toHaveBeenCalled()
    expect(mocks.deleteDatabaseRows).not.toHaveBeenCalled()
    expect(mocks.deleteObject).not.toHaveBeenCalled()
  })
})
