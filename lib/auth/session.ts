import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'crypto'
import { promisify } from 'util'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { AuthUser } from '@/types'
import { getDatabaseClient } from '@/lib/db/client'
import {
  zenAuthCredentials,
  zenAuthSessions,
  zenProfiles,
  zenUsers,
} from '@/lib/db/schema'
import { neonProfilesRepository, neonUsersRepository } from '@/lib/db/repositories'

const scrypt = promisify(scryptCallback)

const SESSION_COOKIE = 'zenquanta-session-token'
const LEGACY_ACCESS_TOKEN_COOKIE = 'zenquanta-access-token'
const LEGACY_REFRESH_TOKEN_COOKIE = 'zenquanta-refresh-token'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30
const PASSWORD_KEY_LENGTH = 64
const PASSWORD_SCRYPT_PARAMS = {
  algorithm: 'scrypt',
  keyLength: PASSWORD_KEY_LENGTH,
}

export interface RequestAuthSession {
  user: AuthUser | null
  accessToken?: string
  refreshToken?: string
  refreshed?: boolean
  shouldClearCookies?: boolean
}

function normalizeLoginId(value: string): string {
  return value.trim().toLowerCase()
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

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function createSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000)
}

async function hashPassword(password: string): Promise<{
  passwordHash: string
  passwordSalt: string
  passwordParams: Record<string, unknown>
}> {
  const passwordSalt = randomBytes(16).toString('base64url')
  const derived = (await scrypt(
    password,
    passwordSalt,
    PASSWORD_KEY_LENGTH
  )) as Buffer

  return {
    passwordHash: derived.toString('base64'),
    passwordSalt,
    passwordParams: PASSWORD_SCRYPT_PARAMS,
  }
}

async function verifyPassword(input: {
  password: string
  passwordHash: string
  passwordSalt: string
}): Promise<boolean> {
  const expected = Buffer.from(input.passwordHash, 'base64')
  const actual = (await scrypt(
    input.password,
    input.passwordSalt,
    expected.length
  )) as Buffer

  if (actual.length !== expected.length) return false

  return timingSafeEqual(actual, expected)
}

function rowToAuthUser(input: {
  id: string
  loginId: string | null
  email: string | null
  role: string
}): AuthUser {
  return {
    id: input.id,
    loginId: input.loginId,
    email: input.email,
    role: input.role === 'admin' ? 'admin' : 'user',
  }
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
  session: Pick<RequestAuthSession, 'accessToken'>
): void {
  if (session.accessToken) {
    headers.append(
      'Set-Cookie',
      serializeCookie(SESSION_COOKIE, session.accessToken, {
        maxAge: COOKIE_MAX_AGE_SECONDS,
      })
    )
  }

  headers.append(
    'Set-Cookie',
    serializeCookie(LEGACY_ACCESS_TOKEN_COOKIE, '', { maxAge: 0 })
  )
  headers.append(
    'Set-Cookie',
    serializeCookie(LEGACY_REFRESH_TOKEN_COOKIE, '', { maxAge: 0 })
  )
}

