type SupabaseMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

interface SupabaseRequestInit {
  method?: SupabaseMethod
  query?: Record<string, string | number | undefined>
  body?: unknown
  prefer?: string
}

function normalizeSupabaseUrl(value: string): string {
  return value.trim().replace(/\/$/, '')
}

export function getSupabaseRuntimeConfig() {
  const url = process.env.SUPABASE_URL?.trim() ?? ''
  const apiKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    process.env.SUPABASE_ANON_KEY?.trim() ??
    ''

  return {
    url: url ? normalizeSupabaseUrl(url) : '',
    apiKey,
  }
}

export function hasSupabaseConfig(): boolean {
  const config = getSupabaseRuntimeConfig()
  return Boolean(config.url && config.apiKey)
}

export async function supabaseRequest<T>(
  table: string,
  init: SupabaseRequestInit = {}
): Promise<T> {
  const config = getSupabaseRuntimeConfig()

  if (!config.url || !config.apiKey) {
    throw new Error('Supabase runtime configuration is missing.')
  }

  const url = new URL(`${config.url}/rest/v1/${table}`)

  for (const [key, value] of Object.entries(init.query ?? {})) {
    if (typeof value === 'undefined') continue
    url.searchParams.set(key, String(value))
  }

  const response = await fetch(url.toString(), {
    method: init.method ?? 'GET',
    headers: {
      apikey: config.apiKey,
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      Prefer: init.prefer ?? 'return=representation',
    },
    ...(typeof init.body !== 'undefined'
      ? { body: JSON.stringify(init.body) }
      : {}),
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
