import { createHash } from 'node:crypto'

function roleOf(message: unknown): unknown {
  return message && typeof message === 'object' ? (message as { role?: unknown }).role : undefined
}

function lastUserIndex(messages: unknown[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (roleOf(messages[index]) === 'user') return index
  }
  return -1
}

/** Model requests already made in this run: the assistant turns after the last user message. */
export function stepsSinceLastUserMessage(messages: unknown[]): number {
  return messages.slice(lastUserIndex(messages) + 1).filter((message) => roleOf(message) === 'assistant').length
}

/**
 * The run a Model API request belongs to, derived on the server from the
 * conversation up to the last user message, so a client cannot start a fresh run at will.
 */
export function serverRunKey(userId: string, sessionId: string | null, messages: unknown[]): string {
  const last = lastUserIndex(messages)
  const prefix = last >= 0 ? messages.slice(0, last + 1) : messages
  const hash = createHash('sha256')
    .update(JSON.stringify([userId, sessionId ?? '', prefix]))
    .digest('hex')
  return `srv-${hash.slice(0, 40)}`
}
