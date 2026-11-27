// Messages typed while a reply streams wait here. Each chat's queue can be
// paused on its own, and "send now" lets one message jump the line.

export interface QueueEntry {
  id: string
  conversationId?: string
}

export interface PromptQueueState<T extends QueueEntry> {
  items: T[]
  pausedKeys: string[]
  forcedId: string | null
}

export type PromptQueueAction<T extends QueueEntry> =
  | { type: 'enqueue'; item: T }
  | { type: 'remove'; id: string }
  | { type: 'dispatched'; id: string }
  | { type: 'stop'; conversationId?: string | null }
  | { type: 'resume'; conversationId?: string | null }
  | { type: 'clear'; conversationId?: string | null }
  | { type: 'send-now'; id: string }
  | { type: 'reset' }

export function createPromptQueue<T extends QueueEntry>(): PromptQueueState<T> {
  return { items: [], pausedKeys: [], forcedId: null }
}

export function queueKey(conversationId?: string | null): string {
  return conversationId || 'new'
}

export function queuedFor<T extends QueueEntry>(
  state: PromptQueueState<T>,
  conversationId?: string | null
): T[] {
  const key = queueKey(conversationId)
  return state.items.filter((item) => queueKey(item.conversationId) === key)
}

export function isQueuePaused<T extends QueueEntry>(
  state: PromptQueueState<T>,
  conversationId?: string | null
): boolean {
  return (
    state.pausedKeys.includes(queueKey(conversationId)) &&
    queuedFor(state, conversationId).length > 0
  )
}

export function nextQueuedPrompt<T extends QueueEntry>(state: PromptQueueState<T>): T | null {
  if (state.forcedId) {
    const forced = state.items.find((item) => item.id === state.forcedId)
    if (forced) return forced
  }
  return (
    state.items.find((item) => !state.pausedKeys.includes(queueKey(item.conversationId))) ??
    null
  )
}

// A pause lasts only while that chat still has queued messages.
function prune<T extends QueueEntry>(state: PromptQueueState<T>): PromptQueueState<T> {
  const keys = new Set(state.items.map((item) => queueKey(item.conversationId)))
  const pausedKeys = state.pausedKeys.filter((key) => keys.has(key))
  const forcedId =
    state.forcedId && state.items.some((item) => item.id === state.forcedId)
      ? state.forcedId
      : null
  return { items: state.items, pausedKeys, forcedId }
}

export function reducePromptQueue<T extends QueueEntry>(
  state: PromptQueueState<T>,
  action: PromptQueueAction<T>
): PromptQueueState<T> {
  switch (action.type) {
    case 'enqueue':
      return { ...state, items: [...state.items, action.item] }
    case 'remove':
      return prune({ ...state, items: state.items.filter((item) => item.id !== action.id) })
    case 'dispatched':
      return prune({
        ...state,
        items: state.items.filter((item) => item.id !== action.id),
        forcedId: state.forcedId === action.id ? null : state.forcedId,
      })
    case 'stop': {
      const key = queueKey(action.conversationId)
      const hasItems = queuedFor(state, action.conversationId).length > 0
      if (!hasItems || state.pausedKeys.includes(key)) return { ...state, forcedId: null }
      return { ...state, pausedKeys: [...state.pausedKeys, key], forcedId: null }
    }
    case 'resume': {
      const key = queueKey(action.conversationId)
      return { ...state, pausedKeys: state.pausedKeys.filter((item) => item !== key) }
    }
    case 'clear': {
      const key = queueKey(action.conversationId)
      return prune({
        ...state,
        items: state.items.filter((item) => queueKey(item.conversationId) !== key),
      })
    }
    case 'send-now':
      return state.items.some((item) => item.id === action.id)
        ? { ...state, forcedId: action.id }
        : state
    case 'reset':
      return createPromptQueue<T>()
  }
}
