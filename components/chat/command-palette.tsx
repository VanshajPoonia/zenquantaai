'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bot,
  BookText,
  Command as CommandIcon,
  CreditCard,
  FileText,
  Folder,
  FolderPlus,
  GitCompareArrows,
  ImageIcon,
  LayoutDashboard,
  Loader2,
  MessageSquare,
  Play,
  Plus,
  Search,
} from 'lucide-react'
import { ASSISTANT_FAMILY_COPY, MODE_CONFIGS } from '@/lib/config'
import { useChatContext } from '@/lib/chat-context'
import { AIMode, SearchResponse, SearchResult, SearchResultTarget } from '@/types'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command'
import { ModeIcon } from '@/lib/mode-utils'

const ASSISTANT_MODES: AIMode[] = [
  'general',
  'creative',
  'logic',
  'code',
  'live',
  'image',
]

const ENTITY_LABELS: Record<SearchResult['entityType'], string> = {
  project: 'Project',
  conversation: 'Conversation',
  message: 'Message',
  prompt: 'Prompt',
  prompt_workflow: 'Workflow',
  custom_assistant: 'Assistant',
  file: 'File',
  generated_image: 'Prism',
  model_comparison: 'Comparison',
}

function resultIcon(entityType: SearchResult['entityType']) {
  switch (entityType) {
    case 'project':
      return <Folder className="size-4" />
    case 'conversation':
    case 'message':
      return <MessageSquare className="size-4" />
    case 'prompt':
      return <BookText className="size-4" />
    case 'prompt_workflow':
      return <Play className="size-4" />
    case 'custom_assistant':
      return <Bot className="size-4" />
    case 'file':
      return <FileText className="size-4" />
    case 'generated_image':
      return <ImageIcon className="size-4" />
    case 'model_comparison':
      return <GitCompareArrows className="size-4" />
  }
}

function formatResultDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function metadataBadges(metadata: SearchResult['metadata']) {
  if (!metadata) return []

  return Object.entries(metadata)
    .filter(([, value]) => value !== null && typeof value !== 'undefined' && value !== '')
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${String(value)}`)
}

function resultValue(result: SearchResult) {
  return [
    ENTITY_LABELS[result.entityType],
    result.title,
    result.snippet,
    ...metadataBadges(result.metadata),
  ].join(' ')
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter()
  const {
    conversations,
    currentMode,
    setCurrentMode,
    openConversation,
    goHome,
    createNewChat,
    createProject,
    projects,
    setSelectedProjectId,
    promptWorkflows,
    runPromptWorkflow,
    customAssistants,
    setCurrentCustomAssistant,
    openWorkspaceTool,
  } = useChatContext()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [isRunningAction, setIsRunningAction] = useState(false)

  const trimmedQuery = query.trim()
  const projectName = trimmedQuery || 'New Project'

  const matchingWorkflows = useMemo(
    () =>
      promptWorkflows.filter((workflow) => {
        if (!trimmedQuery) return true
        const value = `${workflow.title} ${workflow.description ?? ''}`.toLowerCase()
        return value.includes(trimmedQuery.toLowerCase())
      }),
    [promptWorkflows, trimmedQuery]
  )

  const matchingAssistants = useMemo(
    () =>
      customAssistants.filter((assistant) => {
        if (!trimmedQuery) return true
        const value =
          `${assistant.name} ${assistant.description} ${assistant.baseMode}`.toLowerCase()
        return value.includes(trimmedQuery.toLowerCase())
      }),
    [customAssistants, trimmedQuery]
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k') return
      if (!event.metaKey && !event.ctrlKey) return

      event.preventDefault()
      if (open) {
        setQuery('')
        setSearchError(null)
        onOpenChange(false)
        return
      }

      onOpenChange(true)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onOpenChange, open])

  useEffect(() => {
    if (!open) return

    if (trimmedQuery.length < 2) {
      setResults([])
      setIsSearching(false)
      setSearchError(null)
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      setIsSearching(true)
      setSearchError(null)

      fetch(`/api/search?q=${encodeURIComponent(trimmedQuery)}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            const payload = (await response.json().catch(() => null)) as
              | { error?: string }
              | null
            throw new Error(payload?.error ?? 'Search failed.')
          }

          return (await response.json()) as SearchResponse
        })
        .then((payload) => {
          setResults(payload.results)
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === 'AbortError') {
            return
          }

          setResults([])
          setSearchError(
            error instanceof Error ? error.message : 'Search failed.'
          )
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsSearching(false)
          }
        })
    }, 180)

    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [open, trimmedQuery])

  const closePalette = () => {
    onOpenChange(false)
    setQuery('')
    setSearchError(null)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen)
    if (!nextOpen) {
      setQuery('')
      setSearchError(null)
    }
  }

  const runAction = async (action: () => Promise<void> | void) => {
    setIsRunningAction(true)
    try {
      closePalette()
      await action()
    } finally {
      setIsRunningAction(false)
    }
  }

  const scrollToMessage = (messageId?: string) => {
    if (!messageId) return

    window.setTimeout(() => {
      document
        .getElementById(`message-${messageId}`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 180)
  }

  const executeTarget = async (target: SearchResultTarget) => {
    switch (target.type) {
      case 'open_project':
        setSelectedProjectId(target.projectId)
        goHome()
        return
      case 'open_conversation':
        await openConversation(target.conversationId)
        scrollToMessage(target.messageId)
        return
      case 'open_prompt_library':
        openWorkspaceTool('prompt-library')
        return
      case 'run_prompt_workflow':
        await runPromptWorkflow(target.workflowId)
        return
      case 'switch_custom_assistant':
        setCurrentCustomAssistant(target.assistantId)
        return
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
        if (target.conversationId) {
          await openConversation(target.conversationId)
          return
        }
        router.push('/dashboard')
        return
      case 'open_url':
        router.push(target.url)
        return
    }
  }

  const openWorkspaceUrl = (url: string) => {
    void runAction(() => {
      router.push(url)
    })
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Search Zenquanta"
      description="Search workspace data and run workspace actions."
      className="max-w-3xl rounded-2xl border-border/70 bg-background/95 shadow-2xl"
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search workspace or run a command..."
      />
      <CommandList className="max-h-[70vh]">
        <CommandEmpty>No matching commands or workspace results.</CommandEmpty>

        {trimmedQuery.length >= 2 ? (
          <CommandGroup heading="Workspace Results">
            {isSearching ? (
              <CommandItem disabled value="search-loading">
                <Loader2 className="size-4 animate-spin" />
                <span>Searching workspace...</span>
              </CommandItem>
            ) : null}

            {searchError ? (
              <CommandItem disabled value="search-error">
                <Search className="size-4 text-destructive" />
                <span>{searchError}</span>
              </CommandItem>
            ) : null}

            {!isSearching && !searchError && results.length === 0 ? (
              <CommandItem disabled value="search-empty">
                <Search className="size-4" />
                <span>No workspace results for {trimmedQuery}.</span>
              </CommandItem>
            ) : null}

            {results.map((result) => (
              <CommandItem
                key={`${result.entityType}-${result.id}`}
                value={resultValue(result)}
                onSelect={() => void runAction(() => executeTarget(result.target))}
                className="items-start gap-3"
              >
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-card/70">
                  {resultIcon(result.entityType)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {result.title}
                    </span>
                    <span className="shrink-0 rounded-md border border-border/60 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      {ENTITY_LABELS[result.entityType]}
                    </span>
                  </div>
                  {result.snippet ? (
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {result.snippet}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {metadataBadges(result.metadata).map((badge) => (
                      <span
                        key={badge}
                        className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {badge}
                      </span>
                    ))}
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {formatResultDate(result.updatedAt ?? result.createdAt)}
                    </span>
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        <CommandGroup heading="Actions">
          <CommandItem
            value="new chat start conversation"
            onSelect={() => void runAction(createNewChat)}
          >
            <Plus className="size-4" />
            <span>New chat</span>
          </CommandItem>
          <CommandItem
            value={`new project create folder ${projectName}`}
            onSelect={() =>
              void runAction(async () => {
                const project = await createProject(projectName)
                if (!project) return
                setSelectedProjectId(project.id)
                goHome()
              })
            }
          >
            <FolderPlus className="size-4" />
            <span className="truncate">
              {trimmedQuery ? `New project: ${trimmedQuery}` : 'New project'}
            </span>
          </CommandItem>
          <CommandItem
            value="search workspace command palette"
            onSelect={() => setQuery('')}
          >
            <CommandIcon className="size-4" />
            <span>Search workspace</span>
          </CommandItem>
          <CommandItem
            value="open dashboard usage"
            onSelect={() => openWorkspaceUrl('/dashboard')}
          >
            <LayoutDashboard className="size-4" />
            <span>Open dashboard</span>
          </CommandItem>
          <CommandItem
            value="open pricing plans"
            onSelect={() => openWorkspaceUrl('/pricing')}
          >
            <CreditCard className="size-4" />
            <span>Open pricing</span>
          </CommandItem>
          <CommandItem
            value="open prompt library prompts workflows"
            onSelect={() => void runAction(() => openWorkspaceTool('prompt-library'))}
          >
            <BookText className="size-4" />
            <span>Open prompt library</span>
          </CommandItem>
          <CommandItem
            value="open model comparison compare assistants"
            onSelect={() =>
              void runAction(() => openWorkspaceTool('model-comparison'))
            }
          >
            <GitCompareArrows className="size-4" />
            <span>Open model comparison</span>
          </CommandItem>
          <CommandItem
            value="open custom assistants builder"
            onSelect={() =>
              void runAction(() => openWorkspaceTool('custom-assistants'))
            }
          >
            <Bot className="size-4" />
            <span>Open custom assistants</span>
          </CommandItem>
          <CommandItem
            value="open prism image history recent generations"
            onSelect={() => openWorkspaceUrl('/dashboard')}
          >
            <ImageIcon className="size-4" />
            <span>Open Prism image history</span>
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Switch Assistant">
          {ASSISTANT_MODES.map((mode) => {
            const config = MODE_CONFIGS[mode]
            const family = config.family
            return (
              <CommandItem
                key={mode}
                value={`switch assistant ${config.name} ${family} ${ASSISTANT_FAMILY_COPY[family].description}`}
                onSelect={() => void runAction(() => setCurrentMode(mode))}
              >
                <ModeIcon mode={mode} size="sm" />
                <span>{config.name}</span>
                {currentMode === mode ? (
                  <CommandShortcut>Active</CommandShortcut>
                ) : null}
              </CommandItem>
            )
          })}
        </CommandGroup>

        {matchingWorkflows.length > 0 ? (
          <CommandGroup heading="Run Prompt Workflow">
            {matchingWorkflows.slice(0, 8).map((workflow) => (
              <CommandItem
                key={workflow.id}
                value={`run workflow ${workflow.title} ${workflow.description ?? ''}`}
                onSelect={() =>
                  void runAction(() =>
                    executeTarget({
                      type: 'run_prompt_workflow',
                      workflowId: workflow.id,
                    })
                  )
                }
                className="items-start gap-3"
              >
                <Play className="mt-0.5 size-4" />
                <div className="min-w-0">
                  <p className="truncate">{workflow.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {workflow.steps.length} steps
                  </p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {matchingAssistants.length > 0 ? (
          <CommandGroup heading="Custom Assistants">
            {matchingAssistants.slice(0, 8).map((assistant) => (
              <CommandItem
                key={assistant.id}
                value={`custom assistant ${assistant.name} ${assistant.description} ${assistant.baseMode}`}
                disabled={!assistant.isEnabled}
                onSelect={() =>
                  void runAction(() =>
                    executeTarget({
                      type: 'switch_custom_assistant',
                      assistantId: assistant.id,
                    })
                  )
                }
              >
                <span className="flex size-5 items-center justify-center text-sm">
                  {assistant.iconEmoji}
                </span>
                <span className="truncate">{assistant.name}</span>
                <CommandShortcut>{assistant.baseMode}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {projects.length > 0 ? (
          <CommandGroup heading="Projects">
            {projects.slice(0, 8).map((project) => (
              <CommandItem
                key={project.id}
                value={`open project ${project.name} ${project.description ?? ''}`}
                onSelect={() =>
                  void runAction(() =>
                    executeTarget({ type: 'open_project', projectId: project.id })
                  )
                }
              >
                <Folder className="size-4" />
                <span className="truncate">{project.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {conversations.length > 0 ? (
          <CommandGroup heading="Recent Conversations">
            {conversations.slice(0, 6).map((conversation) => (
              <CommandItem
                key={conversation.id}
                value={`open conversation ${conversation.title} ${conversation.preview}`}
                onSelect={() =>
                  void runAction(() =>
                    executeTarget({
                      type: 'open_conversation',
                      conversationId: conversation.id,
                    })
                  )
                }
              >
                <MessageSquare className="size-4" />
                <span className="truncate">{conversation.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {isRunningAction ? (
          <div className="flex items-center gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            <span>Running command...</span>
          </div>
        ) : null}
      </CommandList>
    </CommandDialog>
  )
}
