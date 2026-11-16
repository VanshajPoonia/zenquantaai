#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { readCredentials } from './config.js'
import { login, logout } from './login.js'
import { preparePiOverlay } from './overlay.js'
import { AGENT_DIR } from './paths.js'

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

  ensureAgentSettings()
  // pi names this variable after the app, so `zq` reads ZQ_CODING_AGENT_DIR.
  process.env.ZQ_CODING_AGENT_DIR = AGENT_DIR
  preparePiOverlay(pkg.version)
  const { main } = await import('@earendil-works/pi-coding-agent')
  const { createZenquantaExtension } = await import('./extension.js')
  await main(piArgs, {
    extensionFactories: [
      { name: 'zenquanta', hidden: true, factory: createZenquantaExtension({ yolo, allowEdits }) },
    ],
  })
}

run().catch((error: unknown) => {
  process.stderr.write(`zq: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
