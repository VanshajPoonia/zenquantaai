import { parseAge } from './age.js'
const throws = (value) => { try { parseAge(value); return false } catch { return true } }
const ok = parseAge('42') === 42 && parseAge('0') === 0 && throws('-1') && throws('abc') && throws('151') && throws('4.5')
process.exit(ok ? 0 : 1)
