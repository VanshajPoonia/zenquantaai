// Unsent composer text, saved per chat in this browser only.

export const DRAFT_KEY_PREFIX = 'zq-draft:'
export const NEW_CHAT_DRAFT_ID = 'new'
export const MAX_DRAFT_CHARS = 20_000

export type DraftStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>

export function draftStorageKey(conversationId?: string | null): string {
  return `${DRAFT_KEY_PREFIX}${conversationId || NEW_CHAT_DRAFT_ID}`
}

// Reading localStorage throws when the browser blocks site data.
export function getDraftStore(): DraftStore | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function readDraft(store: DraftStore | null, key: string): string {
  if (!store) return ''
  try {
    return (store.getItem(key) ?? '').slice(0, MAX_DRAFT_CHARS)
  } catch {
    return ''
  }
}

// Returns false when the browser refuses the write, for example when storage is full.
export function writeDraft(store: DraftStore | null, key: string, text: string): boolean {
  if (!store) return false
  try {
    if (text.trim()) {
      store.setItem(key, text.slice(0, MAX_DRAFT_CHARS))
    } else {
      store.removeItem(key)
    }
    return true
  } catch {
    return false
  }
}

export function clearAllDrafts(store: DraftStore | null): boolean {
  if (!store) return false
  try {
    const keys: string[] = []
    for (let index = 0; index < store.length; index += 1) {
      const key = store.key(index)
      if (key?.startsWith(DRAFT_KEY_PREFIX)) keys.push(key)
    }
    keys.forEach((key) => store.removeItem(key))
    return true
  } catch {
    return false
  }
}
