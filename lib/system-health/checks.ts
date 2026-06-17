import 'server-only'

import { HealthCheck, HealthStatus, SystemHealthReport } from '@/types'
import { hasDatabaseConfig, getDatabaseRuntimeConfig, getNeonSql } from '@/lib/db/client'
import { hasOpenRouterConfig } from '@/lib/ai/openrouter'
import { hasWebSearchConfig } from '@/lib/search/web-search'
import { hasEmbeddingConfig, getEmbeddingModel } from '@/lib/rag/embeddings'
import { getObjectStorageConfig } from '@/lib/storage/object-store'

function makeCheck(
  id: string,
  label: string,
  status: HealthStatus,
  message: string,
  detail?: string
): HealthCheck {
  return { id, label, status, message, detail }
}

function sanitizeUrl(raw: string): string {
  try {
    const parsed = new URL(raw)
    return `${parsed.protocol}//${parsed.hostname}${parsed.pathname !== '/' ? parsed.pathname : ''}`
  } catch {
    return '(configured)'
  }
}

async function checkDatabaseUrl(): Promise<HealthCheck> {
  const { databaseUrl } = getDatabaseRuntimeConfig()
  if (!databaseUrl) {
    return makeCheck(
      'db_url',
      'Database URL',
      'missing',
      'No DATABASE_URL, NEON_DATABASE_URL, or POSTGRES_URL is set.'
    )
  }
  return makeCheck(
    'db_url',
    'Database URL',
    'healthy',
    'Database URL is configured.',
    sanitizeUrl(databaseUrl)
  )
}

async function checkDatabaseConnection(): Promise<HealthCheck> {
  if (!hasDatabaseConfig()) {
    return makeCheck(
      'db_connect',
      'Neon connection',
      'missing',
      'Skipped — no database URL configured.'
    )
  }
  try {
    const sql = getNeonSql()
    const rows = (await sql.query('SELECT 1 AS ok')) as Array<{ ok: number | string }>
    if (rows.some((row) => Number(row.ok) === 1)) {
      return makeCheck('db_connect', 'Neon connection', 'healthy', 'Connected to Neon successfully.')
    }
    return makeCheck('db_connect', 'Neon connection', 'unknown', 'SELECT 1 returned an unexpected result.')
  } catch (error) {
    return makeCheck(
      'db_connect',
      'Neon connection',
      'missing',
      'Could not connect to Neon.',
      error instanceof Error ? error.message : 'Unknown error'
    )
  }
}

const REQUIRED_TABLES = [
  'zen_users',
  'zen_subscriptions',
  'zen_auth_sessions',
  'zen_artifact_shares',
  'zen_template_shares',
]

