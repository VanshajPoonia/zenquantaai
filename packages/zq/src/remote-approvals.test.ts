import { describe, expect, it, vi } from 'vitest'
import {
  fitsRemoteApproval,
  raceApproval,
  type RemoteApprovalClient,
  type RemoteApprovalStatus,
} from './remote-approvals.js'

const request = { sessionId: 's-1', tool: 'bash', title: 'Run this command?', detail: 'npm test' }
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => (resolve = done))
  return { promise, resolve }
}

/** A terminal prompt that answers when told to, or closes when its signal aborts. */
function fakePrompt() {
  const answer = deferred<string | undefined>()
  let signal: AbortSignal | null = null
  const askLocal = vi.fn((dialogSignal: AbortSignal) => {
    signal = dialogSignal
    dialogSignal.addEventListener('abort', () => answer.resolve(undefined), { once: true })
    return answer.promise
  })
  return { askLocal, answer: answer.resolve, aborted: () => signal?.aborted === true }
}

function fakeClient(statuses: Array<RemoteApprovalStatus | Error>, created: Promise<{ id: string }> = Promise.resolve({ id: 'ap-1' })) {
  const client = {
    create: vi.fn(() => created),
    status: vi.fn(async () => {
      const next = statuses.length > 1 ? statuses.shift()! : statuses[0]
      if (next instanceof Error) throw next
      return next
    }),
    close: vi.fn(async () => undefined),
  } satisfies RemoteApprovalClient
  return client
}

const fast = { intervalMs: 1, sleep: () => tick() }

describe('remote approvals race', () => {
  it('uses the terminal answer when it comes first and closes the web card', async () => {
    const prompt = fakePrompt()
    const client = fakeClient(['pending'])
    const result = raceApproval({ request, askLocal: prompt.askLocal, client, ...fast })
    await tick()
    prompt.answer('Yes')

    expect(await result).toEqual({ source: 'local', choice: 'Yes' })
    await vi.waitFor(() => expect(client.close).toHaveBeenCalledWith('ap-1', 'answered_locally'))
  })

  it('takes a web approval and closes the terminal prompt', async () => {
    const prompt = fakePrompt()
    const client = fakeClient(['pending', 'approved'])

    const result = await raceApproval({ request, askLocal: prompt.askLocal, client, ...fast })

    expect(result).toEqual({ source: 'web', approved: true })
    expect(prompt.aborted()).toBe(true)
    expect(client.close).not.toHaveBeenCalled()
  })

  it('takes a web denial', async () => {
    const prompt = fakePrompt()
    const result = await raceApproval({ request, askLocal: prompt.askLocal, client: fakeClient(['denied']), ...fast })
    expect(result).toEqual({ source: 'web', approved: false })
  })

  it('falls back to the terminal when Zenquanta cannot be reached', async () => {
    const prompt = fakePrompt()
    const client = fakeClient(['pending'], Promise.reject(new Error('offline')))
    const onRemoteUnavailable = vi.fn()
    const result = raceApproval({ request, askLocal: prompt.askLocal, client, onRemoteUnavailable, ...fast })
    await tick()

    expect(onRemoteUnavailable).toHaveBeenCalledTimes(1)
    expect(prompt.aborted()).toBe(false)
    prompt.answer('No')
    expect(await result).toEqual({ source: 'local', choice: 'No' })
  })

  it('never approves on expiry and leaves the terminal prompt open', async () => {
    const prompt = fakePrompt()
    const client = fakeClient(['pending', 'expired'])
    const result = raceApproval({ request, askLocal: prompt.askLocal, client, ...fast })
    await vi.waitFor(() => expect(client.status).toHaveBeenCalledTimes(2))
    await tick()

    expect(prompt.aborted()).toBe(false)
    prompt.answer('No')
    expect(await result).toEqual({ source: 'local', choice: 'No' })
  })

  it('rides out a short network blip but gives up after repeated errors', async () => {
    const blip = fakePrompt()
    const recovered = await raceApproval({
      request,
      askLocal: blip.askLocal,
      client: fakeClient([new Error('timeout'), 'pending', 'approved']),
      ...fast,
    })
    expect(recovered).toEqual({ source: 'web', approved: true })

    const down = fakePrompt()
    const client = fakeClient([new Error('timeout')])
    const onRemoteUnavailable = vi.fn()
    const result = raceApproval({ request, askLocal: down.askLocal, client, onRemoteUnavailable, maxPollErrors: 3, ...fast })
    await vi.waitFor(() => expect(onRemoteUnavailable).toHaveBeenCalledTimes(1))
    expect(client.status).toHaveBeenCalledTimes(3)
    down.answer('Yes')
    expect(await result).toEqual({ source: 'local', choice: 'Yes' })
  })

  it('marks the approval expired when the run stops, without approving', async () => {
    const prompt = fakePrompt()
    const client = fakeClient(['pending'])
    const run = new AbortController()
    const result = raceApproval({ request, askLocal: prompt.askLocal, client, signal: run.signal, ...fast })
    await tick()
    run.abort()

    expect(await result).toEqual({ source: 'local', choice: undefined })
    expect(prompt.aborted()).toBe(true)
    await vi.waitFor(() => expect(client.close).toHaveBeenCalledWith('ap-1', 'expired'))
  })

  it('closes an approval that was created after the terminal already answered', async () => {
    const prompt = fakePrompt()
    const created = deferred<{ id: string }>()
    const client = fakeClient(['approved'], created.promise)
    const result = raceApproval({ request, askLocal: prompt.askLocal, client, ...fast })
    prompt.answer('No')

    expect(await result).toEqual({ source: 'local', choice: 'No' })
    created.resolve({ id: 'late' })
    await vi.waitFor(() => expect(client.close).toHaveBeenCalledWith('late', 'answered_locally'))
    expect(client.status).not.toHaveBeenCalled()
  })

  it('keeps long prompts in the terminal', () => {
    expect(fitsRemoteApproval(request)).toBe(true)
    expect(fitsRemoteApproval({ title: request.title, detail: 'x'.repeat(4_001) })).toBe(false)
    expect(fitsRemoteApproval({ title: 'x'.repeat(201), detail: 'ls' })).toBe(false)
  })
})
