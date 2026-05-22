import 'server-only'

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

function normalizeDatabaseUrl(value: string): string {
  return value.trim()
}

export function getDatabaseRuntimeConfig() {
  const databaseUrl =
    process.env.DATABASE_URL?.trim() ??
    process.env.NEON_DATABASE_URL?.trim() ??
    process.env.POSTGRES_URL?.trim() ??
    ''

  return {
    databaseUrl: databaseUrl ? normalizeDatabaseUrl(databaseUrl) : '',
  }
}

export function hasDatabaseConfig(): boolean {
  return Boolean(getDatabaseRuntimeConfig().databaseUrl)
}

let neonSqlClient: ReturnType<typeof neon> | null = null
let neonSqlClientUrl = ''

export function getNeonSql() {
  const { databaseUrl } = getDatabaseRuntimeConfig()

  if (!databaseUrl) {
    throw new Error('Neon database configuration is missing.')
  }

  if (!neonSqlClient || neonSqlClientUrl !== databaseUrl) {
    neonSqlClient = neon(databaseUrl)
    neonSqlClientUrl = databaseUrl
  }

  return neonSqlClient
}

export function getDatabaseClient() {
  return drizzle(getNeonSql(), { schema })
}

export async function validateDatabaseConnection(): Promise<boolean> {
  const rows = (await getNeonSql().query('select 1 as ok')) as Array<{
    ok: number | string
  }>
  return rows.some((row) => Number(row.ok) === 1)
}
