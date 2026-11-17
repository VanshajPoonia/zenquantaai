import { isAbsolute, relative, resolve } from 'node:path'
import type { PermissionMode } from './config.js'
import { hardenGitRead } from './git-safety.js'

export type Decision =
  /** `command` replaces a bash command before it runs. */
  | { action: 'allow'; command?: string }
  | { action: 'ask'; title: string; detail: string; rememberAs?: string }
  | { action: 'block'; reason: string }

const READ_TOOLS = new Set(['read', 'grep', 'find', 'ls'])
const WRITE_TOOLS = new Set(['write', 'edit'])

const PROTECTED_PATHS = [
  /(^|[\\/])\.env(\.[\w-]+)?$/,
  /\.(pem|key|p12|pfx)$/,
  /(^|[\\/])id_[a-z0-9]+(\.pub)?$/,
  /(^|[\\/])\.git([\\/]|$)/,
  /(^|[\\/])\.ssh([\\/]|$)/,
  /(^|[\\/])\.zq[\\/]credentials\.json$/,
  /(^|[\\/])\.(npmrc|netrc|pgpass)$/,
  /(^|[\\/])\.(aws|kube|docker|gnupg)([\\/]|$)/,
]
const PROTECTED_IN_COMMAND = [
  /\.env\b/,
  /\.ssh\//,
  /id_rsa|id_ed25519/,
  /\.pem\b/,
  /credentials\.json/,
  /\.(npmrc|netrc|pgpass)\b/,
  /\.(aws|kube|docker|gnupg)\//,
]
// Chaining, pipes, substitution and redirects can hide a second command behind a safe one.
const SHELL_CONTROL = /[;&|`$<>(){}\\\n\r]/

const DANGEROUS_COMMANDS = [
  /\bsudo\b/,
  /\brm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r)\b/i,
  /\bgit\s+push\b.*(--force\b|\s-f\b)/,
  /\bgit\s+(reset\s+--hard|clean\s+-[a-z]*f)/,
  /\b(curl|wget)\b[^|]*\|\s*(sudo\s+)?(ba|z)?sh\b/,
  /\bmkfs\b/,
  /\bdd\s+if=/,
  /\bchmod\s+-R\s+777\b/,
  />\s*\/dev\/(sd|disk|nvme)/,
]

const SAFE_COMMANDS = [
  /^(ls|pwd|whoami|date|which|echo)(\s|$)/,
  /^git\s+(status|diff|log|show|rev-parse)(\s|$)/,
  /^git\s+branch(\s+(-a|-r|-v|-vv|--list|--show-current))*$/,
  /^(node|npm|pnpm|yarn|bun|python3?|go|cargo|rustc)\s+(-v|--version)$/,
]
// Read-only git commands can still write a file or run a configured program with these.
const UNSAFE_GIT_FLAGS = /\s--(output|ext-diff|textconv)\b/

export function isProtectedPath(path: string): boolean {
  return PROTECTED_PATHS.some((pattern) => pattern.test(path))
}

export function isOutsideProject(path: string, cwd: string): boolean {
  const target = isAbsolute(path) ? path : resolve(cwd, path)
  const fromCwd = relative(cwd, target)
  return fromCwd.startsWith('..') || isAbsolute(fromCwd)
}

/** The first two words of a command, used for "always allow". */
export function commandKey(command: string): string {
  return command.trim().split(/\s+/).slice(0, 2).join(' ')
}

function pathOf(args: Record<string, unknown>): string | null {
  const value = args.path ?? args.file_path ?? args.directory
  return typeof value === 'string' && value.trim() ? value : null
}

export interface DecideInput {
  toolName: string
  args: Record<string, unknown>
  mode: PermissionMode
  allowedCommands: string[]
  cwd: string
  hasUI: boolean
  /** The repo's own git config names a program git could run. */
  gitConfigRisky?: boolean
}

function decideWithUI(input: DecideInput): Decision {
  const { toolName, args, mode, cwd } = input
  if (mode === 'yolo') return { action: 'allow' }

  if (READ_TOOLS.has(toolName)) {
    const path = pathOf(args)
    if (path && (isProtectedPath(path) || isOutsideProject(path, cwd))) {
      return { action: 'ask', title: `Allow ${toolName}?`, detail: `${toolName} ${path} (outside the project or a protected file)` }
    }
    return { action: 'allow' }
  }

  if (WRITE_TOOLS.has(toolName)) {
    const path = pathOf(args) ?? 'a file'
    const sensitive = isProtectedPath(path) || isOutsideProject(path, cwd)
    if (mode === 'edits' && !sensitive) return { action: 'allow' }
    const size = typeof args.content === 'string' ? ` (${args.content.split('\n').length} lines)` : ''
    return {
      action: 'ask',
      title: toolName === 'write' ? 'Write this file?' : 'Apply this edit?',
      detail: `${toolName} ${path}${size}${sensitive ? '. This is outside the project or a protected file.' : ''}`,
    }
  }

  if (toolName === 'bash') {
    const command = typeof args.command === 'string' ? args.command.trim() : ''
    const dangerous = DANGEROUS_COMMANDS.some((pattern) => pattern.test(command))
    const touchesSecrets = PROTECTED_IN_COMMAND.some((pattern) => pattern.test(command))
    const isGit = /^git\s/.test(command)
    const riskyGit = isGit && input.gitConfigRisky === true
    const canSkipPrompt =
      !dangerous &&
      !touchesSecrets &&
      !riskyGit &&
      !SHELL_CONTROL.test(command) &&
      !UNSAFE_GIT_FLAGS.test(command)
    if (canSkipPrompt) {
      if (SAFE_COMMANDS.some((pattern) => pattern.test(command))) {
        return isGit ? { action: 'allow', command: hardenGitRead(command) } : { action: 'allow' }
      }
      if (input.allowedCommands.includes(commandKey(command))) return { action: 'allow' }
    }
    return {
      action: 'ask',
      title: dangerous ? 'Run this risky command?' : 'Run this command?',
      detail: riskyGit ? `${command}\nThis repo's git config can run programs, so git commands need approval.` : command,
      rememberAs: canSkipPrompt ? commandKey(command) : undefined,
    }
  }

  return { action: 'ask', title: `Allow ${toolName}?`, detail: JSON.stringify(args).slice(0, 300) }
}

/** Decides whether a tool call runs, needs the user or is blocked (print mode). */
export function decide(input: DecideInput): Decision {
  const decision = decideWithUI(input)
  if (decision.action === 'ask' && !input.hasUI) {
    return {
      action: 'block',
      reason: `Needs approval: ${decision.detail}. Rerun with --allow-edits or --yolo to allow it.`,
    }
  }
  return decision
}
