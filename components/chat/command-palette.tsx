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
