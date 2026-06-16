import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GitHubIntegrationAccount } from '@/types'

vi.mock('server-only', () => ({}))

import {
  buildGitHubStatus,
  toClientGitHubIntegrationAccount,
} from '@/lib/integrations/github'

const ENV_KEYS = [
  'GITHUB_APP_ID',
  'GITHUB_APP_CLIENT_ID',
  'GITHUB_APP_PRIVATE_KEY',
  'GITHUB_APP_CALLBACK_URL',
] as const

function buildAccount(): GitHubIntegrationAccount {
  return {
    id: 'account_internal_id',
    provider: 'github',
    externalAccountId: 'provider_internal_account_id',
    externalAccountLogin: 'zenquanta-labs',
    externalAccountName: 'Zenquanta Labs',
    installationId: 'installation_internal_id',
    scopes: ['metadata:read', 'contents:read'],
    status: 'connected',
    connectedAt: '2026-06-16T00:00:00.000Z',
    revokedAt: null,
    syncState: {
      setupAction: 'install',
      privateProviderDetail: 'do-not-send',
    },
    createdAt: '2026-06-16T00:00:00.000Z',
    updatedAt: '2026-06-16T00:00:00.000Z',
  }
}

describe('GitHub integration client status', () => {
  const previousEnv = new Map<string, string | undefined>()

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      previousEnv.set(key, process.env[key])
    }

    process.env.GITHUB_APP_ID = '123'
    process.env.GITHUB_APP_CLIENT_ID = 'client_id'
    process.env.GITHUB_APP_PRIVATE_KEY = 'private_key'
    process.env.GITHUB_APP_CALLBACK_URL = 'https://example.test/callback'
  })

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const previous = previousEnv.get(key)
      if (typeof previous === 'undefined') {
        delete process.env[key]
      } else {
        process.env[key] = previous
      }
    }
    previousEnv.clear()
  })

  it('omits provider internals from client-safe account JSON', () => {
    const clientAccount = toClientGitHubIntegrationAccount(buildAccount())
    const serialized = JSON.stringify(clientAccount)

    expect(clientAccount).toEqual({
      provider: 'github',
      externalAccountLogin: 'zenquanta-labs',
      externalAccountName: 'Zenquanta Labs',
      scopes: ['metadata:read', 'contents:read'],
      status: 'connected',
      connectedAt: '2026-06-16T00:00:00.000Z',
      revokedAt: null,
      createdAt: '2026-06-16T00:00:00.000Z',
      updatedAt: '2026-06-16T00:00:00.000Z',
    })
    expect(serialized).not.toContain('installation_internal_id')
    expect(serialized).not.toContain('provider_internal_account_id')
    expect(serialized).not.toContain('account_internal_id')
    expect(serialized).not.toContain('syncState')
    expect(serialized).not.toContain('privateProviderDetail')
  })

  it('builds GitHub status without installation or sync metadata', () => {
    const status = buildGitHubStatus({ account: buildAccount() })
    const serialized = JSON.stringify(status)

    expect(status.configured).toBe(true)
    expect(status.connected).toBe(true)
    expect(status.connectUrl).toBe('/api/integrations/github/connect')
    expect(status.account?.externalAccountLogin).toBe('zenquanta-labs')
    expect(serialized).not.toContain('installationId')
    expect(serialized).not.toContain('installation_internal_id')
    expect(serialized).not.toContain('syncState')
    expect(serialized).not.toContain('private_key')
  })
})
