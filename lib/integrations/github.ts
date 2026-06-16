import 'server-only'

import { createHash, createSign } from 'crypto'
import {
  GitHubImportableFile,
  GitHubIntegrationAccount,
  GitHubIntegrationStatus,
  GitHubIntegrationStatusAccount,
  GitHubRepositorySummary,
} from '@/types'

export const GITHUB_IMPORT_MAX_FILE_BYTES = 150_000
export const GITHUB_IMPORT_MAX_FILES = 25
export const GITHUB_IMPORT_MAX_TOTAL_BYTES = 750_000
const GITHUB_API_BASE = 'https://api.github.com'

type GitHubInstallationAccount = {
  id?: number | string
  login?: string
  name?: string | null
}

type GitHubInstallation = {
  id: number
  account?: GitHubInstallationAccount | null
  permissions?: Record<string, string>
}

type GitHubRepositoryApi = {
  id: number
  name: string
  full_name: string
  private: boolean
  description: string | null
  language: string | null
  default_branch: string
  pushed_at: string | null
  updated_at: string | null
  owner?: { login?: string }
}

type GitHubTreeItem = {
  path?: string
  mode?: string
  type?: 'blob' | 'tree' | 'commit'
  sha?: string
  size?: number
  url?: string
}

type GitHubContentsFile = {
  type?: string
  name?: string
  path?: string
  sha?: string
  size?: number
  encoding?: string
  content?: string
  html_url?: string
}

export interface GitHubAppConfig {
  appId: string
  clientId: string
  privateKey: string
  callbackUrl: string
}

export interface GitHubInstallationToken {
  token: string
  expiresAt: string
  permissions: Record<string, string>
}

export interface GitHubFetchedFile {
  path: string
  sha: string
  size: number
  mimeType: string
  htmlUrl: string | null
  bytes: Buffer
}

export function getGitHubAppConfig(): {
  configured: boolean
  config: GitHubAppConfig | null
  missing: string[]
} {
  const entries = {
    GITHUB_APP_ID: process.env.GITHUB_APP_ID?.trim(),
    GITHUB_APP_CLIENT_ID: process.env.GITHUB_APP_CLIENT_ID?.trim(),
    GITHUB_APP_PRIVATE_KEY: process.env.GITHUB_APP_PRIVATE_KEY?.trim(),
    GITHUB_APP_CALLBACK_URL: process.env.GITHUB_APP_CALLBACK_URL?.trim(),
  }
  const missing = Object.entries(entries)
    .filter(([, value]) => !value)
    .map(([key]) => key)

  if (missing.length > 0) {
    return { configured: false, config: null, missing }
  }

  return {
    configured: true,
    missing: [],
    config: {
      appId: entries.GITHUB_APP_ID!,
      clientId: entries.GITHUB_APP_CLIENT_ID!,
      privateKey: entries.GITHUB_APP_PRIVATE_KEY!.replace(/\\n/g, '\n'),
      callbackUrl: entries.GITHUB_APP_CALLBACK_URL!,
    },
  }
}

export function toClientGitHubIntegrationAccount(
  account: GitHubIntegrationAccount | null
): GitHubIntegrationStatusAccount | null {
  if (!account) return null

  return {
    provider: 'github',
    externalAccountLogin: account.externalAccountLogin,
    externalAccountName: account.externalAccountName,
    scopes: account.scopes,
    status: account.status,
    connectedAt: account.connectedAt,
    revokedAt: account.revokedAt,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  }
}

export function buildGitHubStatus(input: {
  account: GitHubIntegrationAccount | null
}): GitHubIntegrationStatus {
  const { configured, missing } = getGitHubAppConfig()
  const account = toClientGitHubIntegrationAccount(input.account)

  return {
    configured,
    connected: configured && account?.status === 'connected',
    account,
    connectUrl: configured ? '/api/integrations/github/connect' : null,
    missingConfiguration: missing.length > 0 ? missing : undefined,
  }
}

function base64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

export function createGitHubAppJwt(): string {
  const { config } = getGitHubAppConfig()
  if (!config) {
    throw new Error('GitHub App is not configured.')
  }

  const now = Math.floor(Date.now() / 1000)
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = base64Url(
    JSON.stringify({
      iat: now - 60,
      exp: now + 540,
      iss: config.appId,
    })
  )
  const body = `${header}.${payload}`
  const signature = createSign('RSA-SHA256')
    .update(body)
    .sign(config.privateKey)

  return `${body}.${base64Url(signature)}`
}

async function githubJson<T>(
  path: string,
  options: {
    method?: string
    token: string
    body?: unknown
    accept?: string
  }
): Promise<T> {
  const response = await fetch(`${GITHUB_API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Accept: options.accept ?? 'application/vnd.github+json',
      Authorization: `Bearer ${options.token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  })

  if (!response.ok) {
    const message = await response.text().catch(() => '')
    throw new Error(
      message || `GitHub API request failed with status ${response.status}.`
    )
  }

  return (await response.json()) as T
}

