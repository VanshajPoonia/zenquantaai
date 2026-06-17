import { describe, expect, it } from 'vitest'
import {
  buildSafeUserPurgePreview,
  buildTombstoneUserPatch,
  expectedUserPurgeConfirmation,
  normalizeUserPurgeObjectRefs,
  sanitizeUserPurgePreviewPayload,
  USER_PURGE_DELETION_ORDER,
  validateUserPurgeConfirmation,
} from '@/lib/account/user-purge-utils'

describe('user purge helpers', () => {
  it('validates user and admin confirmation phrases', () => {
    expect(
      expectedUserPurgeConfirmation({
        actor: 'user',
        scope: 'workspace_data',
        loginId: 'van',
      })
    ).toBe('DELETE DATA')
    expect(
      expectedUserPurgeConfirmation({
        actor: 'user',
        scope: 'full_account',
        loginId: 'van',
      })
    ).toBe('van')
    expect(
      expectedUserPurgeConfirmation({
        actor: 'admin',
        scope: 'full_account',
        targetUserId: 'user-123',
      })
    ).toBe('user-123 PURGE')

    expect(
      validateUserPurgeConfirmation('DELETE DATA', {
        actor: 'user',
        scope: 'workspace_data',
      })
    ).toBe(true)
    expect(
      validateUserPurgeConfirmation('delete data', {
        actor: 'user',
        scope: 'workspace_data',
      })
    ).toBe(false)
  })

  it('deduplicates object refs and drops unsafe values', () => {
    expect(
      normalizeUserPurgeObjectRefs([
        { bucket: 'zenquanta-files', key: 'user/file.txt' },
        { bucket: 'zenquanta-files', key: 'user/file.txt' },
        { bucket: '../private', key: 'user/file.txt' },
        { bucket: 'zenquanta-files', key: '../file.txt' },
        { bucket: 'zenquanta-files', key: 'user//file.txt' },
        { bucket: null, key: 'user/file.txt' },
      ])
    ).toEqual([{ bucket: 'zenquanta-files', key: 'user/file.txt' }])
  })

  it('builds client-safe previews without secret object fields', () => {
    const preview = buildSafeUserPurgePreview({
      userId: 'user-123',
      scope: 'full_account',
      loginId: 'van',
      counts: {
        conversations: 2,
        objectRefs: 3,
        files: Number.NaN,
      },
      generatedAt: '2026-06-17T00:00:00.000Z',
    })

    expect(preview).toMatchObject({
      userId: 'user-123',
      scope: 'full_account',
      requiresConfirmation: 'van',
      counts: {
        conversations: 2,
        files: 0,
        objectRefs: 3,
      },
    })
    expect(JSON.stringify(preview)).not.toContain('storagePath')

    const sanitized = sanitizeUserPurgePreviewPayload({
      counts: preview.counts,
      bucket: 'zenquanta-files',
      key: 'private/file.txt',
      rawCostUsd: 2,
      nested: {
        sourceUrl: 'https://private.example/file',
        safe: 'ok',
      },
    })

    expect(sanitized).toEqual({
      counts: preview.counts,
      nested: { safe: 'ok' },
    })
  })

  it('keeps deletion order safe around object storage', () => {
    expect(USER_PURGE_DELETION_ORDER.indexOf('collect_object_refs')).toBeLessThan(
      USER_PURGE_DELETION_ORDER.indexOf('delete_database_rows')
    )
    expect(USER_PURGE_DELETION_ORDER.indexOf('delete_database_rows')).toBeLessThan(
      USER_PURGE_DELETION_ORDER.indexOf('delete_object_storage')
    )
  })

  it('builds a tombstone patch without account identifiers', () => {
    const patch = buildTombstoneUserPatch()
    expect(patch).toMatchObject({
      externalAuthProvider: null,
      externalAuthUserId: null,
      loginId: null,
      email: null,
      displayName: null,
      role: 'user',
    })
  })
})
