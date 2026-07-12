// Context Engine Phase 3 — exact-evidence detection. A durable memory item
// "contains exact evidence" when it carries fragile tokens that must never be
// paraphrased: identifiers, file paths, API routes, URLs, code, hashes, table/
// column names, versions, money, or measured numbers. The read path routes such
// items into a verbatim block that bypasses lossy compression, and always
// includes them even when similarity ranking would drop them. Pure and
// framework-free so it is shared and unit-testable. See AI_CONTEXT_ENGINE.md §3.

const EXACT_EVIDENCE_PATTERNS: RegExp[] = [
  /```|`[^`]+`/, // fenced or inline code
  /\/api\//i, // API route
  /https?:\/\//i, // URL
  /\/?[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\.[A-Za-z0-9]+/, // path like lib/db/schema.ts
  /\b[A-Za-z0-9_-]{16,}\b/, // long id / hash / token / key
  /\b[a-z0-9]+_[a-z0-9_]+\b/i, // snake_case identifier (table / column / env var)
  /[$€£]\s?\d|\d[\d,]*\s?(%|ms|px|kb|mb|gb|tb|tokens?|dims?|x\d)\b/i, // money / units / dims
  /\bv?\d+\.\d+(?:\.\d+)?\b/, // version or decimal like 16.2 or 1.2.3
]

export function containsExactEvidence(text: string): boolean {
  if (!text) return false
  return EXACT_EVIDENCE_PATTERNS.some((pattern) => pattern.test(text))
}
