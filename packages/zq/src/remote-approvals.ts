import { apiFetch } from './api.js'

export type RemoteApprovalStatus = 'pending' | 'approved' | 'denied' | 'expired' | 'answered_locally'

export interface RemoteApprovalRequest {
  sessionId: string
  tool: string
  title: string
  detail: string
}

export interface RemoteApprovalClient {
  create(request: RemoteApprovalRequest): Promise<{ id: string }>
  status(id: string): Promise<RemoteApprovalStatus>
  close(id: string, status: 'answered_locally' | 'expired'): Promise<void>
}

export type ApprovalOutcome =
  | { source: 'local'; choice: string | undefined }
  | { source: 'web'; approved: boolean }

export interface RaceApprovalOptions {
  request: RemoteApprovalRequest
  /** Shows the terminal prompt. It must resolve, with undefined, once the signal aborts. */
  askLocal: (signal: AbortSignal) => Promise<string | undefined>
  client: RemoteApprovalClient
  /** The agent run's signal. Aborting it ends both sides and never approves. */
  signal?: AbortSignal
  intervalMs?: number
  maxPollErrors?: number
  onRemoteUnavailable?: (error: unknown) => void
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>
}

export const REMOTE_TITLE_MAX = 200
export const REMOTE_DETAIL_MAX = 4_000
const REQUEST_TIMEOUT_MS = 5_000

export const httpApprovalClient: RemoteApprovalClient = {
  create: (request) =>
    apiFetch<{ id: string }>('/api/cli/approvals', {
      method: 'POST',
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }),
  status: async (id) =>
    (
      await apiFetch<{ status: RemoteApprovalStatus }>(`/api/cli/approvals/${encodeURIComponent(id)}`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    ).status,
  close: async (id, status) => {
    await apiFetch(`/api/cli/approvals/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  },
}

/** The server refuses longer text rather than cut a command, so those prompts stay in the terminal. */
export function fitsRemoteApproval(request: Pick<RemoteApprovalRequest, 'title' | 'detail'>): boolean {
  return (
    request.title.trim().length > 0 &&
    request.title.trim().length <= REMOTE_TITLE_MAX &&
    request.detail.trim().length > 0 &&
    request.detail.length <= REMOTE_DETAIL_MAX
  )
}

function sleepFor(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve()
    const done = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      resolve()
    }
    const timer = setTimeout(done, ms)
    signal.addEventListener('abort', done, { once: true })
  })
}

/**
 * Shows the terminal prompt and asks the web at the same time. The first answer wins and the
 * other side is closed. The web only approves once. Errors and expiry leave the terminal prompt.
 */
export async function raceApproval(options: RaceApprovalOptions): Promise<ApprovalOutcome> {
  const intervalMs = options.intervalMs ?? 2_000
  const maxPollErrors = options.maxPollErrors ?? 3
  const sleep = options.sleep ?? sleepFor
  const dialog = new AbortController()
  const polling = new AbortController()
  let closeAs: 'answered_locally' | 'expired' = 'answered_locally'
  const onAbort = () => {
    closeAs = 'expired'
    dialog.abort()
    polling.abort()
  }
  if (options.signal?.aborted) onAbort()
  else options.signal?.addEventListener('abort', onAbort, { once: true })

  const local = options
    .askLocal(dialog.signal)
    .then((choice): ApprovalOutcome => ({ source: 'local', choice }))

  const web = (async (): Promise<ApprovalOutcome | null> => {
    let id: string
    try {
      id = (await options.client.create(options.request)).id
    } catch (error) {
      if (!polling.signal.aborted) options.onRemoteUnavailable?.(error)
      return null
    }

    let errors = 0
    while (!polling.signal.aborted) {
      await sleep(intervalMs, polling.signal)
      if (polling.signal.aborted) break
      try {
        const status = await options.client.status(id)
        errors = 0
        if (status === 'approved' || status === 'denied') {
          return { source: 'web', approved: status === 'approved' }
        }
        if (status !== 'pending') return null
      } catch (error) {
        errors += 1
        if (errors >= maxPollErrors) {
          options.onRemoteUnavailable?.(error)
          return null
        }
      }
    }
    // The terminal answered or the run stopped, so the web card goes away.
    await options.client.close(id, closeAs).catch(() => undefined)
    return null
  })()

  try {
    // Dropping out of the race (null) leaves the terminal prompt as the only answer.
    const winner = await Promise.race([
      local,
      web.then((outcome) => outcome ?? new Promise<never>(() => undefined)),
    ])
    // pi closes its dialog as soon as the signal aborts.
    if (winner.source === 'web') dialog.abort()
    else polling.abort()
    return winner
  } finally {
    options.signal?.removeEventListener('abort', onAbort)
  }
}