export async function getGitHubAppSlug(): Promise<string> {
  const app = await githubJson<{ slug?: string }>('/app', {
    token: createGitHubAppJwt(),
  })
  if (!app.slug) throw new Error('GitHub App slug was not returned.')
  return app.slug
}

export async function getGitHubInstallation(
  installationId: string
): Promise<GitHubInstallation> {
  return await githubJson<GitHubInstallation>(`/app/installations/${installationId}`, {
    token: createGitHubAppJwt(),
  })
}

export async function createInstallationToken(
  installationId: string
): Promise<GitHubInstallationToken> {
  const response = await githubJson<{
    token: string
    expires_at: string
    permissions?: Record<string, string>
  }>(`/app/installations/${installationId}/access_tokens`, {
    token: createGitHubAppJwt(),
    method: 'POST',
  })

  return {
    token: response.token,
    expiresAt: response.expires_at,
    permissions: response.permissions ?? {},
  }
}

function mapRepository(repo: GitHubRepositoryApi): GitHubRepositorySummary {
  return {
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    owner: repo.owner?.login ?? repo.full_name.split('/')[0] ?? '',
    private: repo.private,
    defaultBranch: repo.default_branch,
    description: repo.description,
    language: repo.language,
    pushedAt: repo.pushed_at,
    updatedAt: repo.updated_at,
  }
}

export async function listInstallationRepositories(
  installationId: string
): Promise<GitHubRepositorySummary[]> {
  const { token } = await createInstallationToken(installationId)
  const body = await githubJson<{ repositories?: GitHubRepositoryApi[] }>(
    '/installation/repositories?per_page=100',
    { token }
  )

  return (body.repositories ?? []).map(mapRepository)
}

export async function getRepositorySummary(
  installationId: string,
  owner: string,
  repo: string
): Promise<GitHubRepositorySummary> {
  const { token } = await createInstallationToken(installationId)
  const body = await githubJson<GitHubRepositoryApi>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    { token }
  )

  return mapRepository(body)
}

function extensionOf(path: string): string {
  const fileName = path.split('/').pop() ?? path
  return fileName.toLowerCase().split('.').pop() ?? ''
}

function fileNameOf(path: string): string {
  return path.split('/').pop() ?? path
}

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}

export function normalizeGitHubImportPath(path: string): string | null {
  const normalized = path.trim()
  if (
    !normalized ||
    normalized.length > 512 ||
    normalized.startsWith('/') ||
    normalized.endsWith('/') ||
    normalized.includes('\\') ||
    /[\0-\x1F\x7F]/.test(normalized)
  ) {
    return null
  }

  const segments = normalized.split('/')
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    return null
  }

  return segments.join('/')
}

function isUnsafePath(path: string): boolean {
  const safePath = normalizeGitHubImportPath(path)
  if (!safePath) return true

  const lower = safePath.toLowerCase()
  const parts = lower.split('/')
  const skippedDirs = new Set([
    '.git',
    '.next',
    '.turbo',
    '.cache',
    'coverage',
    'dist',
    'build',
    'node_modules',
    'vendor',
    'target',
  ])
  const skippedFiles = new Set([
    'package-lock.json',
    'pnpm-lock.yaml',
    'yarn.lock',
    'bun.lockb',
  ])
  const name = fileNameOf(lower)

  return (
    parts.some((part) => skippedDirs.has(part)) ||
    skippedFiles.has(name) ||
    name.startsWith('.env') ||
    name.includes('secret') ||
    name.includes('private-key')
  )
}

function isImportableSourcePath(path: string): boolean {
  const lower = path.toLowerCase()
  const name = fileNameOf(lower)
  const extension = extensionOf(lower)
  const sourceExtensions = new Set([
    'c',
    'cc',
    'cpp',
    'cs',
    'css',
    'go',
    'h',
    'hpp',
    'html',
    'java',
    'js',
    'jsx',
    'json',
    'kt',
    'md',
    'mdx',
    'mjs',
    'php',
    'prisma',
    'py',
    'rb',
    'rs',
    'scss',
    'sh',
    'sql',
    'swift',
    'toml',
    'ts',
    'tsx',
    'txt',
    'xml',
    'yaml',
    'yml',
  ])

  return (
    name === 'package.json' ||
    name === 'readme' ||
    name.startsWith('readme.') ||
    sourceExtensions.has(extension)
  )
}

function mimeTypeForPath(path: string): string {
  const extension = extensionOf(path)
  if (extension === 'json') return 'application/json'
  if (extension === 'md' || extension === 'mdx') return 'text/markdown'
  if (extension === 'html') return 'text/html'
  if (extension === 'css' || extension === 'scss') return 'text/css'
  if (extension === 'xml') return 'application/xml'
  if (extension === 'yaml' || extension === 'yml') return 'application/x-yaml'
  return 'text/plain'
}

