// Runs the coding evals through zq against a Zenquanta server and records
// pass rate, steps, tokens and raw cost per model.
// Usage: node scripts/evals/run-coding.mjs --models forge,forge-fast [--tasks rename]
// Env: ZQ_HOME (a signed-in zq home), ZQ_APP_URL, DATABASE_URL, EVAL_LOGIN_ID.
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { neon } from '@neondatabase/serverless'

const root = resolve(import.meta.dirname, '../..')
const { values } = parseArgs({
  options: {
    models: { type: 'string', default: 'forge' },
    tasks: { type: 'string' },
    label: { type: 'string' },
  },
})
const models = values.models.split(',')
const tasks = values.tasks ? values.tasks.split(',') : readdirSync(join(root, 'evals/coding'))
const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null
const loginId = process.env.EVAL_LOGIN_ID
const userId =
  sql && loginId ? (await sql`select id from zen_users where login_id = ${loginId}`)[0]?.id : null

async function usageBetween(start, end) {
  if (!userId) return null
  const [row] = await sql`
    select count(*)::int as steps,
           coalesce(sum(prompt_tokens), 0)::int as prompt,
           coalesce(sum(completion_tokens), 0)::int as completion,
           coalesce(sum(total_tokens), 0)::int as billable,
           coalesce(sum(raw_cost_usd), 0)::float8 as cost
    from zen_usage_events
    where user_id = ${userId} and surface = 'cli' and created_at between ${start} and ${end}`
  return row
}

function git(dir, ...args) {
  spawnSync('git', ['-c', 'user.email=eval@zq', '-c', 'user.name=eval', ...args], { cwd: dir })
}

const results = []
for (const model of models) {
  for (const task of tasks) {
    const dir = mkdtempSync(join(tmpdir(), `zq-eval-${task}-`))
    cpSync(join(root, 'evals/coding', task), dir, { recursive: true })
    git(dir, 'init', '-q')
    git(dir, 'add', '.')
    git(dir, 'commit', '-qm', 'task')

    const prompt = readFileSync(join(dir, 'TASK.md'), 'utf8')
    const start = new Date()
    const run = spawnSync(
      'node',
      [join(root, 'packages/zq/dist/cli.js'), '-p', prompt, '--allow-edits', '--model', `zenquanta/${model}`],
      { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', timeout: 300_000 }
    )
    await new Promise((done) => setTimeout(done, 2_000))
    const end = new Date()
    const passed = spawnSync('node', ['check.mjs'], { cwd: dir }).status === 0
    const usage = await usageBetween(start, end)
    const seconds = Math.round((end - start) / 1000)
    results.push({ model, task, passed, seconds, exit: run.status, ...usage })
    console.log(
      `${model.padEnd(11)} ${task.padEnd(15)} ${passed ? 'pass' : 'FAIL'} ${String(seconds).padStart(4)}s ` +
        `steps=${usage?.steps ?? '?'} cost=$${(usage?.cost ?? 0).toFixed(4)}`
    )
  }
}

const summary = models.map((model) => {
  const rows = results.filter((row) => row.model === model)
  const sum = (key) => rows.reduce((total, row) => total + (row[key] ?? 0), 0)
  return {
    model,
    passed: rows.filter((row) => row.passed).length,
    total: rows.length,
    avgCostUsd: Number((sum('cost') / rows.length).toFixed(5)),
    avgBillableTokens: Math.round(sum('billable') / rows.length),
    avgSteps: Number((sum('steps') / rows.length).toFixed(1)),
    avgSeconds: Math.round(sum('seconds') / rows.length),
  }
})
console.table(summary)
mkdirSync(join(root, 'evals/results'), { recursive: true })
const label = values.label ?? models.join('_')
const file = join(root, 'evals/results', `${new Date().toISOString().slice(0, 10)}-coding-${label}.json`)
writeFileSync(file, `${JSON.stringify({ ranAt: new Date().toISOString(), summary, results }, null, 2)}\n`)
console.log(`Saved ${file}`)
