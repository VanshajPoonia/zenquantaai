#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { apiFetch, type MeResponse } from './api.js'
import { readCredentials, setOpenRouterKey } from './config.js'
import { login, logout } from './login.js'
import { preparePiOverlay } from './overlay.js'
import { AGENT_DIR } from './paths.js'

const BYOK_MODEL = 'qwen/qwen3-coder'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }

function ensureAgentSettings() {
  const path = join(AGENT_DIR, 'settings.json')
  if (existsSync(path)) return
  mkdirSync(AGENT_DIR, { recursive: true })
  writeFileSync(
    path,
    `${JSON.stringify({ defaultProvider: 'zenquanta', defaultModel: 'forge', quietStartup: 'header' }, null, 2)}\n`
  )
}

async function run() {
  const argv = process.argv.slice(2)
  const command = argv[0]

  if (command === 'login') return login()
  if (command === 'logout') return logout()
  if (command === 'key') {
    const value = argv[1]?.trim()
    if (!value) throw new Error('Usage: zq key <openrouter-key>, or zq key --clear')
    setOpenRouterKey(value === '--clear' ? null : value)
    process.stdout.write(value === '--clear' ? 'OpenRouter key removed.\n' : 'OpenRouter key saved in ~/.zq/credentials.json.\n')
    return
  }
  if (command === '--version' || command === '-v') {
    process.stdout.write(`zq ${pkg.version} (built on pi, https://pi.dev)\n`)
    return
  }

  const yolo = argv.includes('--yolo')
  const allowEdits = argv.includes('--allow-edits')
  const piArgs = argv.filter((arg) => arg !== '--yolo' && arg !== '--allow-edits')

  if (!readCredentials()) {
    if (!process.stdin.isTTY) throw new Error('Not signed in. Run `zq login` first.')
    await login()
  }

  const credentials = readCredentials()
  const me = await apiFetch<MeResponse>('/api/cli/me').catch(() => null)
  const modelSource = me?.modelApi === false ? 'openrouter' : 'zenquanta'
  if (modelSource === 'openrouter') {
    if (!credentials?.openrouterKey) {
      throw new Error(
        'Hosted zq models are not open yet. Add your own OpenRouter key with `zq key <key>` (https://openrouter.ai/keys), then run zq again.'
      )
    }
    process.env.OPENROUTER_API_KEY = credentials.openrouterKey
    if (!piArgs.includes('--model') && !piArgs.includes('--provider')) {
      piArgs.push('--provider', 'openrouter', '--model', BYOK_MODEL)
    }
  }

  ensureAgentSettings()
  // pi names this variable after the app, so `zq` reads ZQ_CODING_AGENT_DIR.
  process.env.ZQ_CODING_AGENT_DIR = AGENT_DIR
  preparePiOverlay(pkg.version)
  const { main } = await import('@earendil-works/pi-coding-agent')
  const { createZenquantaExtension } = await import('./extension.js')
  await main(piArgs, {
    extensionFactories: [
      {
        name: 'zenquanta',
        hidden: true,
        factory: createZenquantaExtension({ yolo, allowEdits, modelSource, me }),
      },
    ],
  })
}

run().catch((error: unknown) => {
  process.stderr.write(`zq: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