async function checkDatabaseSchema(): Promise<HealthCheck> {
  if (!hasDatabaseConfig()) {
    return makeCheck('db_schema', 'Database schema', 'missing', 'Skipped — no database URL configured.')
  }
  try {
    const sql = getNeonSql()
    const rows = (await sql.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1)`,
      [REQUIRED_TABLES]
    )) as Array<{ table_name: string }>

    const found = new Set(rows.map((r) => r.table_name))
    const missing = REQUIRED_TABLES.filter((t) => !found.has(t))

    if (missing.length === 0) {
      return makeCheck(
        'db_schema',
        'Database schema',
        'healthy',
        `All ${REQUIRED_TABLES.length} expected tables are present.`
      )
    }
    return makeCheck(
      'db_schema',
      'Database schema',
      'missing',
      `${missing.length} expected table(s) not found — migrations may need to run.`,
      `Missing: ${missing.join(', ')}`
    )
  } catch (error) {
    return makeCheck(
      'db_schema',
      'Database schema',
      'unknown',
      'Could not query information_schema.',
      error instanceof Error ? error.message : 'Unknown error'
    )
  }
}

async function checkPgVector(): Promise<HealthCheck> {
  if (!hasDatabaseConfig()) {
    return makeCheck('pgvector', 'pgvector extension', 'missing', 'Skipped — no database URL configured.')
  }
  try {
    const sql = getNeonSql()
    const rows = (await sql.query(
      `SELECT installed_version FROM pg_available_extensions WHERE name = 'vector'`
    )) as Array<{ installed_version: string | null }>

    const row = rows[0]
    if (!row) {
      return makeCheck(
        'pgvector',
        'pgvector extension',
        'missing',
        'pgvector is not available in this database instance.'
      )
    }
    if (!row.installed_version) {
      return makeCheck(
        'pgvector',
        'pgvector extension',
        'degraded',
        'pgvector is available but not installed.',
        'Run: CREATE EXTENSION IF NOT EXISTS vector'
      )
    }
    return makeCheck(
      'pgvector',
      'pgvector extension',
      'healthy',
      'pgvector extension is installed.',
      `Version: ${row.installed_version}`
    )
  } catch (error) {
    return makeCheck(
      'pgvector',
      'pgvector extension',
      'unknown',
      'Could not query pg_available_extensions.',
      error instanceof Error ? error.message : 'Unknown error'
    )
  }
}

function checkOpenRouter(): HealthCheck {
  return hasOpenRouterConfig()
    ? makeCheck('openrouter', 'OpenRouter API key', 'healthy', 'OPENROUTER_API_KEY is configured.')
    : makeCheck(
        'openrouter',
        'OpenRouter API key',
        'missing',
        'OPENROUTER_API_KEY is not set. AI text and image chat will not work.'
      )
}

function checkTavily(): HealthCheck {
  return hasWebSearchConfig()
    ? makeCheck(
        'tavily',
        'Tavily web search',
        'healthy',
        'TAVILY_API_KEY is configured. Pulse live search is available.'
      )
    : makeCheck(
        'tavily',
        'Tavily web search',
        'degraded',
        'TAVILY_API_KEY is not set. Pulse and webSearch will degrade gracefully without it.'
      )
}

function checkEmbeddings(): HealthCheck {
  if (hasEmbeddingConfig()) {
    return makeCheck(
      'embeddings',
      'Embeddings API key',
      'healthy',
      'Embedding API key is configured.',
      `Model: ${getEmbeddingModel()}`
    )
  }
  return makeCheck(
    'embeddings',
    'Embeddings API key',
    'degraded',
    'EMBEDDINGS_API_KEY (or OPENAI_API_KEY) is not set. File knowledge indexing and RAG retrieval will not function.'
  )
}

function checkStorageProvider(): HealthCheck {
  const config = getObjectStorageConfig()
  if (config.provider === 'local') {
    if (process.env.NODE_ENV === 'production') {
      return makeCheck(
        'storage_provider',
        'File storage provider',
        'degraded',
        'FILE_STORAGE_PROVIDER is "local" in a production environment.',
        'Local storage is not persistent on serverless deployments. Set FILE_STORAGE_PROVIDER to "s3" or "r2".'
      )
    }
    return makeCheck(
      'storage_provider',
      'File storage provider',
      'degraded',
      'FILE_STORAGE_PROVIDER is "local" (development default).',
      'Use s3 or r2 in production for persistent file storage.'
    )
  }
  return makeCheck(
    'storage_provider',
    'File storage provider',
    'healthy',
    `FILE_STORAGE_PROVIDER is "${config.provider}".`
  )
}

function checkStorageCredentials(): HealthCheck {
  const config = getObjectStorageConfig()
  if (config.provider === 'local') {
    return makeCheck(
      'storage_creds',
      'Storage credentials',
      'unknown',
      'Skipped — using local file storage, no remote credentials needed.'
    )
  }

  const missing: string[] = []
  if (!config.endpoint) missing.push('FILE_STORAGE_ENDPOINT')
  if (!config.accessKeyId) missing.push('FILE_STORAGE_ACCESS_KEY_ID')
  if (!config.secretAccessKey) missing.push('FILE_STORAGE_SECRET_ACCESS_KEY')
  if (!config.bucket) missing.push('FILE_STORAGE_BUCKET')

  if (missing.length > 0) {
    return makeCheck(
      'storage_creds',
      'Storage credentials',
      'missing',
      `${config.provider.toUpperCase()} credentials are incomplete.`,
      `Missing: ${missing.join(', ')}`
    )
  }

  let endpointDisplay = config.endpoint
  try {
    endpointDisplay = new URL(config.endpoint).hostname
  } catch {
    // use raw value
  }

  return makeCheck(
    'storage_creds',
    'Storage credentials',
    'healthy',
    `${config.provider.toUpperCase()} credentials are configured.`,
    `Endpoint: ${endpointDisplay} · Bucket: ${config.bucket}`
  )
}

function checkAuthSecurity(): HealthCheck {
  if (process.env.NODE_ENV === 'production') {
    return makeCheck(
      'auth_security',
      'Session cookie security',
      'healthy',
      'NODE_ENV is "production". Session cookies use Secure, HttpOnly, SameSite=Lax.'
    )
  }
  return makeCheck(
    'auth_security',
    'Session cookie security',
    'degraded',
    `NODE_ENV is "${process.env.NODE_ENV ?? 'not set'}". Session cookies omit the Secure flag in this mode.`,
    'Expected for local development; ensure NODE_ENV=production in deployed environments.'
  )
}

function checkAppUrl(): HealthCheck {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.VERCEL_URL?.trim()
  if (raw) {
    const display = sanitizeUrl(raw.startsWith('http') ? raw : `https://${raw}`)
    return makeCheck('app_url', 'Application URL', 'healthy', 'App URL is configured.', display)
  }
  return makeCheck(
    'app_url',
    'Application URL',
    'degraded',
    'NEXT_PUBLIC_APP_URL is not set. Share link base URLs may be incorrect.'
  )
}

