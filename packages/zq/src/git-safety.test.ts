import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { gitConfigCanRunPrograms, hardenGitRead, isRiskyGitConfig } from './git-safety.js'
import { decide, type DecideInput } from './permissions.js'

const PLAIN_CONFIG = `[core]
\trepositoryformatversion = 0
\tfilemode = true
[remote "origin"]
\turl = https://github.com/example/app.git
\tfetch = +refs/heads/*:refs/remotes/origin/*
[branch "main"]
\tremote = origin
\tmerge = refs/heads/main
`

const dirs: string[] = []
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'zq-git-'))
  dirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('git config checks', () => {
  it('flags config that names a program', () => {
    expect(isRiskyGitConfig(PLAIN_CONFIG)).toBe(false)
    expect(isRiskyGitConfig(`${PLAIN_CONFIG}[core]\n\tfsmonitor = ./run.sh\n`)).toBe(true)
    expect(isRiskyGitConfig('[filter "lfs"]\n\tclean = git-lfs clean -- %f\n')).toBe(true)
    expect(isRiskyGitConfig('[includeIf "gitdir:~/"]\n\tpath = ../evil\n')).toBe(true)
    expect(isRiskyGitConfig('[diff]\n\texternal = ./diff.sh\n')).toBe(true)
  })

  it('finds the repo config from a subfolder', () => {
    const repo = tempDir()
    mkdirSync(join(repo, '.git'))
    mkdirSync(join(repo, 'src'))
    writeFileSync(join(repo, '.git', 'config'), PLAIN_CONFIG)
    expect(gitConfigCanRunPrograms(join(repo, 'src'))).toBe(false)

    writeFileSync(join(repo, '.git', 'config'), `${PLAIN_CONFIG}[core]\n\thooksPath = ./hooks\n`)
    expect(gitConfigCanRunPrograms(join(repo, 'src'))).toBe(true)
  })

  it('counts a .git file as unknown', () => {
    const repo = tempDir()
    writeFileSync(join(repo, '.git'), 'gitdir: ../elsewhere/.git\n')
    expect(gitConfigCanRunPrograms(repo)).toBe(true)
  })
})

describe('hardened git reads', () => {
  it('adds the overrides and turns off external diff tools', () => {
    const status = hardenGitRead('git status')
    expect(status).toContain('GIT_OPTIONAL_LOCKS=0')
    expect(status).toContain('-c core.fsmonitor=false -c core.hooksPath=/dev/null')
    expect(status.endsWith(' status')).toBe(true)
    expect(hardenGitRead('git diff --stat')).toMatch(/ diff --no-ext-diff --no-textconv --stat$/)
  })

  it('stops a repo fsmonitor program from running', () => {
    const repo = tempDir()
    const marker = join(repo, 'ran')
    execSync('git init -q', { cwd: repo })
    execSync(`git config core.fsmonitor "touch ${marker} #"`, { cwd: repo })
    writeFileSync(join(repo, 'a.txt'), 'hi')

    execSync(hardenGitRead('git status --short'), { cwd: repo, stdio: 'ignore', shell: '/bin/sh' })
    expect(existsSync(marker)).toBe(false)

    execSync('git status --short', { cwd: repo, stdio: 'ignore' })
    expect(existsSync(marker)).toBe(true)
  })
})

describe('git permissions', () => {
  const base: DecideInput = {
    toolName: 'bash',
    args: {},
    mode: 'ask',
    allowedCommands: [],
    cwd: '/work/app',
    hasUI: true,
  }

  it('runs safe git reads hardened and asks when the repo config is risky', () => {
    const allowed = decide({ ...base, args: { command: 'git status' } })
    expect(allowed.action === 'allow' && allowed.command).toContain('core.fsmonitor=false')
    expect(decide({ ...base, args: { command: 'ls -la' } })).toEqual({ action: 'allow' })

    expect(decide({ ...base, args: { command: 'git status' }, gitConfigRisky: true }).action).toBe('ask')
    expect(
      decide({ ...base, args: { command: 'git add src' }, allowedCommands: ['git add'], gitConfigRisky: true })
        .action
    ).toBe('ask')
  })
})
