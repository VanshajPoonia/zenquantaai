import { readFileSync } from 'node:fs'
const readme = readFileSync('./README.md', 'utf8')
const ok = /^## Usage/m.test(readme) && readme.includes('formatPrice') && readme.includes('```')
process.exit(ok ? 0 : 1)