function checkDeploymentEnvironment(): HealthCheck {
  const vercelEnv = process.env.VERCEL_ENV?.trim()
  const nodeEnv = process.env.NODE_ENV?.trim() ?? 'not set'

  if (vercelEnv) {
    return makeCheck(
      'deploy_env',
      'Deployment environment',
      'healthy',
      'Vercel deployment detected.',
      `VERCEL_ENV=${vercelEnv} · NODE_ENV=${nodeEnv}`
    )
  }

  return makeCheck(
    'deploy_env',
    'Deployment environment',
    nodeEnv === 'production' ? 'healthy' : 'degraded',
    `NODE_ENV=${nodeEnv}. No Vercel environment detected.`,
    'May be a self-hosted or local deployment.'
  )
}

function summarize(checks: HealthCheck[]) {
  return {
    healthy: checks.filter((c) => c.status === 'healthy').length,
    degraded: checks.filter((c) => c.status === 'degraded').length,
    missing: checks.filter((c) => c.status === 'missing').length,
    unknown: checks.filter((c) => c.status === 'unknown').length,
  }
}

export async function runSystemHealthChecks(): Promise<SystemHealthReport> {
  const [dbUrl, dbConnect, dbSchema, pgvector] = await Promise.all([
    checkDatabaseUrl(),
    checkDatabaseConnection(),
    checkDatabaseSchema(),
    checkPgVector(),
  ])

  const checks: HealthCheck[] = [
    dbUrl,
    dbConnect,
    dbSchema,
    pgvector,
    checkOpenRouter(),
    checkTavily(),
    checkEmbeddings(),
    checkStorageProvider(),
    checkStorageCredentials(),
    checkAuthSecurity(),
    checkAppUrl(),
    checkDeploymentEnvironment(),
  ]

  return {
    checkedAt: new Date().toISOString(),
    checks,
    summary: summarize(checks),
  }
}
