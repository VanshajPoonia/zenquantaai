'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Github,
  Loader2,
  RefreshCcw,
} from 'lucide-react'
import { useChatContext } from '@/lib/chat-context'
import {
  GitHubImportableFile,
  GitHubIntegrationStatus,
  GitHubRepoFilesResponse,
  GitHubRepositorySummary,
} from '@/types'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`
  const kb = value / 1024
  if (kb < 1024) return `${kb.toFixed(kb >= 10 ? 0 : 1)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`
}

function repoKey(repo: GitHubRepositorySummary) {
  return `${repo.owner}/${repo.name}`
}

export function GitHubIntegrationPanel() {
  const {
    projects,
    selectedProjectId,
    workspaceToolRequest,
    clearWorkspaceToolRequest,
    openWorkspaceTool,
  } = useChatContext()
  const [open, setOpen] = useState(false)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [status, setStatus] = useState<GitHubIntegrationStatus | null>(null)
  const [repositories, setRepositories] = useState<GitHubRepositorySummary[]>([])
  const [selectedRepoKey, setSelectedRepoKey] = useState('')
  const [branch, setBranch] = useState('')
  const [filesResponse, setFilesResponse] = useState<GitHubRepoFilesResponse | null>(
    null
  )
  const [selectedPaths, setSelectedPaths] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const selectedProject =
    projects.find((project) => project.id === projectId) ??
    projects.find((project) => project.id === selectedProjectId) ??
    null
  const selectedRepo = repositories.find((repo) => repoKey(repo) === selectedRepoKey)
  const selectedFiles = useMemo(
    () =>
      (filesResponse?.files ?? []).filter((file) =>
        selectedPaths.includes(file.path)
      ),
    [filesResponse?.files, selectedPaths]
  )
  const selectedBytes = selectedFiles.reduce((total, file) => total + file.size, 0)

  const loadStatus = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/integrations/github', {
        cache: 'no-store',
      })
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null
        throw new Error(payload?.error ?? 'Unable to load GitHub status.')
      }
      const payload = (await response.json()) as GitHubIntegrationStatus
      setStatus(payload)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load GitHub status.'
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadRepositories = useCallback(async () => {
    setError(null)
    const response = await fetch('/api/integrations/github/repos', {
      cache: 'no-store',
    })
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null
      throw new Error(payload?.error ?? 'Unable to load repositories.')
    }
    const payload = (await response.json()) as {
      repositories: GitHubRepositorySummary[]
    }
    setRepositories(payload.repositories)
    if (!selectedRepoKey && payload.repositories[0]) {
      setSelectedRepoKey(repoKey(payload.repositories[0]))
      setBranch(payload.repositories[0].defaultBranch)
    }
  }, [selectedRepoKey])

  const loadFiles = useCallback(async () => {
    if (!selectedRepo) return
    setIsLoading(true)
    setError(null)
    setNotice(null)

    try {
      const [owner, repo] = selectedRepo.fullName.split('/')
      const params = new URLSearchParams()
      if (branch) params.set('branch', branch)
      const response = await fetch(
        `/api/integrations/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/files?${params.toString()}`,
        { cache: 'no-store' }
      )
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null
        throw new Error(payload?.error ?? 'Unable to load repository files.')
      }
      const payload = (await response.json()) as GitHubRepoFilesResponse
      setFilesResponse(payload)
      setBranch(payload.branch)
      setSelectedPaths(
        payload.files
          .filter((file) => file.selectedByDefault)
          .map((file) => file.path)
      )
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load repository files.'
      )
    } finally {
      setIsLoading(false)
    }
  }, [branch, selectedRepo])

  useEffect(() => {
    if (!open) return
    void loadStatus()
  }, [loadStatus, open])

  useEffect(() => {
    if (!open || !status?.connected) return
    void loadRepositories().catch((repoError) =>
      setError(
        repoError instanceof Error
          ? repoError.message
          : 'Unable to load repositories.'
      )
    )
  }, [loadRepositories, open, status?.connected])

  useEffect(() => {
    if (!workspaceToolRequest || workspaceToolRequest.tool !== 'github-integration') {
      return
    }
    setProjectId(
      workspaceToolRequest.projectId ??
        (selectedProjectId === 'all' ? null : selectedProjectId) ??
        projects.find((project) => project.isDefault)?.id ??
        projects[0]?.id ??
        null
    )
    setOpen(true)
    clearWorkspaceToolRequest(workspaceToolRequest.requestId)
  }, [
    clearWorkspaceToolRequest,
    projects,
    selectedProjectId,
    workspaceToolRequest,
  ])

  useEffect(() => {
    if (!selectedRepo) return
    setBranch(selectedRepo.defaultBranch)
    setFilesResponse(null)
    setSelectedPaths([])
  }, [selectedRepo])

  const toggleFile = (file: GitHubImportableFile) => {
    setSelectedPaths((previous) =>
      previous.includes(file.path)
        ? previous.filter((path) => path !== file.path)
        : [...previous, file.path]
    )
  }

  const handleImport = async () => {
    if (!selectedProject || !selectedRepo || selectedPaths.length === 0) return
    setIsImporting(true)
    setError(null)
    setNotice(null)

    try {
      const [owner, repo] = selectedRepo.fullName.split('/')
      const response = await fetch('/api/integrations/github/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProject.id,
          owner,
          repo,
          branch,
          files: selectedPaths.map((path) => ({
            path,
            sha: filesResponse?.files.find((file) => file.path === path)?.sha,
          })),
        }),
      })
      const payload = (await response.json().catch(() => null)) as
        | { imported?: unknown[]; skipped?: Array<{ path: string; reason: string }>; error?: string }
        | null
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Unable to import GitHub files.')
      }
      setNotice(
        `Imported ${payload?.imported?.length ?? 0} files${
          payload?.skipped?.length ? `; skipped ${payload.skipped.length}` : ''
        }.`
      )
      openWorkspaceTool({ tool: 'ask-files', projectId: selectedProject.id })
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : 'Unable to import GitHub files.'
      )
    } finally {
      setIsImporting(false)
    }
  }

  const handleDisconnect = async () => {
    setIsImporting(true)
    setError(null)
    try {
      const response = await fetch('/api/integrations/github', { method: 'DELETE' })
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null
        throw new Error(payload?.error ?? 'Unable to disconnect GitHub.')
      }
      setRepositories([])
      setFilesResponse(null)
      setSelectedPaths([])
      await loadStatus()
    } catch (disconnectError) {
      setError(
        disconnectError instanceof Error
          ? disconnectError.message
          : 'Unable to disconnect GitHub.'
      )
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden border-border/70 bg-background/95 p-0">
        <DialogHeader className="border-b border-border/60 px-6 py-5">
          <DialogTitle className="flex items-center gap-2">
            <Github className="size-5" />
            GitHub repo context
          </DialogTitle>
          <DialogDescription>
            Connect a read-only GitHub App installation and import selected code
            files as private project knowledge.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-98px)]">
          <div className="space-y-5 p-6">
            {error ? (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>GitHub integration unavailable</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            {notice ? (
              <Alert>
                <CheckCircle2 className="size-4" />
                <AlertTitle>Import complete</AlertTitle>
                <AlertDescription>{notice}</AlertDescription>
              </Alert>
            ) : null}

            {isLoading && !status ? (
              <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/45 p-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading GitHub status...
              </div>
            ) : null}

            {status && !status.configured ? (
              <Alert>
                <AlertCircle className="size-4" />
                <AlertTitle>GitHub App configuration required</AlertTitle>
                <AlertDescription>
                  Missing server env vars:{' '}
                  {(status.missingConfiguration ?? []).join(', ')}.
                </AlertDescription>
              </Alert>
            ) : null}

            {status?.configured && !status.connected ? (
              <div className="rounded-2xl border border-border/60 bg-card/45 p-5">
                <p className="text-sm font-medium text-foreground">
                  Connect GitHub read-only
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Zenquanta requests only repository metadata and contents access.
                  It will not create issues, branches, commits, pull requests, or
                  webhooks.
                </p>
                <Button asChild className="mt-4 rounded-xl">
                  <a href={status.connectUrl ?? '/api/integrations/github/connect'}>
                    <Github className="mr-2 size-4" />
                    Install GitHub App
                  </a>
                </Button>
              </div>
            ) : null}

            {status?.connected ? (
              <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-border/60 bg-card/45 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {status.account?.externalAccountLogin ?? 'GitHub'}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Read-only installation connected
                        </p>
                      </div>
                      <Badge variant="outline" className="rounded-full">
                        Connected
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-4 w-full rounded-xl"
                      disabled={isImporting}
                      onClick={() => void handleDisconnect()}
                    >
                      Disconnect
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      Project
                    </label>
                    <Select
                      value={projectId ?? ''}
                      onValueChange={(value) => setProjectId(value)}
                    >
                      <SelectTrigger className="rounded-xl border-border/60 bg-card/45">
                        <SelectValue placeholder="Choose a project" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      Repository
                    </label>
                    <Select
                      value={selectedRepoKey}
                      onValueChange={setSelectedRepoKey}
                    >
                      <SelectTrigger className="rounded-xl border-border/60 bg-card/45">
                        <SelectValue placeholder="Choose a repository" />
                      </SelectTrigger>
                      <SelectContent>
                        {repositories.map((repo) => (
                          <SelectItem key={repo.id} value={repoKey(repo)}>
                            {repo.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      Branch or ref
                    </label>
                    <Input
                      value={branch}
                      onChange={(event) => setBranch(event.target.value)}
                      className="rounded-xl border-border/60 bg-card/45"
                    />
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full rounded-xl"
                    disabled={!selectedRepo || isLoading}
                    onClick={() => void loadFiles()}
                  >
                    {isLoading ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <RefreshCcw className="mr-2 size-4" />
                    )}
                    Load files
                  </Button>
                </div>

                <div className="rounded-2xl border border-border/60 bg-card/45">
                  <div className="flex flex-col gap-3 border-b border-border/60 p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Importable code-context files
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        README, package.json, and selected source files under v1
                        limits. Selected: {selectedFiles.length} files ·{' '}
                        {formatBytes(selectedBytes)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      className="rounded-xl"
                      disabled={
                        isImporting ||
                        !selectedProject ||
                        !selectedRepo ||
                        selectedFiles.length === 0
                      }
                      onClick={() => void handleImport()}
                    >
                      {isImporting ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <Github className="mr-2 size-4" />
                      )}
                      Import selected
                    </Button>
                  </div>

                  <div className="grid max-h-[430px] gap-2 overflow-y-auto p-3">
                    {filesResponse?.files.length ? (
                      filesResponse.files.map((file) => (
                        <button
                          key={file.path}
                          type="button"
                          className="flex items-start gap-3 rounded-xl border border-border/50 bg-background/40 p-3 text-left transition-colors hover:border-primary/35"
                          onClick={() => toggleFile(file)}
                        >
                          <Checkbox
                            checked={selectedPaths.includes(file.path)}
                            onCheckedChange={() => toggleFile(file)}
                            onClick={(event) => event.stopPropagation()}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground">
                              {file.path}
                            </span>
                            <span className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <span>{file.type}</span>
                              <span>{formatBytes(file.size)}</span>
                              {file.language ? <span>{file.language}</span> : null}
                            </span>
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                        Load a repository to choose README, package metadata, and
                        source files for this project.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
