'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Filter,
  FolderInput,
  Github,
  Loader2,
  RefreshCcw,
  Search,
  Upload,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { FileIntelligence, FileIntelligenceMutationResponse, Project } from '@/types'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FileIntelligenceCard } from '@/components/chat/file-intelligence-card'

type LibraryTab = 'all' | 'indexed' | 'skipped' | 'github'

const TABS: { id: LibraryTab; label: string }[] = [
  { id: 'all', label: 'All files' },
  { id: 'indexed', label: 'Indexed' },
  { id: 'skipped', label: 'Skipped / Failed' },
  { id: 'github', label: 'From GitHub' },
]

const PROJECT_ALL = 'all'

function isGitHubFile(file: FileIntelligence): boolean {
  return file.metadata?.source === 'github'
}

function fileMatchesTab(file: FileIntelligence, tab: LibraryTab): boolean {
  if (tab === 'all') return true
  if (tab === 'indexed') return file.knowledgeStatus === 'indexed'
  if (tab === 'skipped')
    return (
      file.knowledgeStatus === 'skipped' ||
      file.knowledgeStatus === 'unsupported' ||
      file.knowledgeStatus === 'failed'
    )
  if (tab === 'github') return isGitHubFile(file)
  return true
}

function fileMatchesSearch(file: FileIntelligence, query: string): boolean {
  if (!query) return true
  const lower = query.toLowerCase()
  return [
    file.fileName,
    file.mimeType,
    file.knowledgeStatusLabel,
    file.knowledgeReason,
    file.metadata?.source,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(lower)
}

function SourceBadge({ file }: { file: FileIntelligence }) {
  if (isGitHubFile(file)) {
    return (
      <Badge variant="outline" className="rounded-full border-muted-foreground/30 text-muted-foreground">
        <Github className="mr-1 size-3" />
        GitHub
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="rounded-full border-muted-foreground/30 text-muted-foreground">
      <Upload className="mr-1 size-3" />
      Upload
    </Badge>
  )
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options)
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `Request failed with status ${response.status}`)
  }
  return response.json() as Promise<T>
}

