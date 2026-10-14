import { describe, expect, it } from 'vitest'
import { hasSessionHint, sessionHintCookie, SESSION_HINT_COOKIE } from '@/lib/utils/session-hint'

describe('session hint cookie', () => {
  it('finds the hint among other cookies', () => {
    expect(hasSessionHint(`a=1; ${SESSION_HINT_COOKIE}=1; b=2`)).toBe(true)
    expect(hasSessionHint(`${SESSION_HINT_COOKIE}=1`)).toBe(true)
  })

  it('ignores a missing, cleared or look-alike hint', () => {
    expect(hasSessionHint('')).toBe(false)
    expect(hasSessionHint(`${SESSION_HINT_COOKIE}=`)).toBe(false)
    expect(hasSessionHint(`x${SESSION_HINT_COOKIE}=1`)).toBe(false)
  })

  it('sets for a year and clears immediately', () => {
    expect(sessionHintCookie(true, false)).toBe(`${SESSION_HINT_COOKIE}=1; Path=/; SameSite=Lax; Max-Age=31536000`)
    expect(sessionHintCookie(false, true)).toBe(`${SESSION_HINT_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0; Secure`)
  })
})
