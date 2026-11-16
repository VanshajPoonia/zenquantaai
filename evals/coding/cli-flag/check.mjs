import { execFileSync } from 'node:child_process'
const run = (...args) => execFileSync('node', ['cli.js', ...args], { encoding: 'utf8' }).trim()
const ok = run('Ada') === 'hello, Ada' && (run('Ada', '--shout') === 'HELLO, ADA' || run('--shout', 'Ada') === 'HELLO, ADA')
process.exit(ok ? 0 : 1)
