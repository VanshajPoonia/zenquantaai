'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  CSSProperties,
  FormEvent,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  ArrowRight,
  Database,
  FileText,
  FolderPlus,
  ImageIcon,
  Play,
  Sparkles,
  SquarePen,
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
import { ModeIcon, getModeAccentClass } from '@/lib/mode-utils'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

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
  delay = 0,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  delay?: number
}) {
  return (
    <section className="animate-arrive" style={{ '--arrive-delay': `${delay}ms` } as CSSProperties}>
      <div className="mb-2 flex h-7 items-center justify-between gap-3 px-1">
        <h2 className="text-[13px] font-medium text-foreground/90">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function EmptyPanel({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border px-3 py-3 text-[13px] text-muted-foreground">
      {children}
    </p>
  )
}

function ListPanel({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white/[0.015]">{children}</div>
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
      className="group flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.035] focus-visible:bg-white/[0.035] focus-visible:outline-none [&+button]:border-t [&+button]:border-border"
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-white/[0.04] text-muted-foreground shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.05)] transition-colors group-hover:text-foreground">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] text-foreground">{title}</span>
        <span className="block truncate text-[12.5px] text-muted-foreground">{description}</span>
      </span>
      {meta ? (
        <span className="hidden shrink-0 text-[12px] text-muted-foreground/80 sm:block">{meta}</span>
      ) : null}
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
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-[12.5px]">
        <span className="text-foreground/90">{label}</span>
        <span className="text-muted-foreground tabular-nums">{limitLabel(snapshot)}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className={cn('animate-meter h-full rounded-full', width >= 80 ? 'bg-amber-400' : 'bg-foreground/80')}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 5) return 'Working late'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function relativeTime(value: string | null | undefined): string {
  if (!value) return ''
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return ''
  const minutes = Math.round((Date.now() - time) / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(value)
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
    authState,
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
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-8" role="status" aria-label="Loading workspace home">
        <div className="h-8 w-64 animate-pulse rounded-md bg-white/[0.05]" />
        <div className="mt-3 h-4 w-40 animate-pulse rounded bg-white/[0.04]" />
        <div className="mt-8 flex gap-2">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="h-9 w-28 animate-pulse rounded-lg bg-white/[0.04]" />
          ))}
        </div>
        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)]">
          <div className="space-y-2">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-lg bg-white/[0.035]" />
            ))}
          </div>
          <div className="h-56 animate-pulse rounded-xl bg-white/[0.035]" />
        </div>
      </div>
    )
  }

  if (error || !home) {
    return (
      <div className="mx-auto flex min-h-full max-w-6xl items-center justify-center px-4 py-10">
        <div className="animate-arrive space-y-3 rounded-xl border border-destructive/40 bg-destructive/10 px-5 py-4 text-[13.5px] text-destructive">
          <p>{error ?? 'Workspace home is unavailable.'}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void loadHome()}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  const name = authState.user?.loginId ?? null
  const usage = home.usageSnapshot
  type QuickActionId = 'chat' | 'upload' | 'playbook' | 'image' | 'pulse'
  const quickActions: { id: QuickActionId; label: string; icon: ReactNode; disabled?: boolean }[] = [
    { id: 'chat', label: 'New chat', icon: <SquarePen className="size-4" /> },
    {
      id: 'upload',
      label: isUploading ? 'Uploading…' : 'Upload files',
      icon: <Upload className="size-4" />,
      disabled: !targetProjectId || isUploading,
    },
    { id: 'playbook', label: 'Run a playbook', icon: <Play className="size-4" /> },
    { id: 'image', label: 'Make an image', icon: <ImageIcon className="size-4 text-image" /> },
    { id: 'pulse', label: 'Research with Pulse', icon: <Zap className="size-4 text-live" /> },
  ]

  function runQuickAction(id: QuickActionId) {
    const projectId = targetProjectId || null
    switch (id) {
      case 'chat':
        void handleNewChat()
        return
      case 'upload':
        uploadInputRef.current?.click()
        return
      case 'playbook':
        openWorkspaceTool({ tool: 'playbooks', projectId })
        return
      case 'image':
        prepareComposerDraft({ content: '', kind: 'image', mode: 'image', projectId })
        return
      case 'pulse':
        openWorkspaceTool({ tool: 'pulse-research-room', projectId })
        return
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col px-4 pt-10 pb-8 sm:px-8">
      <header className="animate-arrive">
        <div className="min-w-0">
          <h1 className="font-display truncate text-[clamp(1.6rem,3.4vw,2.1rem)] leading-tight text-foreground">
            {greeting()}
            {name ? `, ${name}` : ''}
          </h1>
          <p className="mt-1.5 text-[14px] text-muted-foreground">
            Pick up a chat, open a project, or start something new.
          </p>
        </div>
      </header>

      <div className="animate-arrive mt-7 flex flex-wrap items-center gap-2" style={{ '--arrive-delay': '60ms' } as CSSProperties}>
        {quickActions.map((action) => (
          <button
            key={action.label}
            type="button"
            disabled={action.disabled}
            onClick={() => runQuickAction(action.id)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-white/[0.02] px-3 text-[13px] text-foreground/90 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.03)] transition-[background-color,border-color,transform] duration-150 hover:border-white/15 hover:bg-white/[0.05] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
          >
            <span className="text-muted-foreground">{action.icon}</span>
            {action.label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-[12.5px] text-muted-foreground">
          <span className="hidden sm:inline">Project</span>
          <select
            value={targetProjectId}
            onChange={(event) => setTargetProjectId(event.target.value)}
            aria-label="Project for new chats and uploads"
            className="h-8 rounded-md border border-border bg-white/[0.02] px-2 text-[13px] text-foreground outline-none transition-colors hover:bg-white/[0.04] focus:border-ring"
          >
            {home.recentProjects.length === 0 ? <option value="">Create a project first</option> : null}
            {home.recentProjects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <input
          ref={uploadInputRef}
          type="file"
          multiple
          accept={UPLOAD_ACCEPT}
          className="hidden"
          onChange={(event) => void handleUploadFiles(event.target.files)}
        />
      </div>

      <div className="mt-10 grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)]">
        <div className="min-w-0 space-y-8">
          <Section title="Continue where you left off" delay={100}>
            {home.continueItems.length > 0 ? (
              <ListPanel>
                {home.continueItems.map((item: WorkspaceHomeContinueItem) => (
                  <ItemButton
                    key={item.id}
                    title={item.title}
                    description={item.description}
                    meta={[item.projectName, relativeTime(item.occurredAt)].filter(Boolean).join(' · ')}
                    icon={<Sparkles className="size-3.5" />}
                    onClick={() => void executeTarget(item.target)}
                  />
                ))}
              </ListPanel>
            ) : (
              <EmptyPanel>Start a chat, create a project, or upload a file.</EmptyPanel>
            )}
          </Section>

          <Section title="Recent chats" delay={140}>
            {home.recentConversations.length > 0 ? (
              <ListPanel>
                {home.recentConversations.map((conversation) => (
                  <ItemButton
                    key={conversation.id}
                    title={conversation.title}
                    description={conversation.preview || 'Conversation'}
                    meta={[conversation.projectName, relativeTime(conversation.updatedAt)].filter(Boolean).join(' · ')}
                    icon={
                      <span className={getModeAccentClass(conversation.mode, 'text')}>
                        <ModeIcon mode={conversation.mode} size="sm" className="size-3.5" />
                      </span>
                    }
                    onClick={() => openConversationItem(conversation)}
                  />
                ))}
              </ListPanel>
            ) : (
              <EmptyPanel>No chats yet.</EmptyPanel>
            )}
          </Section>

          {home.suggestedActions.length > 0 ? (
            <Section title="Suggested next" delay={180}>
              <div className="grid gap-2 sm:grid-cols-3">
                {home.suggestedActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => void runSuggestedAction(action)}
                    className="group flex flex-col rounded-xl border border-border bg-white/[0.015] p-3.5 text-left transition-colors hover:border-white/15 hover:bg-white/[0.035]"
                  >
                    <span className="flex items-center justify-between gap-2 text-[13.5px] text-foreground">
                      {action.title}
                      <ArrowRight className="size-3.5 shrink-0 -translate-x-1 text-muted-foreground opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
                    </span>
                    <span className="mt-1 text-[12.5px] leading-5 text-muted-foreground">{action.description}</span>
                  </button>
                ))}
              </div>
            </Section>
          ) : null}
        </div>

        <aside className="min-w-0 space-y-8">
          <Section
            title="Usage"
            delay={120}
            action={
              <Link href={usage.pendingPlanRequest ? '/pricing' : '/dashboard'} className="text-[12.5px] text-muted-foreground transition-colors hover:text-foreground">
                {usage.pendingPlanRequest ? `Review ${usage.pendingPlanRequest.requestedTier} request` : 'Details'}
              </Link>
            }
          >
            <div className="space-y-4 rounded-xl border border-border bg-white/[0.015] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13.5px] text-foreground">
                  <span className="capitalize">{usage.planTier}</span> plan
                </p>
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11.5px] text-muted-foreground capitalize">
                  {usage.subscriptionStatus}
                </span>
              </div>
              <UsageMeter label="Messages today" snapshot={usage.dailyMessages} />
              <UsageMeter label="Images today" snapshot={usage.dailyImages} />
              {usage.displayedCredits.limit > 0 ? (
                <UsageMeter label="Usage credits" snapshot={usage.displayedCredits} />
              ) : null}
            </div>
          </Section>

          <Section title="Projects" delay={160}>
            <ListPanel>
              {home.recentProjects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => openProjectItem(project)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13.5px] text-foreground/90 transition-colors hover:bg-white/[0.035] [&+*]:border-t [&+*]:border-border"
                >
                  <span aria-hidden className="size-2 shrink-0 rounded-[3px]" style={{ background: project.color }} />
                  <span className="min-w-0 flex-1 truncate">{project.name}</span>
                  <span className="shrink-0 text-[12px] text-muted-foreground/80">{relativeTime(project.updatedAt)}</span>
                </button>
              ))}
              <form className="flex items-center gap-2 px-3 py-1.5" onSubmit={(event) => void handleCreateProject(event)}>
                <FolderPlus className="size-3.5 shrink-0 text-muted-foreground" />
                <input
                  value={newProjectName}
                  onChange={(event) => setNewProjectName(event.target.value)}
                  placeholder="New project"
                  aria-label="New project name"
                  className="h-7 min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground/80"
                />
                {newProjectName.trim() ? (
                  <Button type="submit" size="sm" className="h-6 rounded px-2 text-[12px]" disabled={isCreatingProject}>
                    Create
                  </Button>
                ) : null}
              </form>
            </ListPanel>
          </Section>

          <Section title="Library" delay={200}>
            {home.recentArtifacts.length + home.recentFiles.length + home.recentImages.length + home.recentPlaybookRuns.length > 0 ? (
              <ListPanel>
                {home.recentArtifacts.map((artifact) => (
                  <ItemButton
                    key={artifact.id}
                    title={artifact.title}
                    description={`Artifact · ${artifact.artifactType}`}
                    icon={<FileText className="size-3.5" />}
                    onClick={() => openArtifactItem(artifact)}
                  />
                ))}
                {home.recentFiles.map((file) => (
                  <ItemButton
                    key={file.id}
                    title={file.fileName}
                    description={`${file.knowledgeStatusLabel} · ${formatBytes(file.byteSize)}`}
                    icon={<Database className="size-3.5" />}
                    onClick={() => openFileItem(file)}
                  />
                ))}
                {home.recentImages.map((image) => (
                  <ItemButton
                    key={image.id}
                    title={image.prompt}
                    description={`Image · ${image.status}`}
                    icon={<ImageIcon className="size-3.5 text-image" />}
                    onClick={() => openImageItem(image)}
                  />
                ))}
                {home.recentPlaybookRuns.map((run) => (
                  <ItemButton
                    key={run.id}
                    title={run.workflowTitle}
                    description={`Playbook run · ${run.status}`}
                    icon={<Play className="size-3.5" />}
                    onClick={() => openRunItem(run)}
                  />
                ))}
              </ListPanel>
            ) : (
              <EmptyPanel>Artifacts, files, images and playbook runs show up here.</EmptyPanel>
            )}
          </Section>
        </aside>
      </div>
    </div>
  )
}
