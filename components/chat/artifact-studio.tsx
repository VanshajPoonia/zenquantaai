'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Check,
  Clipboard,
  CopyPlus,
  Download,
  FilePlus2,
  FileText,
  History,
  Loader2,
  PencilLine,
  Plus,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import {
  ARTIFACT_ACTION_LABELS,
  ARTIFACT_ACTION_TYPES,
} from '@/lib/artifacts/actions'
import { ARTIFACT_SOURCE_TYPES, ARTIFACT_TYPES } from '@/lib/artifacts/validation'
import { useChatContext } from '@/lib/chat-context'
import { cn } from '@/lib/utils'
import { downloadTextFile } from '@/lib/utils/export'
import {
  Artifact,
  ArtifactActionResponse,
  ArtifactActionType,
  ArtifactSourceType,
  ArtifactType,
  ArtifactVersion,
  Project,
} from '@/types'
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
import { Textarea } from '@/components/ui/textarea'

const ARTIFACT_TYPE_LABELS: Record<ArtifactType, string> = {
  document: 'Document',
  code: 'Code',
  table: 'Table',
  image_prompt: 'Image prompt',
  research_report: 'Research report',
  brand_asset: 'Brand asset',
  checklist: 'Checklist',
  workflow_output: 'Workflow output',
}

const SOURCE_TYPE_LABELS: Record<ArtifactSourceType, string> = {
  chat_message: 'Chat',
  model_comparison: 'Comparison',
  workflow_run: 'Workflow',
  manual: 'Manual',
  prism_prompt: 'Prism',
  pulse_report: 'Pulse',
}

interface ArtifactDraft {
  id?: string
  title: string
  content: string
  artifactType: ArtifactType
  projectId: string | null
  sourceType: ArtifactSourceType
  metadata: Record<string, unknown>
}

