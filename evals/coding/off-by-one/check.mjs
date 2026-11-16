import { sumRange } from './range.js'
const ok = sumRange(1, 4) === 10 && sumRange(5, 5) === 5 && sumRange(0, 0) === 0
process.exit(ok ? 0 : 1)
