import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  neonIntegrationsRepository,
  neonProfilesRepository,
  neonProjectsRepository,
} from '@/lib/db/repositories'
import { getRepositorySummary } from '@/lib/integrations/github'
import { importGitHubRepositoryFiles } from '@/lib/integrations/github-import'
import { GitHubImportRequest } from '@/types'

export const runtime = 'nodejs'

function parseBody(value: unknown): GitHubImportRequest | null {
  if (!value || typeof value !== 'object') return null
  const input = value as Partial<GitHubImportRequest>
  if (
    !input.projectId ||
    !input.owner ||
    !input.repo ||
    !Array.isArray(input.files)
  ) {
    return null
  }

  return {
    projectId: String(input.projectId),
    owner: String(input.owner),
    repo: String(input.repo),
    branch: input.branch ? String(input.branch) : undefined,
    files: input.files
      .map((file) =>
        file && typeof file === 'object'
          ? {
              path: String((file as { path?: unknown }).path ?? ''),
              sha: (file as { sha?: unknown }).sha
                ? String((file as { sha?: unknown }).sha)
                : undefined,
            }
          : { path: '' }
      )
      .filter((file) => file.path),
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)
  const body = parseBody(await request.json().catch(() => null))
  if (!body || body.files.length === 0) {
    return NextResponse.json(
      { error: 'Project, repository, and selected files are required.' },
      { status: 400 }
    )
  }

  const project = await neonProjectsRepository.get(auth.user.id, body.projectId)
  if (!project) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
  }

  const account = await neonIntegrationsRepository.getGitHubAccount(auth.user.id)
  if (account?.status !== 'connected' || !account.installationId) {
    return NextResponse.json(
      { error: 'GitHub is not connected.' },
      { status: 400 }
    )
  }

  const repository = await getRepositorySummary(
    account.installationId,
    body.owner,
    body.repo
  )
  const branch = body.branch?.trim() || repository.defaultBranch
  const result = await importGitHubRepositoryFiles({
    userId: auth.user.id,
    accountId: account.id,
    installationId: account.installationId,
    projectId: body.projectId,
    owner: body.owner,
    repo: body.repo,
    branch,
    files: body.files,
  })
  const response = NextResponse.json(result)

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