export function appendClearedAuthCookies(headers: Headers): void {
  headers.append('Set-Cookie', serializeCookie(SESSION_COOKIE, '', { maxAge: 0 }))
  headers.append(
    'Set-Cookie',
    serializeCookie(LEGACY_ACCESS_TOKEN_COOKIE, '', { maxAge: 0 })
  )
  headers.append(
    'Set-Cookie',
    serializeCookie(LEGACY_REFRESH_TOKEN_COOKIE, '', { maxAge: 0 })
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

async function createSessionForUser(input: {
  user: AuthUser
  userAgent?: string | null
  ipAddress?: string | null
}): Promise<RequestAuthSession> {
  const token = createSessionToken()
  const expiresAt = addSeconds(new Date(), COOKIE_MAX_AGE_SECONDS)

  await getDatabaseClient()
    .insert(zenAuthSessions)
    .values({
      userId: input.user.id,
      tokenHash: hashToken(token),
      userAgent: input.userAgent ?? null,
      ipAddress: input.ipAddress ?? null,
      expiresAt,
      lastSeenAt: new Date(),
    })

  return {
    user: input.user,
    accessToken: token,
  }
}

function getRequestMetadata(request: NextRequest): {
  userAgent: string | null
  ipAddress: string | null
} {
  return {
    userAgent: request.headers.get('user-agent'),
    ipAddress:
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip'),
  }
}

export async function createLocalAccount(
  loginId: string,
  password: string
): Promise<AuthUser> {
  const passwordRecord = await hashPassword(password)
  const user = await neonUsersRepository.createLocalUser({
    loginId,
    ...passwordRecord,
  })
  const profile = await neonProfilesRepository.ensureFromAuthUser({
    id: user.id,
    loginId: user.loginId,
    email: user.email,
    role: user.role,
  })

  return {
    id: user.id,
    loginId: user.loginId,
    email: user.email,
    role: profile.role,
  }
}

export async function signInWithLocalCredentials(
  loginId: string,
  password: string,
  request?: NextRequest
): Promise<RequestAuthSession> {
  const credential = await neonUsersRepository.getCredentialByLoginId(loginId)

  if (!credential) {
    throw new Error('Invalid login credentials.')
  }

  const isValidPassword = await verifyPassword({
    password,
    passwordHash: credential.passwordHash,
    passwordSalt: credential.passwordSalt,
  })

  if (!isValidPassword) {
    throw new Error('Invalid login credentials.')
  }

  const profile = await neonProfilesRepository.ensureFromAuthUser({
    id: credential.user.id,
    loginId: credential.user.loginId,
    email: credential.user.email,
    role: credential.user.role,
  })
  const metadata = request
    ? getRequestMetadata(request)
    : { userAgent: null, ipAddress: null }

  return createSessionForUser({
    user: {
      id: credential.user.id,
      loginId: credential.user.loginId,
      email: credential.user.email,
      role: profile.role,
    },
    userAgent: metadata.userAgent,
    ipAddress: metadata.ipAddress,
  })
}

export async function updateLocalPassword(
  sessionToken: string,
  password: string
): Promise<void> {
  const session = await readSessionToken(sessionToken)
  if (!session.user) {
    throw new Error('Your password reset session has expired. Request help from an admin.')
  }

  await neonUsersRepository.updateLocalPassword({
    userId: session.user.id,
    ...(await hashPassword(password)),
  })
}

async function readSessionToken(token: string): Promise<RequestAuthSession> {
  if (!token) {
    return { user: null }
  }

  const rows = await getDatabaseClient()
    .select({
      session: zenAuthSessions,
      user: zenUsers,
      profile: zenProfiles,
    })
    .from(zenAuthSessions)
    .innerJoin(zenUsers, eq(zenAuthSessions.userId, zenUsers.id))
    .leftJoin(zenProfiles, eq(zenProfiles.userId, zenUsers.id))
    .where(
      and(
        eq(zenAuthSessions.tokenHash, hashToken(token)),
        isNull(zenAuthSessions.revokedAt),
        gt(zenAuthSessions.expiresAt, new Date())
      )
    )
    .limit(1)

  const row = rows[0]
  if (!row) {
    return {
      user: null,
      shouldClearCookies: true,
    }
  }

  await getDatabaseClient()
    .update(zenAuthSessions)
    .set({
      lastSeenAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(zenAuthSessions.id, row.session.id))

  return {
    user: rowToAuthUser({
      id: row.user.id,
      loginId: row.profile?.loginId ?? row.user.loginId,
      email: row.profile?.email ?? row.user.email,
      role: row.profile?.role ?? row.user.role,
    }),
    accessToken: token,
  }
}

export async function readRequestAuthSession(
  request: Pick<NextRequest, 'cookies'>
): Promise<RequestAuthSession> {
  const token =
    readCookieValue(request, SESSION_COOKIE) ||
    readCookieValue(request, LEGACY_ACCESS_TOKEN_COOKIE)

  return readSessionToken(token)
}

export async function readCookieStoreAuthSession(cookieStore: {
  get(name: string): { value?: string } | undefined
}): Promise<RequestAuthSession> {
  const token =
    readCookieStoreValue(cookieStore, SESSION_COOKIE) ||
    readCookieStoreValue(cookieStore, LEGACY_ACCESS_TOKEN_COOKIE)

  return readSessionToken(token)
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

export async function revokeSession(sessionToken: string | undefined): Promise<void> {
  if (!sessionToken) return

  await getDatabaseClient()
    .update(zenAuthSessions)
    .set({
      revokedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(zenAuthSessions.tokenHash, hashToken(sessionToken)))
}
