import { homedir } from 'node:os'
import { join } from 'node:path'

export const ZQ_HOME = process.env.ZQ_HOME?.trim() || join(homedir(), '.zq')
export const CREDENTIALS_PATH = join(ZQ_HOME, 'credentials.json')
export const SETTINGS_PATH = join(ZQ_HOME, 'settings.json')
export const OUTBOX_DIR = join(ZQ_HOME, 'outbox')
export const RUNTIME_DIR = join(ZQ_HOME, 'runtime')
export const AGENT_DIR = join(ZQ_HOME, 'agent')
export const PROJECT_SETTINGS_FILE = join('.zq', 'settings.json')

export const DEFAULT_APP_URL = 'https://zqai.vercel.app'
