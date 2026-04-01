import { NextRequest, NextResponse } from 'next/server'
import { AuthUser } from '@/types'

const ACCESS_TOKEN_COOKIE = 'zenquanta-access-token'
const REFRESH_TOKEN_COOKIE = 'zenquanta-refresh-token'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30
const LOGIN_ID_EMAIL_DOMAIN = 'login.zenquanta.local'

type SupabaseUserMetadata = {
  login_id?: string | null
}

type SupabaseAuthUser = {
  id: string
  email?: string | null
  user_metadata?: SupabaseUserMetadata | null
}

type SupabaseSessionResponse = {
  access_token?: string
  refresh_token?: string
  user?: SupabaseAuthUser | null
  session?: {
    access_token?: string
    refresh_token?: string
  } | null
}

type SupabaseAuthType = 'magiclink' | 'recovery' | 'invite' | 'signup' | 'email'

export interface RequestAuthSession {
  user: AuthUser | null
  accessToken?: string
  refreshToken?: string
  refreshed?: boolean
  shouldClearCookies?: boolean
}

function normalizeSupabaseUrl(value: string): string {
  return value.trim().replace(/\/$/, '')
}

function normalizeLoginId(value: string): string {
  return value.trim().toLowerCase()
}

function loginIdToSyntheticEmail(loginId: string): string {
  return `${loginId}@${LOGIN_ID_EMAIL_DOMAIN}`
}

function syntheticEmailToLoginId(email: string | null | undefined): string | null {
  const normalizedEmail = email?.trim().toLowerCase()
  const suffix = `@${LOGIN_ID_EMAIL_DOMAIN}`

  if (!normalizedEmail || !normalizedEmail.endsWith(suffix)) {
    return null
  }

  return normalizedEmail.slice(0, -suffix.length)
}

export function parseLoginId(value: string): string {
  const loginId = normalizeLoginId(value)

  if (!/^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])?$/.test(loginId)) {
    throw new Error(
      'Use 3-32 characters with letters, numbers, ".", "_" or "-".'
    )
  }

  return loginId
}

function toAuthUser(user: SupabaseAuthUser | null | undefined): AuthUser | null {
  if (!user?.id) return null

  return {
    id: user.id,
    loginId:
      user.user_metadata?.login_id?.trim()?.toLowerCase() ??
      syntheticEmailToLoginId(user.email) ??
      null,
    email: user.email ?? null,
  }
}

export function getSupabaseAuthConfig() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ??
    process.env.SUPABASE_URL?.trim() ??
    ''
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ??
    process.env.SUPABASE_ANON_KEY?.trim() ??
    ''

  return {
    url: url ? normalizeSupabaseUrl(url) : '',
    publishableKey,
  }
}

export function hasSupabaseAuthConfig(): boolean {
  const config = getSupabaseAuthConfig()
  return Boolean(config.url && config.publishableKey)
}

function getSupabaseAdminAuthConfig() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ??
    process.env.SUPABASE_URL?.trim() ??
    ''
  const secretKey =
    process.env.SUPABASE_SECRET_KEY?.trim() ??
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    ''

  return {
    url: url ? normalizeSupabaseUrl(url) : '',
    secretKey,
  }
}

export function hasSupabaseAdminAuthConfig(): boolean {
  const config = getSupabaseAdminAuthConfig()
  return Boolean(config.url && config.secretKey)
}

