import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/db/client', () => ({
  hasDatabaseConfig: () => false,
  getDatabaseRuntimeConfig: () => ({}),
  getNeonSql: vi.fn(),
}))

import { checkAgentLoopFlag, checkModelApiFlag, checkNodeVersion } from '@/lib/system-health/checks'

describe('launch health rows', () => {
  it('checks the Node version the agent loop needs', () => {
    expect(checkNodeVersion('24.11.0').status).toBe('healthy')
    expect(checkNodeVersion('22.19.0').status).toBe('healthy')
    expect(checkNodeVersion('22.18.1').status).toBe('degraded')
    expect(checkNodeVersion('20.11.0').status).toBe('degraded')
  })

  it('reports the launch flags', () => {
    expect(checkAgentLoopFlag('admins').message).toContain('admins only')
    expect(checkAgentLoopFlag('on').status).toBe('healthy')
    expect(checkAgentLoopFlag(undefined).status).toBe('degraded')
    expect(checkModelApiFlag('on').status).toBe('healthy')
    expect(checkModelApiFlag(undefined).message).toContain('Admin-only')
  })
})
