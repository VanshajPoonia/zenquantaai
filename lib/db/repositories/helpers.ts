import 'server-only'

export function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value
}

export function toNullableIsoString(
  value: Date | string | null | undefined
): string | null {
  if (!value) return null
  return toIsoString(value)
}

export function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value)
}

export function toNullableDate(
  value: Date | string | null | undefined
): Date | null {
  if (!value) return null
  return toDate(value)
}

export function toNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim()) return Number(value)
  return 0
}

export function toJsonArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

export function toJsonObject<T extends object>(value: unknown, fallback: T): T {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as T)
    : fallback
}

export function compactObject<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => typeof value !== 'undefined')
  ) as Partial<T>
}
