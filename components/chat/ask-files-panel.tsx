'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Database,
  FileText,
  Loader2,
  RefreshCcw,
  Search,
  Send,
} from 'lucide-react'
import { useChatContext } from '@/lib/chat-context'
import { cn } from '@/lib/utils'
import { Attachment, FileIntelligence } from '@/types'
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
import { Textarea } from '@/components/ui/textarea'

const PROJECT_FILTER_ALL = 'all'

type AskFilesScope = 'selected' | 'project'

function formatBytes(value: number | null | undefined) {
  if (!value) return 'Size unknown'
  if (value < 1024) return `${value} B`

  const units = ['KB', 'MB', 'GB']
  let size = value / 1024
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not yet'

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function fileToAttachment(file: FileIntelligence): Attachment {
  const mimeType = file.mimeType ?? 'application/octet-stream'

  return {
    id: `file-${file.id}`,
    kind: mimeType.startsWith('image/') ? 'image' : 'document',
    name: file.fileName,
    mimeType,
    size: file.byteSize ?? 0,
    createdAt: file.createdAt,
    fileId: file.id,
  }
}

function buildAskFilesPrompt(question: string, files: FileIntelligence[]) {
  const fileList = files
    .map((file, index) => `${index + 1}. ${file.fileName}`)
    .join('\n')

  return `Answer the question using the indexed uploaded file knowledge for the files listed below. If retrieved snippets are incomplete or do not answer the question, say what is missing instead of guessing. Mention which file names shaped the answer when useful.\n\nFiles in scope:\n${fileList}\n\nQuestion:\n${question.trim()}`
}

function statusTone(file: FileIntelligence) {
  switch (file.knowledgeStatus) {
    case 'indexed':
      return 'border-code/40 bg-code/10 text-code'
    case 'failed':
      return 'border-destructive/40 bg-destructive/10 text-destructive'
    case 'pending':
      return 'border-live/35 bg-live/10 text-live'
    default:
      return 'border-muted-foreground/30 bg-muted/40 text-muted-foreground'
  }
}

export function AskFilesPanel() {
  const {
    projects,
    selectedProjectId,
    workspaceToolRequest,
    clearWorkspaceToolRequest,
    listFileIntelligence,
    sendMessage,
    setSelectedProjectId,
  } = useChatContext()
  const [open, setOpen] = useState(false)
  const [files, setFiles] = useState<FileIntelligence[]>([])
  const [embeddingsAvailable, setEmbeddingsAvailable] = useState(true)
  const [projectFilter, setProjectFilter] = useState<string>(PROJECT_FILTER_ALL)
  const [scope, setScope] = useState<AskFilesScope>('selected')
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [question, setQuestion] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const concreteProjectId =
    projectFilter === PROJECT_FILTER_ALL ? null : projectFilter

  const projectName = concreteProjectId
    ? projects.find((project) => project.id === concreteProjectId)?.name ??
      concreteProjectId
    : 'All projects'

  const scopedFiles = useMemo(
    () =>
      files
        .filter((file) => {
          if (concreteProjectId) return file.projectId === concreteProjectId
          return true
        })
        .sort((a, b) => {
          if (a.knowledgeStatus === b.knowledgeStatus) {
            return b.createdAt.localeCompare(a.createdAt)
          }
          if (a.knowledgeStatus === 'indexed') return -1
          if (b.knowledgeStatus === 'indexed') return 1
          return a.knowledgeStatus.localeCompare(b.knowledgeStatus)
        }),
    [concreteProjectId, files]
  )

  const filteredFiles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return scopedFiles
      .filter((file) => {
        if (!normalizedQuery) return true

        return [
          file.fileName,
          file.mimeType,
          file.knowledgeStatus,
          file.knowledgeStatusLabel,
          file.knowledgeReason,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery)
      })
  }, [query, scopedFiles])

  const projectIndexedFiles = useMemo(
    () => scopedFiles.filter((file) => file.knowledgeStatus === 'indexed'),
    [scopedFiles]
  )

  const selectedIndexedFiles = useMemo(() => {
    if (scope === 'project') return projectIndexedFiles

    const selected = new Set(selectedFileIds)
    return files.filter(
      (file) => selected.has(file.id) && file.knowledgeStatus === 'indexed'
    )
  }, [files, projectIndexedFiles, scope, selectedFileIds])

  const selectedProjectIds = useMemo(
    () => [
      ...new Set(
        selectedIndexedFiles
          .map((file) => file.projectId)
          .filter(Boolean) as string[]
      ),
    ],
    [selectedIndexedFiles]
  )
  const hasMixedProjectSelection =
    scope === 'selected' && !concreteProjectId && selectedProjectIds.length > 1
  const resolvedAskProjectId =
    concreteProjectId ??
    (selectedProjectIds.length === 1 ? selectedProjectIds[0] : null)

  const loadFiles = useCallback(async () => {
    if (!open) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await listFileIntelligence({
        projectId: concreteProjectId,
      })
      setFiles(response.files)
      setEmbeddingsAvailable(response.embeddingsAvailable)
      setSelectedFileIds((current) =>
        current.filter((id) => response.files.some((file) => file.id === id))
      )
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Unable to load files.'
      )
      setFiles([])
    } finally {
      setIsLoading(false)
    }
  }, [concreteProjectId, listFileIntelligence, open])

  useEffect(() => {
    if (workspaceToolRequest?.tool !== 'ask-files') return

    const requestedProjectId =
      workspaceToolRequest.projectId ??
      (selectedProjectId === 'all' ? null : selectedProjectId)

    setOpen(true)
    setProjectFilter(requestedProjectId ?? PROJECT_FILTER_ALL)
    setScope(workspaceToolRequest.fileId ? 'selected' : 'project')
    setSelectedFileIds(
      workspaceToolRequest.fileId ? [workspaceToolRequest.fileId] : []
    )
    setNotice(null)
    clearWorkspaceToolRequest(workspaceToolRequest.requestId)
  }, [
    clearWorkspaceToolRequest,
    selectedProjectId,
    workspaceToolRequest,
  ])

  useEffect(() => {
    void loadFiles()
  }, [loadFiles])

  const toggleFile = (fileId: string, checked: boolean) => {
    setSelectedFileIds((current) => {
      if (checked) return [...new Set([...current, fileId])]
      return current.filter((id) => id !== fileId)
    })
  }

  const handleSubmit = async () => {
    const trimmedQuestion = question.trim()
    if (!trimmedQuestion || selectedIndexedFiles.length === 0) return
    if (scope === 'project' && !concreteProjectId) return
    if (hasMixedProjectSelection) return

    setIsSending(true)
    setError(null)
    setNotice(null)

    try {
      if (resolvedAskProjectId) {
        setSelectedProjectId(resolvedAskProjectId)
      }

      await sendMessage({
        content: buildAskFilesPrompt(trimmedQuestion, selectedIndexedFiles),
        attachments: selectedIndexedFiles.map(fileToAttachment),
        kind: 'chat',
        modeOverride: 'general',
        customAssistantId: null,
        settingsPatch: { fileContext: true },
        projectIdOverride: resolvedAskProjectId,
      })
      setNotice(`Asked Nova about ${selectedIndexedFiles.length} indexed file(s).`)
      setQuestion('')
      setOpen(false)
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : 'Unable to ask about these files.'
      )
    } finally {
      setIsSending(false)
    }
  }

  const canSubmit =
    embeddingsAvailable &&
    question.trim().length > 0 &&
    selectedIndexedFiles.length > 0 &&
    !(scope === 'project' && !concreteProjectId) &&
    !hasMixedProjectSelection &&
    !isSending

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex max-h-[88vh] max-w-5xl flex-col overflow-hidden rounded-2xl border-border/70 bg-background/95 p-0 shadow-2xl">
        <DialogHeader className="border-b border-border/60 px-6 py-5">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Database className="size-5 text-primary" />
            Ask Files
          </DialogTitle>
          <DialogDescription>
            Ask questions against indexed text and code-like uploads using the
            existing private file knowledge system.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[360px_1fr]">
          <div className="min-h-0 border-b border-border/60 p-4 lg:border-b-0 lg:border-r">
            <div className="space-y-3">
              <Select
                value={projectFilter}
                onValueChange={(value) => {
                  setProjectFilter(value)
                  setSelectedFileIds([])
                  setScope(value === PROJECT_FILTER_ALL ? 'selected' : 'project')
                }}
              >
                <SelectTrigger className="h-10 rounded-xl bg-card/45">
                  <SelectValue placeholder="Project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PROJECT_FILTER_ALL}>All projects</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={scope === 'selected' ? 'secondary' : 'outline'}
                  className="rounded-xl"
                  onClick={() => setScope('selected')}
                >
                  Selected files
                </Button>
                <Button
                  type="button"
                  variant={scope === 'project' ? 'secondary' : 'outline'}
                  className="rounded-xl"
                  disabled={!concreteProjectId}
                  onClick={() => setScope('project')}
                >
                  Current project
                </Button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filter files..."
                  className="h-10 rounded-xl bg-card/45 pl-9"
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>{projectIndexedFiles.length} indexed</span>
              <span>{filteredFiles.length} visible</span>
            </div>

            <ScrollArea className="mt-3 h-[42vh] pr-3">
              {isLoading ? (
                <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card/45 px-4 py-6 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading files...
                </div>
              ) : filteredFiles.length > 0 ? (
                <div className="space-y-2">
                  {filteredFiles.map((file) => {
                    const isIndexed = file.knowledgeStatus === 'indexed'
                    const checked =
                      scope === 'project'
                        ? isIndexed
                        : selectedFileIds.includes(file.id)

                    const canToggle = isIndexed && scope !== 'project'

                    return (
                      <div
                        key={file.id}
                        role={canToggle ? 'button' : undefined}
                        tabIndex={canToggle ? 0 : undefined}
                        aria-disabled={!canToggle}
                        className={cn(
                          'w-full rounded-2xl border border-border/60 bg-card/40 p-3 text-left transition-colors',
                          isIndexed
                            ? 'hover:border-primary/35 hover:bg-card/65'
                            : 'opacity-75',
                          checked && isIndexed && 'border-primary/45 bg-primary/10'
                        )}
                        onClick={() => {
                          if (canToggle) toggleFile(file.id, !checked)
                        }}
                        onKeyDown={(event) => {
                          if (!canToggle) return
                          if (event.key !== 'Enter' && event.key !== ' ') return
                          event.preventDefault()
                          toggleFile(file.id, !checked)
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            className="mt-1"
                            checked={checked}
                            disabled={!isIndexed || scope === 'project'}
                            onCheckedChange={(value) =>
                              toggleFile(file.id, Boolean(value))
                            }
                            onClick={(event) => event.stopPropagation()}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <FileText className="size-4 shrink-0 text-muted-foreground" />
                              <p className="truncate text-sm font-medium text-foreground">
                                {file.fileName}
                              </p>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              <Badge
                                variant="outline"
                                className={cn('rounded-full', statusTone(file))}
                              >
                                {isIndexed ? (
                                  <CheckCircle2 className="mr-1 size-3" />
                                ) : null}
                                {file.knowledgeStatusLabel}
                              </Badge>
                              <Badge variant="outline" className="rounded-full">
                                {file.chunkCount} chunks
                              </Badge>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                              {file.mimeType ?? 'Unknown type'} /{' '}
                              {formatBytes(file.byteSize)} /{' '}
                              {formatDate(file.createdAt)}
                            </p>
                            {file.knowledgeReason ? (
                              <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                                {file.knowledgeReason}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border/70 bg-card/25 px-4 py-6 text-sm text-muted-foreground">
                  No files match this scope.
                </div>
              )}
            </ScrollArea>
          </div>

          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
            {error ? (
              <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>Ask Files unavailable</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {notice ? (
              <Alert className="border-primary/30 bg-primary/10">
                <CheckCircle2 className="size-4" />
                <AlertTitle>Sent</AlertTitle>
                <AlertDescription>{notice}</AlertDescription>
              </Alert>
            ) : null}

            {!embeddingsAvailable ? (
              <Alert className="border-yellow-500/40 bg-yellow-500/10 text-yellow-100">
                <AlertCircle className="size-4" />
                <AlertTitle>Embeddings are not configured</AlertTitle>
                <AlertDescription>
                  Ask Files needs the server-side embedding configuration before
                  uploaded-file retrieval can run. Files remain private, but the
                  app will not claim knowledge retrieval until embeddings are enabled.
                </AlertDescription>
              </Alert>
            ) : null}

            {embeddingsAvailable && projectIndexedFiles.length === 0 ? (
              <Alert className="border-border/70 bg-card/45">
                <AlertCircle className="size-4" />
                <AlertTitle>No indexed files in this scope</AlertTitle>
                <AlertDescription>
                  Upload text or code-like files, then index them before asking.
                  PDFs and OCR-heavy documents are not parsed in this milestone.
                  If every file is pending or failed, verify pgvector and embedding
                  setup before relying on retrieval.
                </AlertDescription>
              </Alert>
            ) : null}

            {scope === 'project' && !concreteProjectId ? (
              <Alert className="border-border/70 bg-card/45">
                <AlertCircle className="size-4" />
                <AlertTitle>Select a project</AlertTitle>
                <AlertDescription>
                  Project-wide Ask Files needs a concrete project. Switch to
                  selected files or choose a project from the filter.
                </AlertDescription>
              </Alert>
            ) : null}

            {hasMixedProjectSelection ? (
              <Alert className="border-border/70 bg-card/45">
                <AlertCircle className="size-4" />
                <AlertTitle>Choose one project at a time</AlertTitle>
                <AlertDescription>
                  Selected files span multiple projects. Pick a project filter or
                  select files from a single project so the chat context stays
                  correctly scoped.
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="rounded-2xl border border-border/60 bg-card/45 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Files that will be used
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Scope: {scope === 'project' ? projectName : 'selected files'}
                  </p>
                </div>
                <Badge variant="secondary" className="rounded-full">
                  {selectedIndexedFiles.length} indexed file
                  {selectedIndexedFiles.length === 1 ? '' : 's'}
                </Badge>
              </div>
              {selectedIndexedFiles.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedIndexedFiles.slice(0, 10).map((file) => (
                    <span
                      key={file.id}
                      className="rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-xs text-muted-foreground"
                    >
                      {file.fileName}
                    </span>
                  ))}
                  {selectedIndexedFiles.length > 10 ? (
                    <span className="rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-xs text-muted-foreground">
                      +{selectedIndexedFiles.length - 10} more
                    </span>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 rounded-xl border border-dashed border-border/60 bg-background/35 px-3 py-4 text-sm text-muted-foreground">
                  Choose one or more indexed files before asking.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label
                htmlFor="ask-files-question"
                className="text-sm font-medium text-foreground"
              >
                Question
              </label>
              <Textarea
                id="ask-files-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask a question about the selected files..."
                className="min-h-36 rounded-2xl bg-card/45"
              />
              <p className="text-xs leading-5 text-muted-foreground">
                Sending uses normal Nova text chat, fileContext retrieval, plan
                limits, and billing. Source snippets appear only when the RAG
                path returns chunk-level sources.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => void loadFiles()}
                disabled={isLoading || isSending}
              >
                <RefreshCcw className="mr-2 size-4" />
                Refresh
              </Button>
              <Button
                type="button"
                className="rounded-xl"
                disabled={!canSubmit}
                onClick={() => void handleSubmit()}
              >
                {isSending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Send className="mr-2 size-4" />
                )}
                Ask files
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
