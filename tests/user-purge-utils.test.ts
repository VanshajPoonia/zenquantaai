import { describe, expect, it } from 'vitest'
import {
  buildSafeUserPurgePreview,
  buildTombstoneUserPatch,
  expectedUserPurgeConfirmation,
  normalizeUserPurgeCounts,
  normalizeUserPurgeObjectRefs,
  parseUserPurgeScope,
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
    expect(
      validateUserPurgeConfirmation(' user-123 PURGE ', {
        actor: 'admin',
        scope: 'full_account',
        targetUserId: 'user-123',
      })
    ).toBe(true)
    expect(
      validateUserPurgeConfirmation(null, {
        actor: 'user',
        scope: 'full_account',
      })
    ).toBe(false)
    expect(
      expectedUserPurgeConfirmation({
        actor: 'user',
        scope: 'full_account',
        loginId: '   ',
      })
    ).toBe('DELETE ACCOUNT')
    expect(parseUserPurgeScope('full_account')).toBe('full_account')
    expect(parseUserPurgeScope('unexpected')).toBe('workspace_data')
  })

  it('deduplicates object refs and drops unsafe values', () => {
    expect(
      normalizeUserPurgeObjectRefs([
        { bucket: 'zenquanta-files', key: 'user/file.txt' },
        { bucket: 'zenquanta-files', key: 'user/file.txt' },
        { bucket: '../private', key: 'user/file.txt' },
        { bucket: 'zenquanta-files', key: '../file.txt' },
        { bucket: 'zenquanta-files', key: 'user//file.txt' },
        { bucket: 'zenquanta-files', key: '/user/file.txt' },
        { bucket: 'zenquanta-files', key: 'user\\file.txt' },
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
    expect(Object.keys(preview).sort()).toEqual(
      [
        'counts',
        'generatedAt',
        'requiresConfirmation',
        'scope',
        'userId',
        'warnings',
      ].sort()
    )
    expect(Object.keys(preview.counts).sort()).toEqual(
      [
        'artifacts',
        'conversations',
        'customAssistants',
        'files',
        'generatedImages',
        'integrations',
        'modelComparisons',
        'objectRefs',
        'playbooks',
        'projects',
        'prompts',
        'sessions',
        'telemetry',
        'usageAndPlanData',
      ].sort()
    )
    expect(JSON.stringify(preview)).not.toContain('storagePath')

    const sanitized = sanitizeUserPurgePreviewPayload({
      counts: preview.counts,
      bucket: 'zenquanta-files',
      key: 'private/file.txt',
      rawCostUsd: 2,
      raw_model_cost: 3,
      apiKey: 'api-key',
      providerToken: 'provider-token',
      clientSecret: 'client-secret',
      privateProviderUrl: 'https://private.example/provider',
      providerEndpoint: 'https://private.example/endpoint',
      connection_string: 'postgres://private',
      nested: {
        sourceUrl: 'https://private.example/file',
        PASSWORD_HASH: 'hash',
        safe: 'ok',
      },
    })

    expect(sanitized).toEqual({
      counts: preview.counts,
      nested: { safe: 'ok' },
    })
  })

  it('normalizes every preview count to a finite non-negative integer', () => {
    expect(
      normalizeUserPurgeCounts({
        conversations: 2.9,
        projects: -4,
        files: Number.POSITIVE_INFINITY,
      })
    ).toMatchObject({
      conversations: 2,
      projects: 0,
      files: 0,
      generatedImages: 0,
      telemetry: 0,
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
