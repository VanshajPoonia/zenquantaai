import { spawn } from 'node:child_process'
import { hostname } from 'node:os'
import { apiFetch } from './api.js'
import { deleteCredentials, getAppUrl, readCredentials, writeCredentials } from './config.js'

interface DeviceResponse {
  device_code: string
  user_code: string
  verification_url_complete: string
  interval: number
  expires_in: number
}

function openBrowser(url: string) {
  const command =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open'
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url]
  try {
    spawn(command, args, { stdio: 'ignore', detached: true }).unref()
  } catch {
    // The URL is printed too, so a missing opener is fine.
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Browser device login. Prints a code, waits for approval and saves the token. */
export async function login(): Promise<void> {
  const appUrl = getAppUrl()
  const device = await fetch(`${appUrl}/api/cli/device`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientName: `zq on ${hostname()}` }),
  }).then(async (response) => {
    if (!response.ok) throw new Error(`Could not start login (${response.status}).`)
    return (await response.json()) as DeviceResponse
  })

  process.stdout.write(
    `\nOpen this link and approve the code ${device.user_code}:\n  ${device.verification_url_complete}\n\nWaiting for approval...`
  )
  openBrowser(device.verification_url_complete)

  const deadline = Date.now() + device.expires_in * 1000
  let interval = device.interval * 1000
  while (Date.now() < deadline) {
    await sleep(interval)
    const response = await fetch(`${appUrl}/api/cli/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_code: device.device_code }),
    })
    const body = (await response.json().catch(() => ({}))) as {
      access_token?: string
      login_id?: string | null
      error?: string
    }
    if (body.access_token) {
      writeCredentials({
        token: body.access_token,
        appUrl,
        loginId: body.login_id ?? null,
        openrouterKey: readCredentials()?.openrouterKey ?? null,
      })
      process.stdout.write(`\nSigned in${body.login_id ? ` as ${body.login_id}` : ''}.\n`)
      return
    }
    if (body.error === 'slow_down') interval += 2_000
    else if (body.error === 'access_denied') throw new Error('Login was denied in the browser.')
    else if (body.error && body.error !== 'authorization_pending') {
      throw new Error('The login code expired. Run `zq login` again.')
    }
  }
  throw new Error('The login code expired. Run `zq login` again.')
}

export async function logout(): Promise<void> {
  if (readCredentials()) {
    await apiFetch('/api/cli/logout', { method: 'POST' }).catch(() => undefined)
  }
  deleteCredentials()
  process.stdout.write('Signed out.\n')
}
