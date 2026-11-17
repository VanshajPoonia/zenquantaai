import { readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'

/** Overrides that stop a repo's own git config from running a program during a read. */
export const SAFE_GIT_ARGS = [
  '-c',
  'core.fsmonitor=false',
  '-c',
  'core.hooksPath=/dev/null',
  '-c',
  'core.pager=cat',
  '--no-pager',
]

/** No optional index writes (so no index hooks) and no credential prompts. */
export const SAFE_GIT_ENV = { GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' }

// Keys and sections in a repo's config that name a program git may run.
const RISKY_KEYS =
  /^\s*(fsmonitor|hookspath|pager|external|textconv|command|program|clean|smudge|process|sshcommand|askpass|editor|showsignature)\s*=/im
const RISKY_SECTIONS = /^\s*\[\s*(filter|include|includeif|pager)\b/im

export function isRiskyGitConfig(text: string): boolean {
  return RISKY_KEYS.test(text) || RISKY_SECTIONS.test(text)
}

function isDirectory(path: string): boolean | null {
  try {
    return statSync(path).isDirectory()
  } catch {
    return null
  }
}

/**
 * True when the repo around `cwd` has a local git config that could run a
 * program. A `.git` file (worktree or submodule) cannot be checked, so it counts.
 */
export function gitConfigCanRunPrograms(cwd: string): boolean {
  let dir = cwd
  while (true) {
    const gitPath = join(dir, '.git')
    const isDir = isDirectory(gitPath)
    if (isDir === false) return true
    if (isDir) {
      try {
        return isRiskyGitConfig(readFileSync(join(gitPath, 'config'), 'utf8'))
      } catch {
        return false
      }
    }
    const parent = dirname(dir)
    if (parent === dir) return false
    dir = parent
  }
}

/** Rewrites an auto-allowed git read so the repo's config cannot run anything. */
export function hardenGitRead(command: string): string {
  const match = /^git\s+(\S+)(.*)$/s.exec(command.trim())
  if (!match) return command
  const [, subcommand, rest] = match
  const diffFlags = ['diff', 'log', 'show'].includes(subcommand) ? ' --no-ext-diff --no-textconv' : ''
  const env = Object.entries(SAFE_GIT_ENV)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ')
  return `${env} git ${SAFE_GIT_ARGS.join(' ')} ${subcommand}${diffFlags}${rest}`
}
