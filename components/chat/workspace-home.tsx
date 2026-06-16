'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  FormEvent,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Database,
  FileText,
  FolderOpen,
  FolderPlus,
  ImageIcon,
  LayoutDashboard,
  MessageSquare,
  Play,
  Plus,
  Search,
  Sparkles,
  Upload,
  Zap,
} from 'lucide-react'
import { useChatContext } from '@/lib/chat-context'
import {
  SearchResultTarget,
  WorkspaceHomeArtifactSummary,
  WorkspaceHomeContinueItem,
  WorkspaceHomeConversationSummary,
  WorkspaceHomeFileSummary,
  WorkspaceHomeImageSummary,
  WorkspaceHomePlaybookRunSummary,
  WorkspaceHomeProjectSummary,
  WorkspaceHomeResponse,
  WorkspaceHomeSuggestedAction,
} from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const UPLOAD_ACCEPT =
  'image/*,.pdf,.txt,.md,.mdx,.json,.csv,.xml,.yaml,.yml,.ts,.tsx,.js,.jsx,.css,.scss,.html,.py,.go,.java,.rb,.rs,.sql'

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Recently'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently'

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function formatBytes(value: number | null | undefined): string {
  if (!value || value <= 0) return 'Unknown size'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function limitLabel(snapshot: { used: number; limit: number; remaining: number }) {
  if (snapshot.limit <= 0) return 'No limit'
  return `${snapshot.remaining.toLocaleString()} left`
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
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
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
    <div className="rounded-2xl border border-dashed border-border/60 bg-card/25 px-4 py-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}

function ItemButton({
  title,
  description,
  meta,
  icon,
  onClick,
}: {
  title: string
  description: string
  meta?: string | null
  icon: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-2xl border border-border/60 bg-card/35 px-4 py-3 text-left transition-colors hover:border-primary/50 hover:bg-card/60"
    >
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">
          {title}
        </span>
        <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted-foreground">
          {description}
        </span>
        {meta ? (
          <span className="mt-2 block text-[11px] text-muted-foreground/80">
            {meta}
          </span>
        ) : null}
      </span>
    </button>
  )
}

function UsageMeter({
  label,
  snapshot,
}: {
  label: string
  snapshot: { used: number; limit: number; remaining: number; ratio: number }
}) {
  const width = Math.max(0, Math.min(100, snapshot.ratio * 100))
  return (
    <div className="space-y-2 rounded-2xl border border-border/60 bg-card/35 px-4 py-3">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">{limitLabel(snapshot)}</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}

export function WorkspaceHome() {
  const router = useRouter()
  const {
    selectedProjectId,
    setSelectedProjectId,
    createNewChat,
    createProject,
    openProjectHome,
    openConversation,
    openWorkspaceTool,
    openWorkspaceSearch,
    uploadProjectFiles,
    prepareComposerDraft,
  } = useChatContext()
  const [home, setHome] = useState<WorkspaceHomeResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [targetProjectId, setTargetProjectId] = useState<string>('')
  const [newProjectName, setNewProjectName] = useState('')
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const uploadInputRef = useRef<HTMLInputElement | null>(null)

  const loadHome = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/workspace-home', { cache: 'no-store' })
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null
        throw new Error(payload?.error ?? 'Unable to load workspace home.')
      }
      const payload = (await response.json()) as WorkspaceHomeResponse
      setHome(payload)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load workspace home.'
      )
      setHome(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadHome()
  }, [])

  const defaultProjectId = useMemo(() => {
    const selected =
      selectedProjectId !== 'all' &&
      home?.recentProjects.some((project) => project.id === selectedProjectId)
        ? selectedProjectId
        : null
    return (
      selected ??
      home?.recentProjects.find((project) => project.isDefault)?.id ??
      home?.recentProjects[0]?.id ??
      ''
    )
  }, [home?.recentProjects, selectedProjectId])

  useEffect(() => {
    if (!targetProjectId && defaultProjectId) {
      setTargetProjectId(defaultProjectId)
    }
  }, [defaultProjectId, targetProjectId])

  const targetProject = home?.recentProjects.find(
    (project) => project.id === targetProjectId
  )

  const handleNewChat = async () => {
    if (targetProjectId) setSelectedProjectId(targetProjectId)
    await createNewChat()
  }

  const handleCreateProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!newProjectName.trim() || isCreatingProject) return

    setIsCreatingProject(true)
    try {
      const project = await createProject(newProjectName)
      if (project) {
        setNewProjectName('')
        setTargetProjectId(project.id)
        openProjectHome(project.id)
      }
    } finally {
      setIsCreatingProject(false)
    }
  }

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files?.length || !targetProjectId) return

    setIsUploading(true)
    try {
      await uploadProjectFiles(targetProjectId, Array.from(files))
      await loadHome()
      openWorkspaceTool({ tool: 'ask-files', projectId: targetProjectId })
    } finally {
      setIsUploading(false)
      if (uploadInputRef.current) {
        uploadInputRef.current.value = ''
      }
    }
  }

  const executeTarget = async (target: SearchResultTarget) => {
    switch (target.type) {
      case 'open_project':
        openProjectHome(target.projectId)
        return
      case 'open_conversation':
        await openConversation(target.conversationId)
        if (target.messageId) {
          window.setTimeout(() => {
            document
              .getElementById(`message-${target.messageId}`)
              ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
          }, 180)
        }
        return
      case 'open_artifact':
        openWorkspaceTool({
          tool: 'artifacts',
          artifactId: target.artifactId,
          projectId: target.projectId,
        })
        return
      case 'open_prompt_library':
        openWorkspaceTool(target.workflowId ? 'playbooks' : 'prompt-library')
        return
      case 'run_prompt_workflow':
        openWorkspaceTool('playbooks')
        return
      case 'switch_custom_assistant':
      case 'open_custom_assistants':
        openWorkspaceTool('custom-assistants')
        return
      case 'open_model_comparison':
        if (target.conversationId) {
          await openConversation(target.conversationId)
          return
        }
        openWorkspaceTool('model-comparison')
        return
      case 'open_prism_history':
        openWorkspaceTool({
          tool: 'prism-studio',
          imageId: target.imageId,
          projectId: target.projectId,
        })
        return
      case 'open_url':
        if (target.url.startsWith('/?tool=ask-files')) {
          const params = new URLSearchParams(target.url.split('?')[1] ?? '')
          openWorkspaceTool({
            tool: 'ask-files',
            projectId: params.get('projectId'),
            fileId: params.get('fileId'),
          })
          return
        }
        router.push(target.url)
    }
  }

  const runSuggestedAction = async (action: WorkspaceHomeSuggestedAction) => {
    const projectId = action.projectId ?? (targetProjectId || null)
    switch (action.type) {
      case 'new_chat':
      case 'continue_conversation':
        await handleNewChat()
        return
      case 'new_project':
        setNewProjectName('')
        return
      case 'upload_file':
        uploadInputRef.current?.click()
        return
      case 'run_playbook':
        openWorkspaceTool({ tool: 'playbooks', projectId })
        return
      case 'generate_image':
        prepareComposerDraft({
          content: '',
          kind: 'image',
          mode: 'image',
          projectId,
        })
        return
      case 'open_pulse_research':
        openWorkspaceTool({ tool: 'pulse-research-room', projectId })
        return
      case 'search_workspace':
        openWorkspaceSearch({ scope: 'global' })
        return
      case 'open_dashboard':
        router.push('/dashboard')
        return
      case 'open_pricing':
        router.push('/pricing')
        return
    }
  }

  const openConversationItem = (item: WorkspaceHomeConversationSummary) => {
    void openConversation(item.id)
  }

  const openProjectItem = (item: WorkspaceHomeProjectSummary) => {
    openProjectHome(item.id)
  }

  const openArtifactItem = (item: WorkspaceHomeArtifactSummary) => {
    openWorkspaceTool({
      tool: 'artifacts',
      artifactId: item.id,
      projectId: item.projectId,
    })
  }

  const openRunItem = (item: WorkspaceHomePlaybookRunSummary) => {
    openWorkspaceTool({ tool: 'playbooks', projectId: item.projectId })
  }

  const openFileItem = (item: WorkspaceHomeFileSummary) => {
    openWorkspaceTool({
      tool: 'ask-files',
      projectId: item.projectId,
      fileId: item.id,
    })
  }

  const openImageItem = (item: WorkspaceHomeImageSummary) => {
    openWorkspaceTool({
      tool: 'prism-studio',
      imageId: item.id,
      projectId: item.projectId,
    })
  }

  if (isLoading) {
    return (
      <div className="mx-auto flex min-h-full max-w-6xl items-center justify-center px-4 py-10">
        <div className="rounded-3xl border border-border/70 bg-card/60 px-6 py-4 text-sm text-muted-foreground">
          Loading workspace home...
        </div>
      </div>
    )
  }

  if (error || !home) {
    return (
      <div className="mx-auto flex min-h-full max-w-6xl items-center justify-center px-4 py-10">
        <div className="space-y-4 rounded-3xl border border-destructive/40 bg-destructive/10 px-6 py-5 text-sm text-destructive">
          <p>{error ?? 'Workspace home is unavailable.'}</p>
          <Button type="button" variant="outline" onClick={() => void loadHome()}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-card/50 p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Workspace Home
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Pick up your work quickly
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Continue recent threads, open project work, and jump into the core
            Zenquanta tools without spending credits on page load.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" className="rounded-xl" onClick={() => void handleNewChat()}>
            <Plus className="size-4" />
            New chat
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="rounded-xl"
            onClick={() => openWorkspaceSearch({ scope: 'global' })}
          >
            <Search className="size-4" />
            Search
          </Button>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/dashboard">
              <LayoutDashboard className="size-4" />
              Dashboard
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
        <Section title="Continue where you left off">
          {home.continueItems.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {home.continueItems.map((item: WorkspaceHomeContinueItem) => (
                <ItemButton
                  key={item.id}
                  title={item.title}
                  description={item.description}
                  meta={`${item.projectName ?? 'Workspace'} · ${formatDate(item.occurredAt)}`}
                  icon={<Sparkles className="size-4" />}
                  onClick={() => void executeTarget(item.target)}
                />
              ))}
            </div>
          ) : (
            <EmptyPanel>Start a chat, create a project, or upload a file.</EmptyPanel>
          )}
        </Section>

        <Section title="Quick actions">
          <div className="space-y-3 rounded-3xl border border-border/70 bg-card/45 p-4">
            <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Target project
              <select
                value={targetProjectId}
                onChange={(event) => setTargetProjectId(event.target.value)}
                className="h-10 rounded-xl border border-border/70 bg-background/70 px-3 text-sm normal-case tracking-normal text-foreground outline-none transition focus:border-primary"
              >
                {home.recentProjects.length === 0 ? (
                  <option value="">Create a project first</option>
                ) : null}
                {home.recentProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="secondary" onClick={() => void handleNewChat()}>
                <MessageSquare className="size-4" />
                New chat
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!targetProjectId || isUploading}
                onClick={() => uploadInputRef.current?.click()}
              >
                <Upload className="size-4" />
                Upload
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  openWorkspaceTool({ tool: 'playbooks', projectId: targetProjectId || null })
                }
              >
                <Play className="size-4" />
                Playbook
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  prepareComposerDraft({
                    content: '',
                    kind: 'image',
                    mode: 'image',
                    projectId: targetProjectId || null,
                  })
                }
              >
                <ImageIcon className="size-4" />
                Prism
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  openWorkspaceTool({
                    tool: 'pulse-research-room',
                    projectId: targetProjectId || null,
                  })
                }
              >
                <Zap className="size-4" />
                Pulse
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => openWorkspaceSearch({ scope: 'global' })}
              >
                <Search className="size-4" />
                Search
              </Button>
            </div>

            <form className="flex gap-2" onSubmit={(event) => void handleCreateProject(event)}>
              <Input
                value={newProjectName}
                onChange={(event) => setNewProjectName(event.target.value)}
                placeholder="New project name"
                className="h-10 rounded-xl"
              />
              <Button
                type="submit"
                variant="outline"
                className="h-10 rounded-xl"
                disabled={!newProjectName.trim() || isCreatingProject}
              >
                <FolderPlus className="size-4" />
              </Button>
            </form>

            <input
              ref={uploadInputRef}
              type="file"
              multiple
              accept={UPLOAD_ACCEPT}
              className="hidden"
              onChange={(event) => void handleUploadFiles(event.target.files)}
            />
          </div>
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.6fr)]">
        <Section title="Suggested next actions">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {home.suggestedActions.map((action) => (
              <ItemButton
                key={action.id}
                title={action.title}
                description={action.description}
                meta={targetProject?.name ?? null}
                icon={<Sparkles className="size-4" />}
                onClick={() => void runSuggestedAction(action)}
              />
            ))}
          </div>
        </Section>

        <Section title="Usage snapshot">
          <div className="space-y-3 rounded-3xl border border-border/70 bg-card/45 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {home.usageSnapshot.planTier.toUpperCase()} plan
                </p>
                <p className="text-xs text-muted-foreground">
                  {home.usageSnapshot.displayedCreditsRemaining.toLocaleString()} displayed credits left
                </p>
              </div>
              <Badge variant="secondary">
                {home.usageSnapshot.subscriptionStatus}
              </Badge>
            </div>
            <UsageMeter label="Messages today" snapshot={home.usageSnapshot.dailyMessages} />
            <UsageMeter label="Images today" snapshot={home.usageSnapshot.dailyImages} />
            <UsageMeter label="Displayed credits" snapshot={home.usageSnapshot.displayedCredits} />
            {home.usageSnapshot.pendingPlanRequest ? (
              <Button asChild variant="secondary" className="w-full rounded-xl">
                <Link href="/pricing">
                  Review {home.usageSnapshot.pendingPlanRequest.requestedTier.toUpperCase()} request
                </Link>
              </Button>
            ) : (
              <Button asChild variant="outline" className="w-full rounded-xl">
                <Link href="/dashboard">Open usage dashboard</Link>
              </Button>
            )}
          </div>
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Recent projects">
          <div className="space-y-3">
            {home.recentProjects.length > 0 ? (
              home.recentProjects.map((project) => (
                <ItemButton
                  key={project.id}
                  title={project.name}
                  description={project.description ?? 'Project workspace'}
                  meta={formatDate(project.updatedAt)}
                  icon={<FolderOpen className="size-4" />}
                  onClick={() => openProjectItem(project)}
                />
              ))
            ) : (
              <EmptyPanel>No projects yet.</EmptyPanel>
            )}
          </div>
        </Section>

        <Section title="Recent conversations">
          <div className="space-y-3">
            {home.recentConversations.length > 0 ? (
              home.recentConversations.map((conversation) => (
                <ItemButton
                  key={conversation.id}
                  title={conversation.title}
                  description={conversation.preview || 'Conversation'}
                  meta={`${conversation.projectName ?? 'Workspace'} · ${formatDate(conversation.updatedAt)}`}
                  icon={<MessageSquare className="size-4" />}
                  onClick={() => openConversationItem(conversation)}
                />
              ))
            ) : (
              <EmptyPanel>No conversations yet.</EmptyPanel>
            )}
          </div>
        </Section>

        <Section title="Recent artifacts">
          <div className="space-y-3">
            {home.recentArtifacts.length > 0 ? (
              home.recentArtifacts.map((artifact) => (
                <ItemButton
                  key={artifact.id}
                  title={artifact.title}
                  description={`${artifact.artifactType} · ${artifact.sourceType}`}
                  meta={artifact.projectName ?? 'Workspace'}
                  icon={<FileText className="size-4" />}
                  onClick={() => openArtifactItem(artifact)}
                />
              ))
            ) : (
              <EmptyPanel>No artifacts yet.</EmptyPanel>
            )}
          </div>
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Recent playbook runs">
          <div className="space-y-3">
            {home.recentPlaybookRuns.length > 0 ? (
              home.recentPlaybookRuns.map((run) => (
                <ItemButton
                  key={run.id}
                  title={run.workflowTitle}
                  description={`Status: ${run.status}`}
                  meta={run.projectName ?? formatDate(run.updatedAt)}
                  icon={<Play className="size-4" />}
                  onClick={() => openRunItem(run)}
                />
              ))
            ) : (
              <EmptyPanel>No playbook runs yet.</EmptyPanel>
            )}
          </div>
        </Section>

        <Section title="Recent files">
          <div className="space-y-3">
            {home.recentFiles.length > 0 ? (
              home.recentFiles.map((file) => (
                <ItemButton
                  key={file.id}
                  title={file.fileName}
                  description={`${file.knowledgeStatusLabel} · ${formatBytes(file.byteSize)}`}
                  meta={file.projectName ?? file.mimeType ?? 'Workspace file'}
                  icon={<Database className="size-4" />}
                  onClick={() => openFileItem(file)}
                />
              ))
            ) : (
              <EmptyPanel>No files yet.</EmptyPanel>
            )}
          </div>
        </Section>

        <Section title="Recent Prism images">
          <div className="space-y-3">
            {home.recentImages.length > 0 ? (
              home.recentImages.map((image) => (
                <ItemButton
                  key={image.id}
                  title={image.prompt}
                  description={`${image.model} · ${image.status}`}
                  meta={image.projectName ?? formatDate(image.createdAt)}
                  icon={<ImageIcon className="size-4" />}
                  onClick={() => openImageItem(image)}
                />
              ))
            ) : (
              <EmptyPanel>No Prism images yet.</EmptyPanel>
            )}
          </div>
        </Section>
      </div>
    </div>
  )
}
