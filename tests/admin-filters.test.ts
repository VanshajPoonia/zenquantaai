import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { matchesSurfaceFilter, normalizeAdminAnalyticsFilters } from '@/lib/db/repositories/admin'

describe('admin surface filter', () => {
  it('accepts web or zq and ignores anything else', () => {
    expect(normalizeAdminAnalyticsFilters({ surface: 'cli' }).surface).toBe('cli')
    expect(normalizeAdminAnalyticsFilters({ surface: 'web' }).surface).toBe('web')
    expect(normalizeAdminAnalyticsFilters({ surface: 'mobile' }).surface).toBeNull()
    expect(normalizeAdminAnalyticsFilters().surface).toBeNull()
  })

  it('treats events without a surface as web', () => {
    expect(matchesSurfaceFilter(undefined, 'web')).toBe(true)
    expect(matchesSurfaceFilter(undefined, 'cli')).toBe(false)
    expect(matchesSurfaceFilter('cli', 'cli')).toBe(true)
    expect(matchesSurfaceFilter('cli', null)).toBe(true)
  })
})
