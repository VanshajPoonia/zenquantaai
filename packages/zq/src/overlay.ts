import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { RUNTIME_DIR } from './paths.js'

/**
 * pi reads its name and config folder from its package.json. zq points pi at
 * a small overlay folder: links to pi's files plus a package.json that names
 * the app `zq` with a `.zq` config folder. No pi code is changed.
 */
export function preparePiOverlay(zqVersion: string): void {
  const piEntry = fileURLToPath(import.meta.resolve('@earendil-works/pi-coding-agent'))
  const piDir = dirname(dirname(piEntry))
  const piPackage = JSON.parse(readFileSync(join(piDir, 'package.json'), 'utf8')) as Record<string, unknown>
  const overlay = join(RUNTIME_DIR, `${zqVersion}-pi${String(piPackage.version)}`)

  if (!existsSync(join(overlay, 'package.json'))) {
    mkdirSync(overlay, { recursive: true })
    for (const entry of readdirSync(piDir)) {
      if (entry === 'package.json' || entry === 'node_modules') continue
      const source = join(piDir, entry)
      const target = join(overlay, entry)
      if (existsSync(target)) continue
      if (statSync(source).isDirectory()) symlinkSync(source, target, 'junction')
      else copyFileSync(source, target)
    }
    writeFileSync(
      join(overlay, 'package.json'),
      JSON.stringify({
        ...piPackage,
        name: 'zenquanta',
        version: zqVersion,
        piConfig: { name: 'zq', configDir: '.zq' },
      })
    )
  }

  process.env.PI_PACKAGE_DIR = overlay
}
