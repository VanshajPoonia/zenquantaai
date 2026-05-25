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
