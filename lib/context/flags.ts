// Context Engine feature flags. Read process.env, so effectively server-side;
// if ever bundled client-side the env vars are undefined and every flag reads
// false (safe default). All default OFF so `main` is always safe to
// deploy: when a flag is disabled the pre-existing regex/last-8-message path
// runs unchanged. See AI_CONTEXT_ENGINE.md §6.
//
// Enabled when the env var is one of: "1", "true", "on" (case-insensitive).

function isEnabled(value: string | undefined): boolean {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'on'
}

/** Phase 1: structured cheap-LLM rolling summary replaces the regex summarizer. */
export function isMemoryV2Enabled(): boolean {
  return isEnabled(process.env.MEMORY_V2)
}

/** Phase 2: governed token budget + cache-friendly prompt ordering. */
export function isContextBudgetEnabled(): boolean {
  return isEnabled(process.env.CONTEXT_BUDGET)
}

/** Phase 3: durable memory items + cheap-model write gate. */
export function isMemoryExtractionEnabled(): boolean {
  return isEnabled(process.env.MEMORY_EXTRACTION)
}

/** Phase 4: cross-chat recall via conversation-summary embeddings. */
export function isCrossChatRecallEnabled(): boolean {
  return isEnabled(process.env.CROSS_CHAT_RECALL)
}

/** Phase 5+: TOON encoding for uniform context blocks. */
export function isToonSerializationEnabled(): boolean {
  return isEnabled(process.env.TOON_SERIALIZATION)
}

/** Dev-only structured context logging. */
export function isContextDebugEnabled(): boolean {
  return isEnabled(process.env.CONTEXT_DEBUG)
}
