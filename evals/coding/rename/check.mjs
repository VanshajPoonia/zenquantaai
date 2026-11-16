import { readFileSync } from 'node:fs'
const source = readFileSync('./user.js', 'utf8') + readFileSync('./greet.js', 'utf8')
const { greet } = await import('./greet.js')
const { getDisplayName } = await import('./user.js')
const ok = !source.includes('getUserName') && typeof getDisplayName === 'function' && greet({ name: 'Ada' }) === 'Hello, Ada!'
process.exit(ok ? 0 : 1)
