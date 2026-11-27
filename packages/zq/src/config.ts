import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { CREDENTIALS_PATH, DEFAULT_APP_URL, PROJECT_SETTINGS_FILE, SETTINGS_PATH } from './paths.js'

export type PermissionMode = 'ask' | 'edits' | 'yolo'

export interface Credentials {
  token: string
  appUrl: string
  loginId: string | null
  /** The user's own OpenRouter key, used when hosted zq models are not open. Never sent to Zenquanta. */
  openrouterKey?: string | null
}

export interface ZqSettings {
  permissionMode: PermissionMode
  allowedCommands: string[]
  sync: boolean
  /** Also send permission prompts to the web app. Off unless the user runs `/remote on`. */
  remoteApprovals: boolean
}

const DEFAULT_SETTINGS: ZqSettings = {
  permissionMode: 'ask',
  allowedCommands: [],
  sync: true,
  remoteApprovals: false,
}

function readJson<T>(path: string): Partial<T> | null {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Partial<T>
  } catch {
    return null
  }
}

function writeJson(path: string, value: unknown, mode?: number) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, mode ? { mode } : undefined)
  if (mode) chmodSync(path, mode)
}

export function getAppUrl(): string {
  return (process.env.ZQ_APP_URL?.trim() || readCredentials()?.appUrl || DEFAULT_APP_URL).replace(/\/$/, '')
}

export function readCredentials(): Credentials | null {
  const value = readJson<Credentials>(CREDENTIALS_PATH)
  return value?.token
    ? {
        token: value.token,
        appUrl: value.appUrl ?? DEFAULT_APP_URL,
        loginId: value.loginId ?? null,
        openrouterKey: value.openrouterKey ?? null,
      }
    : null
}

export function writeCredentials(credentials: Credentials) {
  writeJson(CREDENTIALS_PATH, credentials, 0o600)
}

export function setOpenRouterKey(key: string | null) {
  const current = readCredentials()
  if (!current) throw new Error('Run `zq login` first.')
  writeCredentials({ ...current, openrouterKey: key })
}

export function deleteCredentials() {
  if (existsSync(CREDENTIALS_PATH)) rmSync(CREDENTIALS_PATH)
}

/** Global settings merged with the project's `.zq/settings.json`. Projects can only turn sync off, never approvals on. */
export function readSettings(cwd: string): ZqSettings {
  const global = { ...DEFAULT_SETTINGS, ...readJson<ZqSettings>(SETTINGS_PATH) }
  const project = readJson<ZqSettings>(join(cwd, PROJECT_SETTINGS_FILE))
  return {
    permissionMode: global.permissionMode,
    allowedCommands: Array.isArray(global.allowedCommands) ? global.allowedCommands : [],
    sync: global.sync !== false && project?.sync !== false,
    remoteApprovals: global.remoteApprovals === true,
  }
}

export function updateGlobalSettings(patch: Partial<ZqSettings>) {
  const current = { ...DEFAULT_SETTINGS, ...readJson<ZqSettings>(SETTINGS_PATH) }
  writeJson(SETTINGS_PATH, { ...current, ...patch })
}

export function setProjectSync(cwd: string, sync: boolean) {
  const path = join(cwd, PROJECT_SETTINGS_FILE)
  writeJson(path, { ...readJson<ZqSettings>(path), sync })
}
