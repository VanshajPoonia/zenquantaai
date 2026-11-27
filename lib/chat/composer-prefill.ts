// Puts text in the composer from anywhere in the client, even before it mounts.
// The composer appends it to any draft that is already there.

const PREFILL_EVENT = 'zq:composer-prefill'
let pendingPrefill: string | null = null

export function prefillComposer(text: string): void {
  if (typeof window === 'undefined' || !text.trim()) return
  pendingPrefill = pendingPrefill ? `${pendingPrefill}\n\n${text}` : text
  window.dispatchEvent(new Event(PREFILL_EVENT))
}

export function takeComposerPrefill(): string | null {
  const text = pendingPrefill
  pendingPrefill = null
  return text
}

export function subscribeComposerPrefill(listener: () => void): () => void {
  window.addEventListener(PREFILL_EVENT, listener)
  return () => window.removeEventListener(PREFILL_EVENT, listener)
}

export function appendDraftText(draft: string, text: string): string {
  return draft.trim() ? `${draft.trimEnd()}\n\n${text}` : text
}
