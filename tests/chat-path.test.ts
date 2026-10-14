import { describe, expect, it } from 'vitest'
import { getChatIdFromPath, getChatPath, isWorkspacePath } from '@/lib/utils/chat-path'

describe('chat paths', () => {
  it('round-trips a chat id', () => {
    expect(getChatIdFromPath(getChatPath('abc-123'))).toBe('abc-123')
    expect(getChatIdFromPath(getChatPath('a b/c'))).toBe('a b/c')
  })

  it('accepts a trailing slash', () => {
    expect(getChatIdFromPath('/c/abc/')).toBe('abc')
  })

  it('ignores other paths', () => {
    expect(getChatIdFromPath('/')).toBeNull()
    expect(getChatIdFromPath('/c')).toBeNull()
    expect(getChatIdFromPath('/c/abc/extra')).toBeNull()
    expect(getChatIdFromPath('/dashboard')).toBeNull()
  })

  it('rejects malformed escapes', () => {
    expect(getChatIdFromPath('/c/%E0%A4%A')).toBeNull()
  })

  it('tells the workspace apart from pages', () => {
    expect(isWorkspacePath('/')).toBe(true)
    expect(isWorkspacePath('/c/abc')).toBe(true)
    expect(isWorkspacePath('/dashboard')).toBe(false)
    expect(isWorkspacePath('/knowledge')).toBe(false)
    expect(isWorkspacePath('/c')).toBe(false)
  })
})