async function requestSupabaseAuth<T>(
  path: string,
  init: {
    method?: 'GET' | 'POST' | 'PUT'
    accessToken?: string
    body?: unknown
    apiKey?: string
  } = {}
): Promise<T> {
  const config = getSupabaseAuthConfig()
  const apiKey = init.apiKey?.trim() ?? config.publishableKey

  if (!config.url || !apiKey) {
    throw new Error('Supabase auth configuration is missing.')
  }

  const response = await fetch(`${config.url}/auth/v1${path}`, {
    method: init.method ?? 'GET',
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${init.accessToken ?? apiKey}`,
      ...(typeof init.body !== 'undefined'
        ? { 'Content-Type': 'application/json' }
        : {}),
    },
    ...(typeof init.body !== 'undefined'
      ? { body: JSON.stringify(init.body) }
      : {}),
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      (payload as { msg?: string; error_description?: string; message?: string } | null)
        ?.msg ??
      (payload as { error_description?: string; message?: string } | null)
        ?.error_description ??
      (payload as { message?: string } | null)?.message ??
      `Supabase auth request failed with status ${response.status}.`

    throw new Error(message)
  }

  return payload as T
}

function serializeCookie(
  name: string,
  value: string,
  options: {
    maxAge?: number
  } = {}
): string {
  const segments = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    ...(process.env.NODE_ENV === 'production' ? ['Secure'] : []),
  ]

  if (typeof options.maxAge === 'number') {
    segments.push(`Max-Age=${options.maxAge}`)
  }

  return segments.join('; ')
}

function readCookieValue(
  request: Pick<NextRequest, 'cookies'>,
  name: string
): string {
  return request.cookies.get(name)?.value?.trim() ?? ''
}

function readCookieStoreValue(
  cookieStore: {
    get(name: string): { value?: string } | undefined
  },
  name: string
): string {
  return cookieStore.get(name)?.value?.trim() ?? ''
}

export function appendAuthCookies(
  headers: Headers,
  session: Pick<RequestAuthSession, 'accessToken' | 'refreshToken'>
): void {
  if (session.accessToken) {
    headers.append(
      'Set-Cookie',
      serializeCookie(ACCESS_TOKEN_COOKIE, session.accessToken, {
        maxAge: COOKIE_MAX_AGE_SECONDS,
      })
    )
  }

  if (session.refreshToken) {
    headers.append(
      'Set-Cookie',
      serializeCookie(REFRESH_TOKEN_COOKIE, session.refreshToken, {
        maxAge: COOKIE_MAX_AGE_SECONDS,
      })
    )
  }
}

export function appendClearedAuthCookies(headers: Headers): void {
  headers.append(
    'Set-Cookie',
    serializeCookie(ACCESS_TOKEN_COOKIE, '', { maxAge: 0 })
  )
  headers.append(
    'Set-Cookie',
    serializeCookie(REFRESH_TOKEN_COOKIE, '', { maxAge: 0 })
  )
}

export function createUnauthorizedResponse(clearCookies = false) {
  const response = NextResponse.json(
    { error: 'Authentication is required.' },
    { status: 401 }
  )

  if (clearCookies) {
    appendClearedAuthCookies(response.headers)
  }

  return response
}

export async function sendMagicLink(email: string, redirectTo: string): Promise<void> {
  await requestSupabaseAuth('/otp', {
    method: 'POST',
    body: {
      email,
      create_user: true,
      data: {},
      gotrue_meta_security: {},
      options: {
        email_redirect_to: redirectTo,
      },
    },
  })
}

export async function sendPasswordResetEmail(
  email: string,
  redirectTo: string
): Promise<void> {
  await requestSupabaseAuth('/recover', {
    method: 'POST',
    body: {
      email,
      code_challenge: null,
      code_challenge_method: null,
      gotrue_meta_security: {},
      options: {
        email_redirect_to: redirectTo,
      },
    },
  })
}

export async function signUpWithPassword(
  email: string,
  password: string,
  redirectTo: string
): Promise<{ needsEmailVerification: boolean }> {
  const response = await requestSupabaseAuth<SupabaseSessionResponse>('/signup', {
    method: 'POST',
    body: {
      email,
      password,
      options: {
        email_redirect_to: redirectTo,
      },
    },
  })

  return {
    needsEmailVerification: true,
  }
}

export async function createLoginIdAccount(
  loginId: string,
  password: string
): Promise<void> {
  const adminConfig = getSupabaseAdminAuthConfig()

  if (!adminConfig.url || !adminConfig.secretKey) {
    throw new Error('Supabase admin auth configuration is missing.')
  }

  try {
    await requestSupabaseAuth('/admin/users', {
      method: 'POST',
      apiKey: adminConfig.secretKey,
      body: {
        email: loginIdToSyntheticEmail(loginId),
        password,
        email_confirm: true,
        user_metadata: {
          login_id: loginId,
        },
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : ''

    if (message.includes('already') || message.includes('registered')) {
      throw new Error('That ID is already taken.')
    }

    throw error
  }
}

export async function signInWithPassword(
  email: string,
  password: string
): Promise<RequestAuthSession> {
  const session = await requestSupabaseAuth<SupabaseSessionResponse>(
    '/token?grant_type=password',
    {
      method: 'POST',
      body: {
        email,
        password,
      },
    }
  )

  const accessToken = session.access_token ?? session.session?.access_token ?? ''
  const refreshToken = session.refresh_token ?? session.session?.refresh_token ?? ''
  const user = toAuthUser(session.user)

  if (!accessToken || !refreshToken || !user) {
    throw new Error('Supabase did not return a valid password session.')
  }

  return {
    user,
    accessToken,
    refreshToken,
  }
}

export async function signInWithLoginId(
  loginId: string,
  password: string
): Promise<RequestAuthSession> {
  return await signInWithPassword(loginIdToSyntheticEmail(loginId), password)
}

export async function updatePassword(
  accessToken: string,
  password: string
): Promise<void> {
  await requestSupabaseAuth('/user', {
    method: 'PUT',
    accessToken,
    body: {
      password,
    },
  })
}

export async function verifyMagicLink(
  tokenHash: string,
  type: SupabaseAuthType
): Promise<RequestAuthSession> {
  const session = await requestSupabaseAuth<SupabaseSessionResponse>('/verify', {
    method: 'POST',
    body: {
      token_hash: tokenHash,
      type,
    },
  })

  return {
    user: toAuthUser(session.user),
    accessToken: session.access_token ?? session.session?.access_token,
    refreshToken: session.refresh_token ?? session.session?.refresh_token,
  }
}

async function fetchUser(accessToken: string): Promise<AuthUser | null> {
  try {
    const user = await requestSupabaseAuth<SupabaseAuthUser>('/user', {
      method: 'GET',
      accessToken,
    })

    return toAuthUser(user)
  } catch {
    return null
  }
}

async function refreshSession(refreshToken: string): Promise<RequestAuthSession | null> {
  try {
    const session = await requestSupabaseAuth<SupabaseSessionResponse>(
      '/token?grant_type=refresh_token',
      {
        method: 'POST',
        body: {
          refresh_token: refreshToken,
        },
      }
    )

    return {
      user: toAuthUser(session.user),
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      refreshed: true,
    }
  } catch {
    return null
  }
}

export async function readRequestAuthSession(
  request: Pick<NextRequest, 'cookies'>
): Promise<RequestAuthSession> {
  const accessToken = readCookieValue(request, ACCESS_TOKEN_COOKIE)
  const refreshToken = readCookieValue(request, REFRESH_TOKEN_COOKIE)

  return await readAccessAndRefreshTokenSession({
    accessToken,
    refreshToken,
  })
}

export async function readCookieStoreAuthSession(cookieStore: {
  get(name: string): { value?: string } | undefined
}): Promise<RequestAuthSession> {
  const accessToken = readCookieStoreValue(cookieStore, ACCESS_TOKEN_COOKIE)
  const refreshToken = readCookieStoreValue(cookieStore, REFRESH_TOKEN_COOKIE)

  return await readAccessAndRefreshTokenSession({
    accessToken,
    refreshToken,
  })
}

async function readAccessAndRefreshTokenSession(input: {
  accessToken: string
  refreshToken: string
}): Promise<RequestAuthSession> {
  const accessToken = input.accessToken
  const refreshToken = input.refreshToken

  if (!accessToken && !refreshToken) {
    return { user: null }
  }

  if (accessToken) {
    const user = await fetchUser(accessToken)

    if (user) {
      return {
        user,
        accessToken,
        refreshToken: refreshToken || undefined,
      }
    }
  }

  if (refreshToken) {
    const refreshed = await refreshSession(refreshToken)
    if (refreshed?.user) {
      return refreshed
    }
  }

  return {
    user: null,
    shouldClearCookies: true,
  }
}

export async function requireAuthenticatedUser(request: NextRequest) {
  const session = await readRequestAuthSession(request)

  if (!session.user) {
    return {
      session,
      response: createUnauthorizedResponse(session.shouldClearCookies),
    }
  }

  return {
    session,
    user: session.user,
  }
}

export async function signOutFromSupabase(
  accessToken: string | undefined
): Promise<void> {
  if (!accessToken) return

  try {
    await requestSupabaseAuth('/logout', {
      method: 'POST',
      accessToken,
    })
  } catch {
    // Clear local cookies even if upstream logout fails.
  }
}
