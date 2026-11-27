import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearAllDrafts,
  DraftStore,
  draftStorageKey,
  getDraftStore,
  MAX_DRAFT_CHARS,
  readDraft,
  writeDraft,
} from '@/lib/chat/draft-storage'
import {
  appendDraftText,
  prefillComposer,
  subscribeComposerPrefill,
  takeComposerPrefill,
} from '@/lib/chat/composer-prefill'

class FakeStorage implements DraftStore {
  data = new Map<string, string>()
  failWrites = false
  failReads = false

  get length() {
    return this.data.size
  }

  key(index: number) {
    return [...this.data.keys()][index] ?? null
  }

  getItem(key: string) {
    if (this.failReads) throw new Error('SecurityError')
    return this.data.get(key) ?? null
  }

  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error('QuotaExceededError')
    this.data.set(key, value)
  }

  removeItem(key: string) {
    if (this.failWrites) throw new Error('SecurityError')
    this.data.delete(key)
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  takeComposerPrefill()
})

describe('draft storage', () => {
  it('keys drafts by chat, with "new" for a chat that does not exist yet', () => {
    expect(draftStorageKey('abc')).toBe('zq-draft:abc')
    expect(draftStorageKey(null)).toBe('zq-draft:new')
    expect(draftStorageKey(undefined)).toBe('zq-draft:new')
    expect(draftStorageKey('')).toBe('zq-draft:new')
  })

  it('writes, reads and removes empty drafts', () => {
    const store = new FakeStorage()
    expect(writeDraft(store, 'zq-draft:a', 'hello')).toBe(true)
    expect(readDraft(store, 'zq-draft:a')).toBe('hello')
    expect(writeDraft(store, 'zq-draft:a', '   ')).toBe(true)
    expect(store.data.has('zq-draft:a')).toBe(false)
    expect(readDraft(store, 'zq-draft:missing')).toBe('')
  })

  it('caps drafts at 20k characters', () => {
    const store = new FakeStorage()
    writeDraft(store, 'zq-draft:a', 'x'.repeat(MAX_DRAFT_CHARS + 50))
    expect(store.data.get('zq-draft:a')).toHaveLength(MAX_DRAFT_CHARS)
    store.data.set('zq-draft:b', 'y'.repeat(MAX_DRAFT_CHARS + 1))
    expect(readDraft(store, 'zq-draft:b')).toHaveLength(MAX_DRAFT_CHARS)
  })

  it('degrades to no draft when storage fails', () => {
    const store = new FakeStorage()
    store.data.set('zq-draft:a', 'kept')
    store.failReads = true
    expect(readDraft(store, 'zq-draft:a')).toBe('')
    store.failWrites = true
    expect(writeDraft(store, 'zq-draft:a', 'new text')).toBe(false)
    expect(writeDraft(store, 'zq-draft:a', '')).toBe(false)
    expect(clearAllDrafts(store)).toBe(false)
  })

  it('works without storage at all', () => {
    expect(readDraft(null, 'zq-draft:a')).toBe('')
    expect(writeDraft(null, 'zq-draft:a', 'text')).toBe(false)
    expect(clearAllDrafts(null)).toBe(false)
    expect(getDraftStore()).toBeNull()
  })

  it('returns null when the browser blocks localStorage', () => {
    const blocked = {}
    Object.defineProperty(blocked, 'localStorage', {
      get() {
        throw new Error('SecurityError')
      },
    })
    vi.stubGlobal('window', blocked)
    expect(getDraftStore()).toBeNull()
  })

  it('clears only composer drafts', () => {
    const store = new FakeStorage()
    store.data.set('zq-draft:a', 'one')
    store.data.set('zq-draft:new', 'two')
    store.data.set('zenquanta:settings:v1', '{}')
    expect(clearAllDrafts(store)).toBe(true)
    expect([...store.data.keys()]).toEqual(['zenquanta:settings:v1'])
  })
})

describe('composer prefill', () => {
  it('appends to an existing draft', () => {
    expect(appendDraftText('', 'hi')).toBe('hi')
    expect(appendDraftText('  ', 'hi')).toBe('hi')
    expect(appendDraftText('draft  ', 'hi')).toBe('draft\n\nhi')
  })

  it('holds text until the composer takes it and tells listeners', () => {
    const target = new EventTarget()
    vi.stubGlobal('window', target)
    const listener = vi.fn()
    const unsubscribe = subscribeComposerPrefill(listener)

    prefillComposer('first')
    prefillComposer('  ')
    prefillComposer('second')
    expect(listener).toHaveBeenCalledTimes(2)
    expect(takeComposerPrefill()).toBe('first\n\nsecond')
    expect(takeComposerPrefill()).toBeNull()

    unsubscribe()
    prefillComposer('later')
    expect(listener).toHaveBeenCalledTimes(2)
    expect(takeComposerPrefill()).toBe('later')
  })

  it('does nothing on the server', () => {
    prefillComposer('text')
    expect(takeComposerPrefill()).toBeNull()
  })
})
