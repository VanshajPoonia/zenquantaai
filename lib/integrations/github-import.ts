import 'server-only'

import {
  neonFilesRepository,
  neonIntegrationsRepository,
} from '@/lib/db/repositories'
import { indexUploadedFileForKnowledge } from '@/lib/rag/indexing'
import { GitHubImportRequest, GitHubImportResponse } from '@/types'
import {
  fetchRepositoryFile,
  GITHUB_IMPORT_MAX_FILES,
  GITHUB_IMPORT_MAX_TOTAL_BYTES,
  hashGitHubFile,
  normalizeGitHubImportPath,
} from './github'

function titleForPath(repoFullName: string, path: string): string {
  return `${repoFullName}/${path}`
}

function externalIdFor(input: {
  installationId: string
  repoFullName: string
  branch: string
  path: string
}): string {
  return [
    input.installationId,
    input.repoFullName,
    input.branch,
    input.path,
  ].join(':')
}

function safeSelection(input: GitHubImportRequest['files']) {
  return [
    ...new Map(
      input
        .map((file) => ({
          path: normalizeGitHubImportPath(file.path),
          sha: file.sha?.trim() || null,
        }))
        .filter((file) => file.path)
        .map((file) => [file.path as string, { ...file, path: file.path as string }])
    ).values(),
  ].slice(0, GITHUB_IMPORT_MAX_FILES)
}

function safeImportErrorReason(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  const knownSafeFragments = [
    'not importable',
    'base64 file payload',
    'exceeds the v1 import size limit',
    'Selected files exceed',
  ]

  if (knownSafeFragments.some((fragment) => message.includes(fragment))) {
    return message.slice(0, 180)
  }

  return 'The file could not be imported safely.'
}

export async function importGitHubRepositoryFiles(input: {
  userId: string
  accountId: string
  installationId: string
  projectId: string
  owner: string
  repo: string
  branch: string
  files: GitHubImportRequest['files']
}): Promise<GitHubImportResponse> {
  const repoFullName = `${input.owner}/${input.repo}`
  const selected = safeSelection(input.files)
  const imported: GitHubImportResponse['imported'] = []
  const skipped: GitHubImportResponse['skipped'] = []
  let totalBytes = 0

  for (const selectedFile of selected) {
    try {
      const fetched = await fetchRepositoryFile({
        installationId: input.installationId,
        owner: input.owner,
        repo: input.repo,
        path: selectedFile.path,
        ref: input.branch,
      })

      totalBytes += fetched.size
      if (totalBytes > GITHUB_IMPORT_MAX_TOTAL_BYTES) {
        skipped.push({
          path: selectedFile.path,
          reason: 'Selected files exceed the v1 total import size limit.',
        })
        continue
      }

      const checksum = hashGitHubFile(fetched.bytes)
      const externalId = externalIdFor({
        installationId: input.installationId,
        repoFullName,
        branch: input.branch,
        path: fetched.path,
      })
      const existing = (await neonIntegrationsRepository.listGitHubItemsForProject(
        input.userId,
        input.projectId
      )).find((item) => item.metadata.externalId === externalId)

      const fileMetadata = {
        source: 'github',
        provider: 'github',
        sourceKind: 'repository_file',
        externalId,
        repositoryFullName: repoFullName,
        branch: input.branch,
        path: fetched.path,
        sha: fetched.sha,
        htmlUrl: fetched.htmlUrl,
        importedAt: new Date().toISOString(),
      }

      const file =
        existing?.fileId
          ? await neonFilesRepository.patch(input.userId, existing.fileId, {
              projectId: input.projectId,
              provider: 'external',
              fileName: titleForPath(repoFullName, fetched.path),
              mimeType: fetched.mimeType,
              byteSize: fetched.size,
              checksum,
              visibility: 'private',
              metadata: {
                ...(existing.metadata.fileMetadata &&
                typeof existing.metadata.fileMetadata === 'object'
                  ? (existing.metadata.fileMetadata as Record<string, unknown>)
                  : {}),
                ...fileMetadata,
              },
            })
          : await neonFilesRepository.create({
              userId: input.userId,
              conversationId: null,
              projectId: input.projectId,
              messageId: null,
              provider: 'external',
              bucket: null,
              storagePath: null,
              publicUrl: null,
              fileName: titleForPath(repoFullName, fetched.path),
              mimeType: fetched.mimeType,
              byteSize: fetched.size,
              checksum,
              visibility: 'private',
              metadata: fileMetadata,
            })

      if (!file) {
        skipped.push({ path: selectedFile.path, reason: 'Imported file was not saved.' })
        continue
      }

      await indexUploadedFileForKnowledge({
        userId: input.userId,
        file,
        fileName: file.fileName,
        mimeType: file.mimeType ?? fetched.mimeType,
        bytes: fetched.bytes,
        projectId: input.projectId,
      })

      const item = await neonIntegrationsRepository.upsertGitHubItem(
        input.userId,
        {
          accountId: input.accountId,
          externalId,
          projectId: input.projectId,
          fileId: file.id,
          title: fetched.path,
          sourceUrl: fetched.htmlUrl,
          repoFullName,
          branch: input.branch,
          path: fetched.path,
          sha: fetched.sha,
          contentHash: checksum,
          byteSize: fetched.size,
          mimeType: fetched.mimeType,
          status: 'imported',
          lastSeenAt: new Date(),
          lastImportedAt: new Date(),
          metadata: {
            externalId,
            selectedSha: selectedFile.sha,
            fileMetadata,
          },
        }
      )
      imported.push(item)
    } catch (error) {
      skipped.push({
        path: selectedFile.path,
        reason: safeImportErrorReason(error),
      })
    }
  }

  return { imported, skipped }
}

export async function reimportGitHubProjectFiles(input: {
  userId: string
  accountId: string
  installationId: string
  projectId: string
  itemIds?: string[]
}): Promise<GitHubImportResponse> {
  const items = input.itemIds?.length
    ? await neonIntegrationsRepository.listGitHubItemsByIds(input.userId, input.itemIds)
    : await neonIntegrationsRepository.listGitHubItemsForProject(
        input.userId,
        input.projectId
      )

  const eligible = items
    .filter(
      (item) =>
        item.projectId === input.projectId &&
        item.repoFullName &&
        item.branch &&
        item.path &&
        item.status === 'imported'
    )
    .slice(0, GITHUB_IMPORT_MAX_FILES)

  const imported: GitHubImportResponse['imported'] = []
  const skipped: GitHubImportResponse['skipped'] = []

  for (const item of eligible) {
    const [owner, repo] = item.repoFullName!.split('/')
    if (!owner || !repo || !item.path || !item.branch) continue

    const result = await importGitHubRepositoryFiles({
      userId: input.userId,
      accountId: input.accountId,
      installationId: input.installationId,
      projectId: input.projectId,
      owner,
      repo,
      branch: item.branch,
      files: [{ path: item.path, sha: item.metadata.selectedSha as string | undefined }],
    })
    imported.push(...result.imported)
    skipped.push(...result.skipped)
  }

  return { imported, skipped }
}
