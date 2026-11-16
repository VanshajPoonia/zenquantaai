import { getAppUrl, readCredentials } from './config.js'

export interface MeResponse {
  loginId: string | null
  plan: string
  cliAccess: boolean
  modelApi: boolean
  models: string[]
  coreTokens: { included: number; used: number; left: number }
  tierTokens: { included: number; used: number; left: number }
  agentSteps: { included: number; used: number; left: number }
  maxStepsPerRun: number
  maxAgentInputTokens: number
  maxAgentOutputTokens: number
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const credentials = readCredentials()
  const response = await fetch(`${getAppUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(credentials ? { Authorization: `Bearer ${credentials.token}` } : {}),
      ...init.headers,
    },
    signal: init.signal ?? AbortSignal.timeout(20_000),
  })
  const body = (await response.json().catch(() => null)) as
    | (T & { error?: string | { message?: string } })
    | null
  if (!response.ok) {
    const error = body?.error
    const message = typeof error === 'string' ? error : error?.message ?? `Request failed (${response.status}).`
    throw new ApiError(message, response.status)
  }
  return body as T
}
