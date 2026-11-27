/** Reads a `limit` query value. Missing or bad values get the fallback, others stay between 1 and max. */
export function parseLimitParam(value: string | null, fallback: number, max: number): number {
  // Number(null) and Number('') are 0, which would cap a list at one item.
  if (value === null || value.trim() === '') return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(1, Math.min(max, Math.floor(parsed)))
}
