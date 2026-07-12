import { estimatePromptTokens } from '@/lib/utils/cost'

// Context Engine Phase 5 — TOON (Token-Oriented Object Notation).
//
// Serializes a *uniform array of flat objects* as a header-once table:
//
//   sources[3]{id,title,url}:
//     1,Example,https://example.com
//     2,Docs,https://example.com/docs
//     3,Blog,https://example.com/blog
//
// vs JSON, which repeats every key + braces + quotes on every row. The token win
// is real only when the per-row structural overhead (repeated keys, punctuation)
// is a meaningful share of the row — i.e. short rows with several columns. On
// rows dominated by long free-text values the structural share is small, so the
// win shrinks toward nothing (see AI_CONTEXT_ENGINE.md §8).
//
// Because of that, the encoder is deliberately paired with `isToonWorthwhile`:
// callers keep their existing rendering and only swap to TOON when it is a real
// measured win. TOON can therefore never make a block *larger* than it already
// was — it is a strict, opt-in improvement, inert on shapes it cannot help.
//
// Pure and framework-free so the format and the gate are unit-testable in
// isolation from the prompt assembly in lib/ai/chat.ts.

export type ToonScalar = string | number | boolean | null | undefined
export type ToonRow = Record<string, ToonScalar>

/** Below this row count the header amortization is too small to bother. */
export const MIN_TOON_ROWS = 4

/** Default minimum fraction of baseline tokens TOON must save to be chosen. */
export const DEFAULT_TOON_SAVINGS_RATIO = 0.1

// Quote a cell only when a bare value would corrupt the comma-delimited row:
// it contains a comma, quote, or newline, or carries edge whitespace that the
// reader would otherwise trim. Embedded quotes are doubled (CSV/TOON convention).
function encodeScalar(value: ToonScalar): string {
  if (value === null || value === undefined) return ''
  const raw = typeof value === 'string' ? value : String(value)
  if (raw === '') return ''

  const needsQuote = /[",\n\r]/.test(raw) || raw !== raw.trim()
  return needsQuote ? `"${raw.replace(/"/g, '""')}"` : raw
}

/**
 * Encode a uniform array of flat objects as a TOON block. `columns` fixes the
 * field order; every row emits exactly those columns (a missing/nullish field
 * becomes an empty cell). Returns '' for an empty array or no columns, so
 * callers add nothing when there is nothing to encode.
 */
export function encodeToon(name: string, columns: string[], rows: ToonRow[]): string {
  if (rows.length === 0 || columns.length === 0) return ''

  const header = `${name}[${rows.length}]{${columns.join(',')}}:`
  const body = rows.map(
    (row) => `  ${columns.map((column) => encodeScalar(row[column])).join(',')}`
  )

  return [header, ...body].join('\n')
}

/**
 * True when `candidate` is at least `minSavingsRatio` smaller than `baseline`
 * in estimated prompt tokens. Uses the same estimator as the token governor so
 * the accounting is consistent. Returns false when the baseline is empty (no
 * meaningful ratio) so callers safely fall back to their current rendering.
 */
export function isToonWorthwhile(
  baseline: string,
  candidate: string,
  minSavingsRatio: number = DEFAULT_TOON_SAVINGS_RATIO
): boolean {
  const baselineTokens = estimatePromptTokens(baseline)
  if (baselineTokens <= 0) return false

  const savedTokens = baselineTokens - estimatePromptTokens(candidate)
  return savedTokens / baselineTokens >= minSavingsRatio
}
