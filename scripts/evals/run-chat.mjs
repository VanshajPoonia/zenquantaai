// Runs the chat tool evals against /api/chat with AGENT_LOOP on and checks
// that each task used the expected tool (or none) and answered correctly.
// Usage: node scripts/evals/run-chat.mjs [--tasks web-f1,none-math] [--label free]
// Env: EVAL_APP_URL, EVAL_LOGIN_ID, EVAL_PASSWORD, DATABASE_URL (for cost).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { neon } from '@neondatabase/serverless'

const root = resolve(import.meta.dirname, '../..')
const { values } = parseArgs({ options: { tasks: { type: 'string' }, label: { type: 'string', default: 'chat' } } })
const appUrl = process.env.EVAL_APP_URL ?? 'http://localhost:3000'
const allTasks = JSON.parse(readFileSync(join(root, 'evals/chat/tasks.json'), 'utf8'))
const tasks = values.tasks ? allTasks.filter((task) => values.tasks.split(',').includes(task.id)) : allTasks
const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null

const signIn = await fetch(`${appUrl}/api/auth/password/sign-in`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: process.env.EVAL_LOGIN_ID, password: process.env.EVAL_PASSWORD }),
})
const cookie = (signIn.headers.getSetCookie?.() ?? [])
  .map((value) => value.split(';')[0])
  .filter((value) => value.startsWith('zenquanta-session-token='))
  .join('; ')
if (!cookie) throw new Error(`Sign-in failed (${signIn.status}).`)
const userId = (await signIn.json()).user?.id

async function upload(file, index) {
  const form = new FormData()
  const meta = {
    id: `eval-${Date.now()}-${index}`,
    name: file.name,
    mimeType: 'text/plain',
    size: file.text.length,
    createdAt: new Date().toISOString(),
    kind: 'text',
  }
  form.set('metadata', JSON.stringify([meta]))
  form.append('files', new Blob([file.text], { type: 'text/plain' }), file.name)
  const response = await fetch(`${appUrl}/api/attachments`, { method: 'POST', headers: { cookie }, body: form })
  if (!response.ok) throw new Error(`Upload failed (${response.status}).`)
  return (await response.json())[0]
}

const results = []
for (const [index, task] of tasks.entries()) {
  const attachments = task.file ? [await upload(task.file, index)] : undefined
  const start = new Date()
  const response = await fetch(`${appUrl}/api/chat`, {
    method: 'POST',
    headers: { cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'send', mode: task.mode, content: task.prompt, attachments, timeZone: 'UTC' }),
  })
  const tools = []
  let text = ''
  let error = null
  for (const line of (await response.text()).split('\n')) {
    if (!line.trim()) continue
    const event = JSON.parse(line)
    if (event.type === 'tool_call') tools.push(event.name)
    if (event.type === 'delta') text += event.delta
    if (event.type === 'error' || event.error) error = event.error
  }
  const end = new Date()
  const toolOk = task.expectTool ? tools.includes(task.expectTool) : tools.length === 0
  const answerOk = new RegExp(task.answer).test(text)
  let cost = null
  if (sql && userId) {
    const [row] = await sql`select coalesce(sum(raw_cost_usd), 0)::float8 as cost, count(*)::int as steps
      from zen_usage_events where user_id = ${userId} and created_at between ${start} and ${new Date(end.getTime() + 1000)}`
    cost = row
  }
  const passed = toolOk && answerOk && !error
  results.push({ id: task.id, passed, toolOk, answerOk, tools, error, seconds: Math.round((end - start) / 1000), ...cost })
  console.log(
    `${task.id.padEnd(20)} ${passed ? 'pass' : 'FAIL'} tools=[${tools.join(',')}] ` +
      `steps=${cost?.steps ?? '?'} cost=$${(cost?.cost ?? 0).toFixed(4)}${error ? ` error=${error}` : ''}`
  )
}

const passed = results.filter((row) => row.passed).length
const summary = {
  passed,
  total: results.length,
  avgCostUsd: Number((results.reduce((sum, row) => sum + (row.cost ?? 0), 0) / results.length).toFixed(5)),
  avgSteps: Number((results.reduce((sum, row) => sum + (row.steps ?? 0), 0) / results.length).toFixed(1)),
}
console.log(summary)
mkdirSync(join(root, 'evals/results'), { recursive: true })
const file = join(root, 'evals/results', `${new Date().toISOString().slice(0, 10)}-chat-${values.label}.json`)
writeFileSync(file, `${JSON.stringify({ ranAt: new Date().toISOString(), summary, results }, null, 2)}\n`)
console.log(`Saved ${file}`)