function getProjectName(projects: Project[], projectId?: string | null) {
  if (!projectId) return 'No project'
  return projects.find((project) => project.id === projectId)?.name ?? projectId
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function getVersionActionLabel(action?: string | null) {
  if (!action) return 'Saved version'
  if (action === 'restore_version') return 'Restored version'
  if (action in ARTIFACT_ACTION_LABELS) {
    return ARTIFACT_ACTION_LABELS[action as ArtifactActionType]
  }

  return action.replace(/_/g, ' ')
}

function artifactToDraft(artifact: Artifact): ArtifactDraft {
  return {
    id: artifact.id,
    title: artifact.title,
    content: artifact.content,
    artifactType: artifact.artifactType,
    projectId: artifact.projectId ?? null,
    sourceType: artifact.sourceType,
    metadata: artifact.metadata,
  }
}

function createEmptyDraft(projectId: string | null): ArtifactDraft {
  return {
    title: 'Untitled artifact',
    content: '',
    artifactType: 'document',
    projectId,
    sourceType: 'manual',
    metadata: {},
  }
}

function matchesLocalQuery(artifact: Artifact, query: string) {
  if (!query.trim()) return true
  const normalized = query.toLowerCase()
  return `${artifact.title} ${artifact.content} ${artifact.artifactType} ${artifact.sourceType}`
    .toLowerCase()
    .includes(normalized)
}

export function ArtifactStudio() {
  const {
    projects,
    selectedProjectId,
    workspaceToolRequest,
    clearWorkspaceToolRequest,
    listArtifacts,
    saveArtifact,
    updateArtifact,
    deleteArtifact,
    runArtifactAction,
    listArtifactVersions,
    restoreArtifactVersion,
    duplicateArtifactVersion,
  } = useChatContext()
  const [open, setOpen] = useState(false)
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null)
  const [draft, setDraft] = useState<ArtifactDraft>(() => createEmptyDraft(null))
  const [query, setQuery] = useState('')
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [pendingFocusArtifactId, setPendingFocusArtifactId] = useState<string | null>(
    null
  )
  const [artifactPendingDelete, setArtifactPendingDelete] =
    useState<Artifact | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [selectedActionType, setSelectedActionType] =
    useState<ArtifactActionType>('improve_writing')
  const [isRunningAction, setIsRunningAction] = useState(false)
  const [actionPreview, setActionPreview] =
    useState<ArtifactActionResponse | null>(null)
  const [copied, setCopied] = useState(false)
  const [previewCopied, setPreviewCopied] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [versions, setVersions] = useState<ArtifactVersion[]>([])
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const [isLoadingVersions, setIsLoadingVersions] = useState(false)
  const [isRestoringVersion, setIsRestoringVersion] = useState(false)
  const [isDuplicatingVersion, setIsDuplicatingVersion] = useState(false)
  const [versionCopied, setVersionCopied] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const defaultProjectId =
    selectedProjectId === 'all' ? null : selectedProjectId
  const selectedArtifactId = selectedArtifact?.id ?? null
  const filteredArtifacts = useMemo(
    () => artifacts.filter((artifact) => matchesLocalQuery(artifact, query)),
    [artifacts, query]
  )
  const selectedVersion =
    versions.find((version) => version.id === selectedVersionId) ??
    versions[0] ??
    null

  const selectArtifact = useCallback((artifact: Artifact) => {
    setSelectedArtifact(artifact)
    setDraft(artifactToDraft(artifact))
    setActionPreview(null)
    setPreviewCopied(false)
    setActionError(null)
  }, [])

  const loadArtifacts = useCallback(
    async (focusArtifactId?: string | null) => {
      if (!open) return

      setIsLoading(true)
      setError(null)

      try {
        const nextArtifacts = await listArtifacts({
          projectId: projectFilter === 'all' ? null : projectFilter,
          q: query,
          artifactType:
            typeFilter === 'all' ? null : (typeFilter as ArtifactType),
          sourceType:
            sourceFilter === 'all' ? null : (sourceFilter as ArtifactSourceType),
        })
        setArtifacts(nextArtifacts)

        const focused =
          nextArtifacts.find(
            (artifact) => artifact.id === (focusArtifactId ?? pendingFocusArtifactId)
          ) ?? null
        const refreshedSelected =
          nextArtifacts.find((artifact) => artifact.id === selectedArtifactId) ?? null

        if (focused) {
          selectArtifact(focused)
          setPendingFocusArtifactId(null)
        } else if (refreshedSelected) {
          selectArtifact(refreshedSelected)
        } else if (!selectedArtifactId && nextArtifacts[0]) {
          selectArtifact(nextArtifacts[0])
        }
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load artifacts.'
        )
      } finally {
        setIsLoading(false)
      }
    },
    [
      listArtifacts,
      open,
      pendingFocusArtifactId,
      projectFilter,
      query,
      selectArtifact,
      selectedArtifactId,
      sourceFilter,
      typeFilter,
    ]
  )

  useEffect(() => {
    if (workspaceToolRequest?.tool !== 'artifacts') return

    setOpen(true)
    setPendingFocusArtifactId(workspaceToolRequest.artifactId ?? null)
    setProjectFilter(workspaceToolRequest.projectId ?? 'all')
    clearWorkspaceToolRequest(workspaceToolRequest.requestId)
  }, [clearWorkspaceToolRequest, workspaceToolRequest])

  useEffect(() => {
    if (!open) return
    void loadArtifacts()
  }, [loadArtifacts, open])

  const startNewArtifact = () => {
    setSelectedArtifact(null)
    setDraft(createEmptyDraft(defaultProjectId))
    setActionPreview(null)
    setPreviewCopied(false)
    setActionError(null)
  }

  const saveDraft = async () => {
    const title = draft.title.trim()
    const content = draft.content

    if (!title || !content.trim()) {
      setError('Title and content are required.')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const saved = draft.id
        ? await updateArtifact(draft.id, {
            title,
            content,
            artifactType: draft.artifactType,
            projectId: draft.projectId,
            metadata: draft.metadata,
          })
        : await saveArtifact({
            title,
            content,
            artifactType: draft.artifactType,
            projectId: draft.projectId,
            sourceType: draft.sourceType,
            metadata: draft.metadata,
          })

      if (!saved) {
        setError('Artifact could not be saved.')
        return
      }

      selectArtifact(saved)
      setActionPreview(null)
      await loadArtifacts(saved.id)
    } finally {
      setIsSaving(false)
    }
  }

  const copyDraft = async () => {
    if (!draft.content.trim()) return
    await navigator.clipboard.writeText(draft.content)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  const exportDraft = () => {
    if (!draft.content.trim()) return
    const safeTitle = draft.title.trim().replace(/[^a-z0-9_-]+/gi, '-').toLowerCase()
    downloadTextFile(`${safeTitle || 'artifact'}.md`, draft.content, 'text/markdown')
  }

  const runSelectedAction = async () => {
    if (!draft.id) {
      setActionError('Save the artifact before running AI actions.')
      return
    }

    if (!draft.content.trim()) {
      setActionError('Artifact content is required before running AI actions.')
      return
    }

    setIsRunningAction(true)
    setActionPreview(null)
    setPreviewCopied(false)
    setActionError(null)

    try {
      const result = await runArtifactAction(draft.id, selectedActionType)
      setActionPreview(result)
    } catch (actionError) {
      setActionError(
        actionError instanceof Error
          ? actionError.message
          : 'Unable to run artifact action.'
      )
    } finally {
      setIsRunningAction(false)
    }
  }

  const applyActionPreview = () => {
    if (!actionPreview) return

    setDraft((previous) => ({
      ...previous,
      content: actionPreview.content,
      metadata: {
        ...previous.metadata,
        lastArtifactAction: {
          actionType: actionPreview.actionType,
          assistantFamily: actionPreview.assistantFamily,
          mode: actionPreview.mode,
          model: actionPreview.model,
          appliedAt: new Date().toISOString(),
        },
      },
    }))
    setActionPreview(null)
    setPreviewCopied(false)
    setActionError(null)
  }

  const copyActionPreview = async () => {
    if (!actionPreview?.content.trim()) return

    await navigator.clipboard.writeText(actionPreview.content)
    setPreviewCopied(true)
    window.setTimeout(() => setPreviewCopied(false), 1800)
  }

  const confirmDelete = async () => {
    if (!artifactPendingDelete) return

    setIsDeleting(true)
    try {
      await deleteArtifact(artifactPendingDelete.id)
      if (selectedArtifact?.id === artifactPendingDelete.id) {
        setSelectedArtifact(null)
        setDraft(createEmptyDraft(defaultProjectId))
      }
      setArtifactPendingDelete(null)
      await loadArtifacts()
    } finally {
      setIsDeleting(false)
    }
  }

  const loadVersions = async (artifactId: string, focusVersionId?: string | null) => {
    setIsLoadingVersions(true)
    setHistoryError(null)

    try {
      const nextVersions = await listArtifactVersions(artifactId)
      setVersions(nextVersions)
      setSelectedVersionId(focusVersionId ?? nextVersions[0]?.id ?? null)
    } catch (versionError) {
      setHistoryError(
        versionError instanceof Error
          ? versionError.message
          : 'Unable to load version history.'
      )
      setVersions([])
      setSelectedVersionId(null)
    } finally {
      setIsLoadingVersions(false)
    }
  }

  const openHistory = async () => {
    if (!selectedArtifact) return

    setHistoryOpen(true)
    setVersionCopied(false)
    await loadVersions(selectedArtifact.id)
  }

  const copySelectedVersion = async () => {
    if (!selectedVersion?.content.trim()) return

    await navigator.clipboard.writeText(selectedVersion.content)
    setVersionCopied(true)
    window.setTimeout(() => setVersionCopied(false), 1800)
  }

  const restoreSelectedVersion = async () => {
    if (!selectedArtifact || !selectedVersion) return

    setIsRestoringVersion(true)
    setHistoryError(null)

    try {
      const restored = await restoreArtifactVersion(
        selectedArtifact.id,
        selectedVersion.id
      )

      if (!restored) {
        setHistoryError('Artifact version could not be restored.')
        return
      }

      selectArtifact(restored)
      setActionPreview(null)
      await loadArtifacts(restored.id)
      await loadVersions(restored.id)
    } finally {
      setIsRestoringVersion(false)
    }
  }

  const duplicateSelectedVersion = async () => {
    if (!selectedArtifact || !selectedVersion) return

    setIsDuplicatingVersion(true)
    setHistoryError(null)

    try {
      const duplicated = await duplicateArtifactVersion(
        selectedArtifact.id,
        selectedVersion.id
      )

      if (!duplicated) {
        setHistoryError('Artifact version could not be duplicated.')
        return
      }

      selectArtifact(duplicated)
      setHistoryOpen(false)
      setActionPreview(null)
      await loadArtifacts(duplicated.id)
    } finally {
      setIsDuplicatingVersion(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-6xl overflow-hidden rounded-2xl border-border/70 bg-background/95 p-0">
          <DialogHeader className="border-b border-border/70 px-4 py-4 text-left sm:px-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="size-5" />
                  Artifact Studio
                </DialogTitle>
                <DialogDescription>
                  Editable snapshots saved from Zenquanta outputs.
                </DialogDescription>
              </div>
              <Button type="button" className="rounded-xl" onClick={startNewArtifact}>
                <Plus className="mr-2 size-4" />
                New artifact
              </Button>
            </div>
          </DialogHeader>

          <div className="grid min-h-0 gap-0 lg:grid-cols-[360px_1fr]">
            <aside className="flex max-h-[72vh] min-h-0 flex-col border-b border-border/70 lg:border-b-0 lg:border-r">
              <div className="space-y-3 border-b border-border/70 p-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search artifacts..."
                    className="h-10 rounded-xl pl-9"
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                  <Select value={projectFilter} onValueChange={setProjectFilter}>
                    <SelectTrigger className="w-full rounded-xl">
                      <SelectValue placeholder="Project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All projects</SelectItem>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-full rounded-xl">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      {ARTIFACT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {ARTIFACT_TYPE_LABELS[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={sourceFilter} onValueChange={setSourceFilter}>
                    <SelectTrigger className="w-full rounded-xl">
                      <SelectValue placeholder="Source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All sources</SelectItem>
                      {ARTIFACT_SOURCE_TYPES.map((sourceType) => (
                        <SelectItem key={sourceType} value={sourceType}>
                          {SOURCE_TYPE_LABELS[sourceType]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {isLoading ? (
                  <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card/40 px-4 py-5 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading artifacts...
                  </div>
                ) : error ? (
                  <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-5 text-sm text-destructive">
                    {error}
                  </div>
                ) : filteredArtifacts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/60 bg-card/25 px-4 py-8 text-center text-sm text-muted-foreground">
                    No artifacts match the current filters.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredArtifacts.map((artifact) => (
                      <button
                        key={artifact.id}
                        type="button"
                        className={cn(
                          'w-full rounded-2xl border p-3 text-left transition-colors',
                          selectedArtifact?.id === artifact.id
                            ? 'border-primary/50 bg-primary/10'
                            : 'border-border/60 bg-card/40 hover:border-primary/30 hover:bg-card/70'
                        )}
                        onClick={() => selectArtifact(artifact)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {artifact.title}
                            </p>
                            <p className="mt-1 truncate text-xs text-muted-foreground">
                              {getProjectName(projects, artifact.projectId)}
                            </p>
                          </div>
                          <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <Badge variant="outline" className="rounded-full">
                            {ARTIFACT_TYPE_LABELS[artifact.artifactType]}
                          </Badge>
                          <Badge variant="secondary" className="rounded-full">
                            {SOURCE_TYPE_LABELS[artifact.sourceType]}
                          </Badge>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {formatDate(artifact.updatedAt)}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </aside>

            <section className="flex max-h-[72vh] min-h-0 flex-col">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {draft.id ? (
                    <PencilLine className="size-4" />
                  ) : (
                    <FilePlus2 className="size-4" />
                  )}
                  {draft.id ? 'Editing artifact' : 'New artifact'}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    disabled={!draft.content.trim()}
                    onClick={() => void copyDraft()}
                  >
                    <Clipboard className="mr-2 size-4" />
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    disabled={!draft.content.trim()}
                    onClick={exportDraft}
                  >
                    <Download className="mr-2 size-4" />
                    Export
                  </Button>
                  {selectedArtifact ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => void openHistory()}
                    >
                      <History className="mr-2 size-4" />
                      History
                    </Button>
                  ) : null}
                  {selectedArtifact ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-xl text-destructive hover:text-destructive"
                      onClick={() => setArtifactPendingDelete(selectedArtifact)}
                    >
                      <Trash2 className="mr-2 size-4" />
                      Delete
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-xl"
                    disabled={isSaving}
                    onClick={() => void saveDraft()}
                  >
                    {isSaving ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 size-4" />
                    )}
                    Save
                  </Button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <div className="mb-3 rounded-2xl border border-border/70 bg-card/35 p-3">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Sparkles className="size-4 text-primary" />
                        Artifact actions
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Preview edits before applying them.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Select
                        value={selectedActionType}
                        onValueChange={(value) =>
                          setSelectedActionType(value as ArtifactActionType)
                        }
                      >
                        <SelectTrigger className="h-10 w-full rounded-xl sm:w-[230px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ARTIFACT_ACTION_TYPES.map((actionType) => (
                            <SelectItem key={actionType} value={actionType}>
                              {ARTIFACT_ACTION_LABELS[actionType]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 rounded-xl"
                        disabled={
                          isRunningAction || !draft.id || !draft.content.trim()
                        }
                        onClick={() => void runSelectedAction()}
                      >
                        {isRunningAction ? (
                          <Loader2 className="mr-2 size-4 animate-spin" />
                        ) : (
                          <Sparkles className="mr-2 size-4" />
                        )}
                        Run action
                      </Button>
                    </div>
                  </div>
                  {!draft.id ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Save this artifact before running AI actions.
                    </p>
                  ) : null}
                  {actionError ? (
                    <p className="mt-2 rounded-xl border border-destructive/35 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      {actionError}
                    </p>
                  ) : null}
                </div>

                {actionPreview ? (
                  <div className="mb-3 rounded-2xl border border-primary/35 bg-primary/10 p-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {ARTIFACT_ACTION_LABELS[actionPreview.actionType]} preview
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Review this draft before applying it to the editor.
                          {actionPreview.truncated
                            ? ' The source artifact was truncated for request size.'
                            : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                          onClick={() => void copyActionPreview()}
                        >
                          <Clipboard className="mr-2 size-4" />
                          {previewCopied ? 'Copied' : 'Copy'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                          onClick={() => setActionPreview(null)}
                        >
                          <X className="mr-2 size-4" />
                          Dismiss
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="rounded-xl"
                          onClick={applyActionPreview}
                        >
                          <Check className="mr-2 size-4" />
                          Apply
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl border border-border/60 bg-background/60 p-3 font-mono text-xs leading-6 text-foreground">
                      {actionPreview.content}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
                  <Input
                    value={draft.title}
                    onChange={(event) =>
                      setDraft((previous) => ({
                        ...previous,
                        title: event.target.value,
                      }))
                    }
                    className="h-11 rounded-xl"
                    placeholder="Artifact title"
                  />
                  <Select
                    value={draft.artifactType}
                    onValueChange={(value) =>
                      setDraft((previous) => ({
                        ...previous,
                        artifactType: value as ArtifactType,
                      }))
                    }
                  >
                    <SelectTrigger className="h-11 w-full rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ARTIFACT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {ARTIFACT_TYPE_LABELS[type]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={draft.projectId ?? 'none'}
                    onValueChange={(value) =>
                      setDraft((previous) => ({
                        ...previous,
                        projectId: value === 'none' ? null : value,
                      }))
                    }
                  >
                    <SelectTrigger className="h-11 w-full rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No project</SelectItem>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Textarea
                  value={draft.content}
                  onChange={(event) => {
                    setDraft((previous) => ({
                      ...previous,
                      content: event.target.value,
                    }))
                    setActionPreview(null)
                    setActionError(null)
                  }}
                  placeholder="Write or paste artifact content..."
                  className="mt-3 min-h-[46vh] resize-y rounded-2xl border-border/70 bg-card/35 font-mono text-sm leading-6"
                />

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="rounded-full">
                    {SOURCE_TYPE_LABELS[draft.sourceType]}
                  </Badge>
                  <span>{draft.content.length} characters</span>
                  {selectedArtifact ? (
                    <span>Updated {formatDate(selectedArtifact.updatedAt)}</span>
                  ) : null}
                </div>
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[88vh] w-[calc(100vw-1rem)] max-w-5xl overflow-hidden rounded-2xl border-border/70 bg-background/95 p-0">
          <DialogHeader className="border-b border-border/70 px-4 py-4 text-left sm:px-6">
            <DialogTitle className="flex items-center gap-2">
              <History className="size-5" />
              Version history
            </DialogTitle>
            <DialogDescription>
              Review saved artifact states, restore an earlier version, or duplicate
              a version into a new artifact.
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 gap-0 lg:grid-cols-[320px_1fr]">
            <aside className="max-h-[70vh] min-h-0 overflow-y-auto border-b border-border/70 p-3 lg:border-b-0 lg:border-r">
              {isLoadingVersions ? (
                <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card/40 px-4 py-5 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading versions...
                </div>
              ) : historyError ? (
                <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-5 text-sm text-destructive">
                  {historyError}
                </div>
              ) : versions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/60 bg-card/25 px-4 py-8 text-center text-sm text-muted-foreground">
                  No saved versions are available yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {versions.map((version) => (
                    <button
                      key={version.id}
                      type="button"
                      className={cn(
                        'w-full rounded-2xl border p-3 text-left transition-colors',
                        selectedVersion?.id === version.id
                          ? 'border-primary/50 bg-primary/10'
                          : 'border-border/60 bg-card/40 hover:border-primary/30 hover:bg-card/70'
                      )}
                      onClick={() => {
                        setSelectedVersionId(version.id)
                        setVersionCopied(false)
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {version.title}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDateTime(version.createdAt)}
                          </p>
                        </div>
                        <Badge variant="secondary" className="rounded-full">
                          {ARTIFACT_TYPE_LABELS[version.artifactType]}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <Badge variant="outline" className="rounded-full">
                          {getVersionActionLabel(version.createdByAction)}
                        </Badge>
                        <Badge variant="outline" className="rounded-full">
                          {version.content.length} chars
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </aside>

            <section className="flex max-h-[70vh] min-h-0 flex-col">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {selectedVersion?.title ?? 'Select a version'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedVersion
                      ? `${formatDateTime(selectedVersion.createdAt)} · ${getVersionActionLabel(
                          selectedVersion.createdByAction
                        )}`
                      : 'Choose a saved version to preview it.'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    disabled={!selectedVersion?.content.trim()}
                    onClick={() => void copySelectedVersion()}
                  >
                    <Clipboard className="mr-2 size-4" />
                    {versionCopied ? 'Copied' : 'Copy'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    disabled={!selectedVersion || isDuplicatingVersion}
                    onClick={() => void duplicateSelectedVersion()}
                  >
                    {isDuplicatingVersion ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <CopyPlus className="mr-2 size-4" />
                    )}
                    Duplicate
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-xl"
                    disabled={!selectedVersion || isRestoringVersion}
                    onClick={() => void restoreSelectedVersion()}
                  >
                    {isRestoringVersion ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <RotateCcw className="mr-2 size-4" />
                    )}
                    Restore
                  </Button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {selectedVersion ? (
                  <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl border border-border/60 bg-card/35 p-3">
                        <p className="text-xs text-muted-foreground">Type</p>
                        <p className="mt-1 text-sm text-foreground">
                          {ARTIFACT_TYPE_LABELS[selectedVersion.artifactType]}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-card/35 p-3">
                        <p className="text-xs text-muted-foreground">Saved</p>
                        <p className="mt-1 text-sm text-foreground">
                          {formatDateTime(selectedVersion.createdAt)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-card/35 p-3">
                        <p className="text-xs text-muted-foreground">Action</p>
                        <p className="mt-1 text-sm text-foreground">
                          {getVersionActionLabel(selectedVersion.createdByAction)}
                        </p>
                      </div>
                    </div>

                    <div className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-2xl border border-border/60 bg-card/35 p-3 font-mono text-xs leading-6 text-foreground">
                      {selectedVersion.content}
                    </div>

                    <div className="rounded-2xl border border-border/60 bg-card/35 p-3">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        Metadata
                      </p>
                      <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
                        {JSON.stringify(selectedVersion.metadata, null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/60 bg-card/25 px-4 py-10 text-center text-sm text-muted-foreground">
                    Select a saved version to preview title, content, metadata,
                    and restore options.
                  </div>
                )}
              </div>
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(artifactPendingDelete)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setArtifactPendingDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete artifact?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the artifact from Neon. Source chats and files are not
              deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault()
                void confirmDelete()
              }}
            >
              {isDeleting ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