export function KnowledgeLibraryClient({ projects }: { projects: Project[] }) {
  const router = useRouter()
  const [files, setFiles] = useState<FileIntelligence[]>([])
  const [embeddingsAvailable, setEmbeddingsAvailable] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<LibraryTab>('all')
  const [projectFilter, setProjectFilter] = useState<string>(PROJECT_ALL)
  const [search, setSearch] = useState('')
  const [workingFileIds, setWorkingFileIds] = useState<Set<string>>(new Set())
  const [assignTarget, setAssignTarget] = useState<FileIntelligence | null>(null)
  const [assignProjectId, setAssignProjectId] = useState<string>('')
  const [assignWorking, setAssignWorking] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<FileIntelligence | null>(null)

  const loadFiles = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '300' })
      if (projectFilter !== PROJECT_ALL) params.set('projectId', projectFilter)
      const data = await apiFetch<{ files: FileIntelligence[]; embeddingsAvailable: boolean }>(
        `/api/files?${params.toString()}`
      )
      setFiles(data.files)
      setEmbeddingsAvailable(data.embeddingsAvailable)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load files.')
    } finally {
      setIsLoading(false)
    }
  }, [projectFilter])

  useEffect(() => {
    void loadFiles()
  }, [loadFiles])

  const visibleFiles = useMemo(() => {
    return files.filter(
      (file) => fileMatchesTab(file, tab) && fileMatchesSearch(file, search)
    )
  }, [files, tab, search])

  const tabCounts = useMemo(() => {
    const all = files.length
    const indexed = files.filter((f) => f.knowledgeStatus === 'indexed').length
    const skipped = files.filter(
      (f) =>
        f.knowledgeStatus === 'skipped' ||
        f.knowledgeStatus === 'unsupported' ||
        f.knowledgeStatus === 'failed'
    ).length
    const github = files.filter(isGitHubFile).length
    return { all, indexed, skipped, github }
  }, [files])

  function setFileWorking(fileId: string, working: boolean) {
    setWorkingFileIds((prev) => {
      const next = new Set(prev)
      if (working) next.add(fileId)
      else next.delete(fileId)
      return next
    })
  }

  function updateFile(updated: FileIntelligence) {
    setFiles((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
  }

  const handleReindex = useCallback(async (file: FileIntelligence) => {
    setFileWorking(file.id, true)
    try {
      const data = await apiFetch<FileIntelligenceMutationResponse>(
        `/api/files/${file.id}/reindex`,
        { method: 'POST' }
      )
      if (data.file) updateFile(data.file)
    } catch {
      // non-critical — leave existing status in place
    } finally {
      setFileWorking(file.id, false)
    }
  }, [])

  const handleDelete = useCallback(async (file: FileIntelligence) => {
    setFileWorking(file.id, true)
    try {
      await apiFetch(`/api/files/${file.id}`, { method: 'DELETE' })
      setFiles((prev) => prev.filter((f) => f.id !== file.id))
    } catch {
      // non-critical
    } finally {
      setFileWorking(file.id, false)
    }
  }, [])

  const handleAssignOpen = useCallback((file: FileIntelligence) => {
    setAssignTarget(file)
    setAssignProjectId(file.projectId ?? '')
  }, [])

  const handleAssignConfirm = useCallback(async () => {
    if (!assignTarget) return
    setAssignWorking(true)
    try {
      const data = await apiFetch<FileIntelligenceMutationResponse>(
        `/api/files/${assignTarget.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: assignProjectId || null }),
        }
      )
      if (data.file) updateFile(data.file)
      setAssignTarget(null)
    } catch {
      // non-critical
    } finally {
      setAssignWorking(false)
    }
  }, [assignTarget, assignProjectId])

  const handleAsk = useCallback(
    (file: FileIntelligence) => {
      router.push(`/?openAskFiles=${encodeURIComponent(file.id)}`)
    },
    [router]
  )

  return (
    <>
      <div className="rounded-3xl border border-border/70 bg-card/60 p-6 backdrop-blur-sm">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search files..."
              className="h-10 rounded-xl bg-card/45 pl-9"
            />
          </div>
          <Select
            value={projectFilter}
            onValueChange={(value) => {
              setProjectFilter(value)
              setSearch('')
            }}
          >
            <SelectTrigger className="h-10 w-48 rounded-xl bg-card/45">
              <Filter className="mr-2 size-4 shrink-0 text-muted-foreground" />
              <SelectValue placeholder="All projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={PROJECT_ALL}>All projects</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 rounded-xl"
            onClick={() => void loadFiles()}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCcw className="mr-2 size-4" />
            )}
            Refresh
          </Button>
        </div>

        {/* Tabs */}
        <div className="mt-5 flex flex-wrap gap-2">
          {TABS.map(({ id, label }) => {
            const count = tabCounts[id]
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  'flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors',
                  tab === id
                    ? 'border-primary/40 bg-primary/10 text-foreground'
                    : 'border-border/60 bg-card/35 text-muted-foreground hover:border-border hover:bg-card/60 hover:text-foreground'
                )}
              >
                {label}
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-xs',
                    tab === id ? 'bg-primary/20 text-foreground' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Status */}
        {error ? (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        ) : null}

        {!embeddingsAvailable && !error ? (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            Embedding provider is not configured. Files will be stored but cannot be indexed for
            knowledge retrieval until embeddings are enabled.
          </div>
        ) : null}

        {/* File list */}
        <div className="mt-5">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border/70 bg-card/25 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              Loading files...
            </div>
          ) : visibleFiles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-card/25 py-16 text-center">
              <FileText className="mx-auto size-8 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-medium text-foreground">
                {search ? 'No files match your search.' : 'No files in this view.'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {search
                  ? 'Try a different search term or clear the filter.'
                  : tab === 'github'
                    ? 'Connect GitHub and import repository files from the workspace.'
                    : 'Upload text, code, PDF, or DOCX files from the workspace chat.'}
              </p>
            </div>
          ) : (
            <ScrollArea>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {visibleFiles.map((file) => (
                  <div key={file.id} className="flex flex-col gap-2">
                    <SourceBadge file={file} />
                    {file.projectId ? (
                      <p className="text-xs text-muted-foreground">
                        Project:{' '}
                        {projects.find((p) => p.id === file.projectId)?.name ?? file.projectId}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">No project</p>
                    )}
                    <FileIntelligenceCard
                      file={file}
                      isWorking={workingFileIds.has(file.id)}
                      onAsk={file.knowledgeStatus === 'indexed' ? handleAsk : undefined}
                      onReindex={handleReindex}
                      onDelete={(f) => setDeleteTarget(f)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="self-start rounded-xl text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => handleAssignOpen(file)}
                    >
                      <FolderInput className="mr-1.5 size-3.5" />
                      Assign to project
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Footer count */}
        {!isLoading && visibleFiles.length > 0 ? (
          <p className="mt-5 text-xs text-muted-foreground">
            Showing {visibleFiles.length} of {files.length} file
            {files.length === 1 ? '' : 's'}
          </p>
        ) : null}
      </div>

      {/* Assign to project dialog */}
      <Dialog
        open={Boolean(assignTarget)}
        onOpenChange={(open) => {
          if (!open) setAssignTarget(null)
        }}
      >
        <DialogContent className="rounded-2xl border-border/70 bg-background/95 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign to project</DialogTitle>
            <DialogDescription>
              Move{' '}
              <span className="font-medium text-foreground">
                {assignTarget?.fileName}
              </span>{' '}
              to a project. Choose None to unassign.
            </DialogDescription>
          </DialogHeader>
          <Select
            value={assignProjectId}
            onValueChange={setAssignProjectId}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="None — no project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None — no project</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setAssignTarget(null)}
              disabled={assignWorking}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-xl"
              onClick={() => void handleAssignConfirm()}
              disabled={assignWorking}
            >
              {assignWorking ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 size-4" />
              )}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this file?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the file from private storage and deletes all knowledge
              chunks. Chat history keeps the attachment name as a record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  void handleDelete(deleteTarget)
                  setDeleteTarget(null)
                }
              }}
            >
              Remove file
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
