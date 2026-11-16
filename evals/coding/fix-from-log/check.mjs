import { readFileSync } from 'node:fs'
import { slugify } from './slug.js'
const testUnchanged = readFileSync('./slug.test.mjs', 'utf8').includes("'hello-big-world'")
const ok = testUnchanged && slugify('Hello Big World') === 'hello-big-world' && slugify('A  B') !== undefined
process.exit(ok ? 0 : 1)
