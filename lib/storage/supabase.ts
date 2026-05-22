type SupabaseMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

interface SupabaseRequestInit {
  method?: SupabaseMethod
  query?: Record<string, string | number | undefined>
  body?: unknown
  prefer?: string
  apiKey?: string
}

function normalizeSupabaseUrl(value: string): string {
  return value.trim().replace(/\/$/, '')
}

export function getSupabaseRuntimeConfig() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ??
    process.env.SUPABASE_URL?.trim() ??
    ''
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ??
    process.env.SUPABASE_ANON_KEY?.trim() ??
    ''
  const secretKey =
    process.env.SUPABASE_SECRET_KEY?.trim() ??
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    ''

  return {
    url: url ? normalizeSupabaseUrl(url) : '',
    publishableKey,
    secretKey,
  }
}

export function hasSupabaseConfig(): boolean {
  const config = getSupabaseRuntimeConfig()
  return Boolean(config.url && (config.secretKey || config.publishableKey))
}

export function hasSupabaseAdminConfig(): boolean {
  const config = getSupabaseRuntimeConfig()
  return Boolean(config.url && config.secretKey)
}

function resolveApiKey(override?: string): string {
  const config = getSupabaseRuntimeConfig()
  return override || config.secretKey || config.publishableKey
}

async function requestJson<T>(
  url: string,
  init: RequestInit & { apiKey?: string; prefer?: string } = {}
): Promise<T> {
  const config = getSupabaseRuntimeConfig()
  const apiKey = resolveApiKey(init.apiKey)

  if (!config.url || !apiKey) {
    throw new Error('Supabase runtime configuration is missing.')
  }

  const response = await fetch(url, {
    ...init,
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${apiKey}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.prefer ? { Prefer: init.prefer } : {}),
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    const message = await response.text().catch(() => '')
    throw new Error(
      message || `Supabase request failed with status ${response.status}.`
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json().catch(() => null)) as T
}

export async function supabaseRequest<T>(
  table: string,
  init: SupabaseRequestInit = {}
): Promise<T> {
  const config = getSupabaseRuntimeConfig()
  const url = new URL(`${config.url}/rest/v1/${table}`)

  for (const [key, value] of Object.entries(init.query ?? {})) {
    if (typeof value === 'undefined') continue
    url.searchParams.set(key, String(value))
  }

  return await requestJson<T>(url.toString(), {
    method: init.method ?? 'GET',
    prefer: init.prefer ?? 'return=representation',
    ...(typeof init.body !== 'undefined'
      ? { body: JSON.stringify(init.body) }
      : {}),
    apiKey: init.apiKey,
  })
}

export async function supabaseStorageUpload(input: {
  bucket: string
  path: string
  contentType: string
  body: Blob | ArrayBuffer | Buffer
  upsert?: boolean
}): Promise<void> {
  const config = getSupabaseRuntimeConfig()
  const apiKey = resolveApiKey()

  if (!config.url || !apiKey) {
    throw new Error('Supabase storage configuration is missing.')
  }

  const response = await fetch(
    `${config.url}/storage/v1/object/${input.bucket}/${input.path}`,
    {
      method: 'POST',
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': input.contentType,
        'x-upsert': input.upsert ? 'true' : 'false',
      },
      body: input.body as BodyInit,
      cache: 'no-store',
    }
  )

  if (!response.ok) {
    const message = await response.text().catch(() => '')
    throw new Error(
      message || `Supabase storage upload failed with status ${response.status}.`
    )
  }
}

export async function createSupabaseSignedUrl(input: {
  bucket: string
  path: string
  expiresIn?: number
}): Promise<string> {
  const config = getSupabaseRuntimeConfig()
  const apiKey = resolveApiKey()

  if (!config.url || !apiKey) {
    throw new Error('Supabase storage configuration is missing.')
  }

  const response = await requestJson<{ signedURL?: string; signedUrl?: string }>(
    `${config.url}/storage/v1/object/sign/${input.bucket}/${input.path}`,
    {
      method: 'POST',
      body: JSON.stringify({
        expiresIn: input.expiresIn ?? 60 * 60,
      }),
      apiKey,
    }
  )

  const signedPath = response.signedURL ?? response.signedUrl

  if (!signedPath) {
    throw new Error('Supabase did not return a signed storage URL.')
  }

  return signedPath.startsWith('http')
    ? signedPath
    : `${config.url}/storage/v1${signedPath}`
}