function languageForPath(path: string): string | null {
  const extension = extensionOf(path)
  const map: Record<string, string> = {
    ts: 'TypeScript',
    tsx: 'TypeScript React',
    js: 'JavaScript',
    jsx: 'JavaScript React',
    py: 'Python',
    go: 'Go',
    rs: 'Rust',
    rb: 'Ruby',
    java: 'Java',
    css: 'CSS',
    scss: 'SCSS',
    md: 'Markdown',
    mdx: 'MDX',
    json: 'JSON',
    sql: 'SQL',
  }
  return map[extension] ?? null
}

function candidateType(path: string): GitHubImportableFile['type'] {
  const name = fileNameOf(path).toLowerCase()
  if (name === 'package.json') return 'package'
  if (name === 'readme' || name.startsWith('readme.')) return 'readme'
  return 'source'
}

export async function listImportableRepositoryFiles(input: {
  installationId: string
  owner: string
  repo: string
  branch?: string | null
}): Promise<{
  repository: GitHubRepositorySummary
  branch: string
  files: GitHubImportableFile[]
  skipped: Array<{ path: string; reason: string }>
}> {
  const { token } = await createInstallationToken(input.installationId)
  const repository = mapRepository(
    await githubJson<GitHubRepositoryApi>(
      `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}`,
      { token }
    )
  )
  const branch = input.branch?.trim() || repository.defaultBranch
  const tree = await githubJson<{
    tree?: GitHubTreeItem[]
    truncated?: boolean
  }>(
    `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
    { token }
  )

  const skipped: Array<{ path: string; reason: string }> = []
  const files = (tree.tree ?? [])
    .filter((item) => item.type === 'blob' && item.path && item.sha)
    .map((item) => {
      const path = normalizeGitHubImportPath(item.path!)
      if (!path) {
        skipped.push({ path: item.path!, reason: 'Invalid repository file path.' })
        return null
      }
      const size = Number(item.size ?? 0)
      if (isUnsafePath(path)) {
        skipped.push({ path, reason: 'Secrets, dependencies, build outputs, and lockfiles are skipped in v1.' })
        return null
      }
      if (!isImportableSourcePath(path)) {
        skipped.push({ path, reason: 'Binary or unsupported file type.' })
        return null
      }
      if (size > GITHUB_IMPORT_MAX_FILE_BYTES) {
        skipped.push({ path, reason: 'File exceeds the v1 import size limit.' })
        return null
      }

      const type = candidateType(path)
      return {
        path,
        name: fileNameOf(path),
        type,
        sha: item.sha!,
        size,
        language: languageForPath(path),
        mimeType: mimeTypeForPath(path),
        selectedByDefault: type === 'readme' || type === 'package',
        reason: null,
      } satisfies GitHubImportableFile
    })
    .filter(Boolean) as GitHubImportableFile[]

  const sorted = files.sort((a, b) => {
    const priority = { readme: 0, package: 1, source: 2 }
    return priority[a.type] - priority[b.type] || a.path.localeCompare(b.path)
  })

  if (tree.truncated) {
    skipped.push({
      path: repository.fullName,
      reason: 'GitHub truncated the repository tree; narrow the import selection.',
    })
  }

  return {
    repository,
    branch,
    files: sorted.slice(0, 250),
    skipped: skipped.slice(0, 250),
  }
}

export async function fetchRepositoryFile(input: {
  installationId: string
  owner: string
  repo: string
  path: string
  ref: string
}): Promise<GitHubFetchedFile> {
  const safePath = normalizeGitHubImportPath(input.path)
  if (!safePath || isUnsafePath(safePath) || !isImportableSourcePath(safePath)) {
    throw new Error('This file is not importable in the read-only GitHub v1.')
  }

  const { token } = await createInstallationToken(input.installationId)
  const item = await githubJson<GitHubContentsFile>(
    `/repos/${encodeURIComponent(input.owner)}/${encodeURIComponent(input.repo)}/contents/${encodePath(safePath)}?ref=${encodeURIComponent(input.ref)}`,
    { token }
  )

  if (item.type !== 'file' || !item.content || item.encoding !== 'base64') {
    throw new Error('GitHub did not return a base64 file payload.')
  }
  if ((item.size ?? 0) > GITHUB_IMPORT_MAX_FILE_BYTES) {
    throw new Error('File exceeds the v1 import size limit.')
  }

  const bytes = Buffer.from(item.content.replace(/\n/g, ''), 'base64')
  if (bytes.length > GITHUB_IMPORT_MAX_FILE_BYTES) {
    throw new Error('File exceeds the v1 import size limit.')
  }

  return {
    path: normalizeGitHubImportPath(item.path ?? safePath) ?? safePath,
    sha: item.sha ?? '',
    size: bytes.length,
    mimeType: mimeTypeForPath(safePath),
    htmlUrl: item.html_url ?? null,
    bytes,
  }
}

export function hashGitHubFile(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}
