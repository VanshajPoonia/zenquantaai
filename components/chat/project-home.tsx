'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react'
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  ExternalLink,
  FileText,
  FolderOpen,
  ImageIcon,
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  Play,
  RefreshCcw,
  Search,
  Upload,
  Zap,
} from 'lucide-react'
import { MODE_CONFIGS } from '@/lib/config'
import { useChatContext } from '@/lib/chat-context'
import { cn } from '@/lib/utils'
import {
  ProjectHomeFileSummary,
  ProjectHomeGeneratedImageSummary,
  ProjectHomeResponse,
  ProjectHomeSuggestedAction,
  ProjectHomeWorkflowSummary,
} from '@/types'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface ProjectHomeProps {
  projectId: string
}

const PROJECT_UPLOAD_ACCEPT =
  'image/*,.pdf,.txt,.md,.mdx,.json,.csv,.xml,.yaml,.yml,.ts,.tsx,.js,.jsx,.css,.scss,.html,.py,.go,.java,.rb,.rs,.sql'

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not yet'

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function formatBytes(value: number | null): string {
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

function matchesSearch(query: string, ...values: Array<string | null | undefined>) {
  if (!query) return true
  const haystack = values.join(' ').toLowerCase()
  return haystack.includes(query.toLowerCase())
}

function scrollToMessage(messageId?: string | null) {
  if (!messageId) return

  window.setTimeout(() => {
    document
      .getElementById(`message-${messageId}`)
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, 180)
}

function StatTile({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string | number
  icon: ComponentType<{ className?: string }>
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/45 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </span>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="mt-3 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  )
}

function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function EmptyPanel({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-card/25 px-4 py-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}

function actionIcon(type: ProjectHomeSuggestedAction['type']) {
  switch (type) {
    case 'start_chat':
      return <MessageSquarePlus className="size-4" />
    case 'upload_file':
      return <Upload className="size-4" />
    case 'run_workflow':
      return <Play className="size-4" />
    case 'review_images':
      return <ImageIcon className="size-4" />
    case 'research_project':
      return <Zap className="size-4" />
  }
}

export function ProjectHome({ projectId }: ProjectHomeProps) {
  const {
    setSelectedProjectId,
    createNewChat,
    openConversation,
    openWorkspaceTool,
    runPromptWorkflow,
    setCurrentMode,
    uploadProjectFiles,
    openWorkspaceSearch,
  } = useChatContext()
  const [home, setHome] = useState<ProjectHomeResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [runningWorkflowId, setRunningWorkflowId] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const imagesSectionRef = useRef<HTMLDivElement | null>(null)

  const loadProjectHome = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/home`,
        {
          cache: 'no-store',
        }
      )

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null
        throw new Error(payload?.error ?? 'Unable to load project home.')
      }

      setHome((await response.json()) as ProjectHomeResponse)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load project home.'
      )
      setHome(null)
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void loadProjectHome()
  }, [loadProjectHome])

  const filteredConversations = useMemo(
    () =>
      (home?.recentConversations ?? []).filter((conversation) =>
        matchesSearch(
          query,
          conversation.title,
          conversation.preview,
          conversation.mode,
          conversation.assistantFamily
        )
      ),
    [home?.recentConversations, query]
  )

  const filteredFiles = useMemo(
    () =>
      (home?.uploadedFiles ?? []).filter((file) =>
        matchesSearch(query, file.fileName, file.mimeType)
      ),
    [home?.uploadedFiles, query]
  )

  const filteredImages = useMemo(
    () =>
      (home?.generatedImages ?? []).filter((image) =>
        matchesSearch(query, image.prompt, image.model, image.status)
      ),
    [home?.generatedImages, query]
  )

  const filteredWorkflows = useMemo(
    () =>
      (home?.workflows ?? []).filter((workflow) =>
        matchesSearch(query, workflow.title, workflow.description)
      ),
    [home?.workflows, query]
  )

  const openProjectConversation = async (
    conversationId: string | null,
    messageId?: string | null
  ) => {
    if (!conversationId) return
    await openConversation(conversationId)
    scrollToMessage(messageId)
  }

  const handleNewChat = async () => {
    setSelectedProjectId(projectId)
    await createNewChat()
  }

  const handleGenerateImage = () => {
    setSelectedProjectId(projectId)
    setCurrentMode('image')
  }

  const handleResearchProject = () => {
    setSelectedProjectId(projectId)
    setCurrentMode('live')
  }

  const handleFilesSelected = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length === 0) return

    setIsUploading(true)
    setUploadError(null)

    try {
      await uploadProjectFiles(projectId, files)
      await loadProjectHome()
    } catch (uploadFailure) {
      setUploadError(
        uploadFailure instanceof Error
          ? uploadFailure.message
          : 'Unable to upload files.'
      )
    } finally {
      setIsUploading(false)
    }
  }

  const runWorkflow = async (workflow: ProjectHomeWorkflowSummary) => {
    if (workflow.variableCount > 0) {
      openWorkspaceTool('prompt-library')
      return
    }

    setRunningWorkflowId(workflow.id)
    try {
      setSelectedProjectId(projectId)
      await runPromptWorkflow(workflow.id)
    } finally {
      setRunningWorkflowId(null)
    }
  }

  const runSuggestedAction = (action: ProjectHomeSuggestedAction) => {
    switch (action.type) {
      case 'start_chat':
        void handleNewChat()
        return
      case 'upload_file':
        uploadInputRef.current?.click()
        return
      case 'run_workflow':
        openWorkspaceTool('prompt-library')
        return
      case 'review_images':
        imagesSectionRef.current?.scrollIntoView({
          block: 'start',
          behavior: 'smooth',
        })
        return
      case 'research_project':
        handleResearchProject()
        return
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-6xl items-center justify-center px-4 py-10">
        <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/50 px-5 py-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading project home...
        </div>
      </div>
    )
  }

  if (error || !home) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Project home unavailable</AlertTitle>
          <AlertDescription>{error ?? 'Project not found.'}</AlertDescription>
        </Alert>
        <Button
          type="button"
          variant="outline"
          className="mt-4 rounded-xl"
          onClick={() => void loadProjectHome()}
        >
          <RefreshCcw className="mr-2 size-4" />
          Retry
        </Button>
      </div>
    )
  }

  const hasFilteredResults =
    filteredConversations.length > 0 ||
    filteredFiles.length > 0 ||
    filteredImages.length > 0 ||
    filteredWorkflows.length > 0

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6">
      <input
        ref={uploadInputRef}
        type="file"
        multiple
        accept={PROJECT_UPLOAD_ACCEPT}
        className="hidden"
        onChange={(event) => void handleFilesSelected(event)}
      />

      <div className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-full">
                Project Home
              </Badge>
              {home.project.isDefault ? (
                <Badge variant="outline" className="rounded-full">
                  Default
                </Badge>
              ) : null}
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
              {home.project.name}
            </h1>
            {home.project.description ? (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {home.project.description}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" className="rounded-xl" onClick={handleNewChat}>
              <MessageSquarePlus className="mr-2 size-4" />
              New chat
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={isUploading}
              onClick={() => uploadInputRef.current?.click()}
            >
              {isUploading ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Upload className="mr-2 size-4" />
              )}
              Upload file
            </Button>
          </div>
        </div>

        {uploadError ? (
          <Alert className="border-destructive/40 bg-destructive/10 text-destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Upload failed</AlertTitle>
            <AlertDescription>{uploadError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <StatTile
            label="Chats"
            value={home.overview.conversationCount}
            icon={MessageSquare}
          />
          <StatTile
            label="Messages"
            value={home.overview.messageCount}
            icon={MessageSquarePlus}
          />
          <StatTile label="Files" value={home.overview.fileCount} icon={FileText} />
          <StatTile
            label="Playbooks"
            value={home.overview.workflowCount}
            icon={BookOpen}
          />
          <StatTile
            label="Images"
            value={home.overview.generatedImageCount}
            icon={ImageIcon}
          />
          <StatTile
            label="Memory"
            value={home.overview.memoryConversationCount}
            icon={Zap}
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Button type="button" variant="secondary" onClick={handleNewChat}>
          <MessageSquarePlus className="mr-2 size-4" />
          New chat
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isUploading}
          onClick={() => uploadInputRef.current?.click()}
        >
          <Upload className="mr-2 size-4" />
          Upload file
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => openWorkspaceTool('prompt-library')}
        >
          <Play className="mr-2 size-4" />
          Run workflow
        </Button>
        <Button type="button" variant="outline" onClick={handleGenerateImage}>
          <ImageIcon className="mr-2 size-4" />
          Generate image
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            openWorkspaceSearch({ scope: 'project', projectId })
          }
        >
          <Search className="mr-2 size-4" />
          Search project
        </Button>
        <Button type="button" variant="outline" onClick={handleResearchProject}>
          <Zap className="mr-2 size-4" />
          Research
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Section title="Suggested next actions">
          {home.suggestedActions.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {home.suggestedActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className={cn(
                    'group rounded-2xl border border-border/60 bg-card/45 p-4 text-left',
                    'transition-colors hover:border-primary/35 hover:bg-card/70'
                  )}
                  onClick={() => runSuggestedAction(action)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/70 text-muted-foreground">
                        {actionIcon(action.type)}
                      </span>
                      <span>
                        <span className="block text-sm font-medium text-foreground">
                          {action.title}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                          {action.description}
                        </span>
                      </span>
                    </div>
                    <ArrowRight className="mt-1 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyPanel>This project already has the core workspace pieces.</EmptyPanel>
          )}
        </Section>

        <Section title="Memory status">
          <div className="rounded-2xl border border-border/60 bg-card/45 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-foreground">
                {home.memoryStatus.status === 'active' ? 'Active' : 'No saved memory'}
              </span>
              <Badge variant="outline" className="rounded-full">
                {home.memoryStatus.memoryConversationCount}/
                {home.memoryStatus.conversationCount}
              </Badge>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Latest update: {formatDate(home.memoryStatus.latestMemoryUpdatedAt)}
            </p>
          </div>
        </Section>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search this project home..."
          className="h-11 rounded-2xl border-border/60 bg-card/45 pl-10"
        />
      </div>

      {query && !hasFilteredResults ? (
        <EmptyPanel>No project items match {query}.</EmptyPanel>
      ) : null}

      <Section title="Recent conversations">
        {filteredConversations.length > 0 ? (
          <div className="grid gap-3">
            {filteredConversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                className="rounded-2xl border border-border/60 bg-card/45 p-4 text-left transition-colors hover:border-primary/35 hover:bg-card/70"
                onClick={() =>
                  void openProjectConversation(conversation.id)
                }
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {conversation.title}
                      </p>
                      <Badge variant="outline" className="rounded-full">
                        {MODE_CONFIGS[conversation.mode].name}
                      </Badge>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {conversation.preview || 'No preview yet.'}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{conversation.messageCount} messages</span>
                    <span>{formatDate(conversation.updatedAt)}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <EmptyPanel>No recent conversations in this project.</EmptyPanel>
        )}
      </Section>

      <div className="grid gap-8 xl:grid-cols-2">
        <Section title="Uploaded files">
          {filteredFiles.length > 0 ? (
            <div className="grid gap-3">
              {filteredFiles.map((file: ProjectHomeFileSummary) => {
                const fileUrl = file.url

                return (
                  <div
                    key={file.id}
                    className="rounded-2xl border border-border/60 bg-card/45 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {file.fileName}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {file.mimeType ?? 'Unknown type'} ·{' '}
                          {formatBytes(file.byteSize)}
                        </p>
                      </div>
                      {fileUrl ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="shrink-0"
                          onClick={() =>
                            window.open(fileUrl, '_blank', 'noopener')
                          }
                        >
                          <ExternalLink className="size-4" />
                        </Button>
                      ) : null}
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Added {formatDate(file.createdAt)}
                    </p>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyPanel>No uploaded files are scoped to this project.</EmptyPanel>
          )}
        </Section>

        <div ref={imagesSectionRef}>
          <Section title="Generated images">
            {filteredImages.length > 0 ? (
              <div className="grid gap-3">
                {filteredImages.map((image: ProjectHomeGeneratedImageSummary) => (
                  <div
                    key={image.id}
                    className="rounded-2xl border border-border/60 bg-card/45 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-medium text-foreground">
                          {image.prompt}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {image.model} · {image.status} · {formatDate(image.createdAt)}
                        </p>
                      </div>
                      {image.conversationId ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="shrink-0"
                          onClick={() =>
                            void openProjectConversation(
                              image.conversationId,
                              image.messageId
                            )
                          }
                        >
                          <ArrowRight className="size-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyPanel>No Prism images are connected to this project.</EmptyPanel>
            )}
          </Section>
        </div>
      </div>

      <Section
        title="Saved playbooks"
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => openWorkspaceTool('prompt-library')}
          >
            <FolderOpen className="mr-2 size-4" />
            Open library
          </Button>
        }
      >
        {filteredWorkflows.length > 0 ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {filteredWorkflows.map((workflow: ProjectHomeWorkflowSummary) => (
              <div
                key={workflow.id}
                className="rounded-2xl border border-border/60 bg-card/45 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {workflow.title}
                    </p>
                    {workflow.description ? (
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {workflow.description}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="shrink-0 rounded-xl"
                    disabled={runningWorkflowId === workflow.id}
                    onClick={() => void runWorkflow(workflow)}
                  >
                    {runningWorkflowId === workflow.id ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Play className="mr-2 size-4" />
                    )}
                    {workflow.variableCount > 0 ? 'Open' : 'Run'}
                  </Button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="rounded-full">
                    {workflow.stepCount} steps
                  </Badge>
                  <Badge variant="outline" className="rounded-full">
                    {workflow.variableCount} variables
                  </Badge>
                  <span className="py-0.5">{formatDate(workflow.updatedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyPanel>No project-scoped playbooks yet.</EmptyPanel>
        )}
      </Section>
    </div>
  )
}
