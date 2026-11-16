import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { apiFetch } from './api.js'
import { isProtectedPath } from './permissions.js'
import { OUTBOX_DIR } from './paths.js'

type Part =
  | { type: 'text'; text: string }
  | { type: 'tool_call'; callId: string; name: string; label: string; args: unknown }
  | { type: 'tool_result'; callId: string; name: string; ok: boolean; summary: string; output?: string }

export interface SyncEntry {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  model?: string
  parts?: Part[]
}

interface PiContentBlock {
  type: string
  text?: string
  id?: string
  name?: string
  arguments?: unknown
}

interface PiMessageLike {
  role: string
  content?: string | PiContentBlock[]
  timestamp?: number
  toolCallId?: string
  toolName?: string
  isError?: boolean
  model?: string
}

const MAX_OUTPUT = 4_000

function textOf(content: PiMessageLike['content']): string {
  if (typeof content === 'string') return content
  return (content ?? []).map((block) => (block.type === 'text' ? block.text ?? '' : '')).join('')
}

function git(cwd: string, args: string[]): string | undefined {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 2_000 })
  return result.status === 0 ? result.stdout.trim() || undefined : undefined
}

function touchesSecrets(args: unknown): boolean {
  if (!args || typeof args !== 'object') return false
  const value = args as Record<string, unknown>
  const path = value.path ?? value.file_path
  if (typeof path === 'string' && isProtectedPath(path)) return true
  return typeof value.command === 'string' && /\.env\b|\.ssh\/|id_rsa|\.pem\b/.test(value.command)
}

/** Mirrors one pi session into the Zenquanta web history. Failures never block the agent. */
export class SessionSync {
  private sessionId: string | null = null
  private created = false
  private title: string | null = null
  private turn: SyncEntry | null = null
  private pending = new Map<string, SyncEntry>()
  private argsByCall = new Map<string, unknown>()
  private timer: NodeJS.Timeout | null = null

  constructor(
    private readonly cwd: string,
    private readonly isEnabled: () => boolean
  ) {}

  start(sessionId: string) {
    this.sessionId = sessionId
    this.created = false
    this.turn = null
    this.pending.clear()
    void this.retryOutbox()
  }

  record(message: PiMessageLike) {
    if (!this.sessionId || !this.isEnabled()) return
    const createdAt = new Date(message.timestamp ?? Date.now()).toISOString()

    if (message.role === 'user') {
      const content = textOf(message.content)
      if (!content.trim()) return
      this.title ??= content.replace(/\s+/g, ' ').trim().slice(0, 80)
      this.turn = null
      this.queue({ id: `u${message.timestamp ?? Date.now()}`, role: 'user', content, createdAt })
      return
    }

    if (message.role === 'assistant') {
      this.turn ??= { id: `a${message.timestamp ?? Date.now()}`, role: 'assistant', content: '', createdAt, parts: [] }
      for (const block of Array.isArray(message.content) ? message.content : []) {
        if (block.type === 'text' && block.text) {
          this.turn.content += (this.turn.content ? '\n\n' : '') + block.text
          this.turn.parts?.push({ type: 'text', text: block.text })
        } else if (block.type === 'toolCall' && block.id && block.name) {
          this.argsByCall.set(block.id, block.arguments)
          this.turn.parts?.push({ type: 'tool_call', callId: block.id, name: block.name, label: block.name, args: block.arguments ?? {} })
        }
      }
      if (message.model) this.turn.model = 'forge'
      this.queue(this.turn)
      return
    }

    if (message.role === 'toolResult' && this.turn && message.toolCallId) {
      const output = textOf(message.content)
      const hidden = touchesSecrets(this.argsByCall.get(message.toolCallId))
      this.turn.parts?.push({
        type: 'tool_result',
        callId: message.toolCallId,
        name: message.toolName ?? 'tool',
        ok: !message.isError,
        summary: (output.split('\n')[0] || (message.isError ? 'Failed' : 'Done')).slice(0, 160),
        output: hidden ? '[hidden: protected file]' : output.slice(0, MAX_OUTPUT),
      })
      this.queue(this.turn)
    }
  }

  private queue(entry: SyncEntry) {
    this.pending.set(entry.id, structuredClone(entry))
    this.timer ??= setTimeout(() => void this.flush(), 2_000)
  }

  async flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    if (!this.sessionId || this.pending.size === 0) return
    const sessionId = this.sessionId
    const entries = [...this.pending.values()]
    this.pending.clear()

    try {
      await this.send(sessionId, entries)
    } catch {
      this.saveOutbox(sessionId, entries)
    }
  }

  private async send(sessionId: string, entries: SyncEntry[]) {
    if (!this.created || sessionId !== this.sessionId) {
      await apiFetch('/api/cli/sessions', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          title: this.title ?? undefined,
          workspace: {
            repo: basename(git(this.cwd, ['rev-parse', '--show-toplevel']) ?? this.cwd),
            branch: git(this.cwd, ['rev-parse', '--abbrev-ref', 'HEAD']),
          },
        }),
      })
      if (sessionId === this.sessionId) this.created = true
    }
    for (let index = 0; index < entries.length; index += 50) {
      await apiFetch(`/api/cli/sessions/${encodeURIComponent(sessionId)}/entries`, {
        method: 'POST',
        body: JSON.stringify({ entries: entries.slice(index, index + 50) }),
      })
    }
  }

  private saveOutbox(sessionId: string, entries: SyncEntry[]) {
    mkdirSync(OUTBOX_DIR, { recursive: true })
    const path = join(OUTBOX_DIR, `${sessionId}.json`)
    const existing = existsSync(path)
      ? (JSON.parse(readFileSync(path, 'utf8')) as SyncEntry[])
      : []
    const merged = new Map(existing.map((entry) => [entry.id, entry]))
    for (const entry of entries) merged.set(entry.id, entry)
    writeFileSync(path, JSON.stringify([...merged.values()]))
  }

  private async retryOutbox() {
    if (!existsSync(OUTBOX_DIR) || !this.isEnabled()) return
    for (const file of readdirSync(OUTBOX_DIR).filter((name) => name.endsWith('.json'))) {
      const path = join(OUTBOX_DIR, file)
      try {
        const entries = JSON.parse(readFileSync(path, 'utf8')) as SyncEntry[]
        await this.send(file.slice(0, -5), entries)
        rmSync(path)
      } catch {
        return
      }
    }
  }
}
