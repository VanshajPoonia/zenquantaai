import { neon } from '@neondatabase/serverless'

function normalizeDatabaseUrl(value: string): string {
  return value.trim()
}

export function getNeonRuntimeConfig() {
  const databaseUrl =
    process.env.DATABASE_URL?.trim() ??
    process.env.NEON_DATABASE_URL?.trim() ??
    process.env.POSTGRES_URL?.trim() ??
    ''

  return {
    databaseUrl: databaseUrl ? normalizeDatabaseUrl(databaseUrl) : '',
  }
}

export function hasNeonConfig(): boolean {
  return Boolean(getNeonRuntimeConfig().databaseUrl)
}

let sqlClient: ReturnType<typeof neon> | null = null
let sqlClientUrl = ''

function getNeonSql() {
  const { databaseUrl } = getNeonRuntimeConfig()

  if (!databaseUrl) {
    throw new Error('Neon database configuration is missing.')
  }

  if (!sqlClient || sqlClientUrl !== databaseUrl) {
    sqlClient = neon(databaseUrl)
    sqlClientUrl = databaseUrl
  }

  return sqlClient
}

export async function neonQuery<T>(
  query: string,
  params: unknown[] = []
): Promise<T[]> {
  return (await getNeonSql().query(query, params)) as T[]
}

export async function neonOne<T>(
  query: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await neonQuery<T>(query, params)
  return rows[0] ?? null
}

export function toNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim()) return Number(value)
  return 0
}
