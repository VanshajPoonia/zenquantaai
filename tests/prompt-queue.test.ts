import { describe, expect, it } from 'vitest'
import {
  createPromptQueue,
  isQueuePaused,
  nextQueuedPrompt,
  PromptQueueAction,
  PromptQueueState,
  queuedFor,
  queueKey,
  reducePromptQueue,
} from '@/lib/chat/prompt-queue'

type Item = { id: string; conversationId?: string; content: string }

function run(actions: PromptQueueAction<Item>[], state = createPromptQueue<Item>()) {
  return actions.reduce<PromptQueueState<Item>>(reducePromptQueue, state)
}

const a1 = { id: 'a1', conversationId: 'a', content: 'first' }
const a2 = { id: 'a2', conversationId: 'a', content: 'second' }
const a3 = { id: 'a3', conversationId: 'a', content: 'third' }
const b1 = { id: 'b1', conversationId: 'b', content: 'other chat' }

const queued = (...items: Item[]) =>
  items.map((item) => ({ type: 'enqueue', item }) as PromptQueueAction<Item>)

describe('prompt queue', () => {
  it('sends in order', () => {
    let state = run(queued(a1, a2))
    expect(nextQueuedPrompt(state)?.id).toBe('a1')
    state = reducePromptQueue(state, { type: 'dispatched', id: 'a1' })
    expect(nextQueuedPrompt(state)?.id).toBe('a2')
    state = reducePromptQueue(state, { type: 'dispatched', id: 'a2' })
    expect(nextQueuedPrompt(state)).toBeNull()
  })

  it('pauses on Stop instead of sending the next message', () => {
    const state = run([...queued(a1, a2), { type: 'stop', conversationId: 'a' }])
    expect(isQueuePaused(state, 'a')).toBe(true)
    expect(nextQueuedPrompt(state)).toBeNull()
    expect(state.items).toHaveLength(2)
  })

  it('does not pause when the stopped chat has nothing queued', () => {
    const state = run([...queued(b1), { type: 'stop', conversationId: 'a' }])
    expect(state.pausedKeys).toEqual([])
    expect(nextQueuedPrompt(state)?.id).toBe('b1')
  })

  it('keeps other chats moving while one is paused', () => {
    const state = run([...queued(a1, b1), { type: 'stop', conversationId: 'a' }])
    expect(nextQueuedPrompt(state)?.id).toBe('b1')
    expect(isQueuePaused(state, 'b')).toBe(false)
  })

  it('resumes where it stopped', () => {
    const state = run([
      ...queued(a1, a2),
      { type: 'stop', conversationId: 'a' },
      { type: 'resume', conversationId: 'a' },
    ])
    expect(isQueuePaused(state, 'a')).toBe(false)
    expect(nextQueuedPrompt(state)?.id).toBe('a1')
  })

  it('clears only the current chat', () => {
    const state = run([
      ...queued(a1, b1, a2),
      { type: 'stop', conversationId: 'a' },
      { type: 'clear', conversationId: 'a' },
    ])
    expect(state.items.map((item) => item.id)).toEqual(['b1'])
    expect(state.pausedKeys).toEqual([])
  })

  it('removes and edits single messages', () => {
    const state = run([...queued(a1, a2, a3), { type: 'remove', id: 'a2' }])
    expect(state.items.map((item) => item.id)).toEqual(['a1', 'a3'])
    expect(reducePromptQueue(state, { type: 'remove', id: 'missing' }).items).toHaveLength(2)
  })

  it('ends a pause once that queue is empty', () => {
    let state = run([...queued(a1), { type: 'stop', conversationId: 'a' }, { type: 'remove', id: 'a1' }])
    expect(state.pausedKeys).toEqual([])
    state = reducePromptQueue(state, { type: 'enqueue', item: a2 })
    expect(isQueuePaused(state, 'a')).toBe(false)
    expect(nextQueuedPrompt(state)?.id).toBe('a2')
  })

  it('sends one message now and leaves the rest paused', () => {
    let state = run([
      ...queued(a1, a2),
      { type: 'stop', conversationId: 'a' },
      { type: 'send-now', id: 'a2' },
    ])
    expect(nextQueuedPrompt(state)?.id).toBe('a2')
    state = reducePromptQueue(state, { type: 'dispatched', id: 'a2' })
    expect(state.forcedId).toBeNull()
    expect(nextQueuedPrompt(state)).toBeNull()
    expect(isQueuePaused(state, 'a')).toBe(true)
  })

  it('lets send now jump ahead of an unpaused queue', () => {
    const state = run([...queued(b1, a1, a2), { type: 'send-now', id: 'a2' }])
    expect(nextQueuedPrompt(state)?.id).toBe('a2')
  })

  it('ignores send now for a message that is gone', () => {
    const state = run([...queued(a1), { type: 'send-now', id: 'nope' }])
    expect(state.forcedId).toBeNull()
  })

  it('drops a pending send now when the message is removed or Stop is pressed', () => {
    const removed = run([...queued(a1, a2), { type: 'send-now', id: 'a2' }, { type: 'remove', id: 'a2' }])
    expect(removed.forcedId).toBeNull()
    const stopped = run([...queued(a1, a2), { type: 'send-now', id: 'a2' }, { type: 'stop', conversationId: 'a' }])
    expect(stopped.forcedId).toBeNull()
    expect(nextQueuedPrompt(stopped)).toBeNull()
  })

  it('treats a chat that does not exist yet as "new"', () => {
    const draft = { id: 'n1', content: 'from a new chat' }
    const state = run([...queued(draft), { type: 'stop', conversationId: null }])
    expect(queueKey(undefined)).toBe('new')
    expect(queuedFor(state, null).map((item) => item.id)).toEqual(['n1'])
    expect(isQueuePaused(state, undefined)).toBe(true)
  })

  it('stops twice without adding the pause twice', () => {
    const state = run([...queued(a1), { type: 'stop', conversationId: 'a' }, { type: 'stop', conversationId: 'a' }])
    expect(state.pausedKeys).toEqual(['a'])
  })

  it('resets everything', () => {
    const state = run([...queued(a1), { type: 'stop', conversationId: 'a' }, { type: 'reset' }])
    expect(state).toEqual(createPromptQueue())
  })
})
