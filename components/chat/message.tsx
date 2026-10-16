'use client'

import { memo, useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  Download,
  ExternalLink,
  FileText,
  ImageIcon,
  MoreHorizontal,
  PencilLine,
  Play,
  SendHorizontal,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  AIMode,
  Attachment,
  FileIntelligence,
  FileKnowledgeSource,
  Message,
  MessageSource,
  MODE_CONFIGS,
  MODE_ORDER,
  UsageOptimization,
} from '@/lib/types'
import { INTELLIGENCE_LEVEL_OPTIONS } from '@/lib/config'
import { useChatContext } from '@/lib/chat-context'
import {
  ASSISTANT_HANDOFF_TARGETS,
  AssistantHandoffTarget,
  buildAssistantHandoffPrompt,
} from '@/lib/config/assistant-handoffs'
import {
  AssistantQualityAction,
  buildAssistantQualityPrompt,
  getQualityActionGroupsForMessage,
  resolveQualityActionMode,
} from '@/lib/config/assistant-quality-actions'
import {
  getModeAccentClass,
  getModeTintClass,
  ModeIcon,
} from '@/lib/mode-utils'
import { formatMessageTime } from '@/lib/utils/date'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  CheckIcon,
  CopyIcon,
  RefreshIcon,
  XIcon,
} from '@/components/icons'
import { getWebPreviewDocument } from '@/lib/utils/web-preview'
import {
  downloadAttachmentImage,
  openAttachmentImageInNewTab,
} from '@/lib/utils/image-download'
import { ChatImageMessage } from './chat-image-message'
import { FeedbackButtons } from './feedback-buttons'
import { FileIntelligenceCard } from './file-intelligence-card'

interface ChatMessageProps {
  message: Message
  conversationId?: string | null
  onRegenerate?: (intelligenceLevel?: UsageOptimization) => void
  onRetry?: () => void
  onEdit?: (content: string, targetMessageId?: string) => void
  onAskAnotherMode?: (mode: AIMode) => void
  onSaveArtifact?: (message: Message) => Promise<void>
  onHandoff?: (
    message: Message,
    target: AssistantHandoffTarget,
    prompt: string
  ) => Promise<void>
  onQualityAction?: (
    message: Message,
    action: AssistantQualityAction,
    prompt: string
  ) => Promise<void>
  isLastAssistant?: boolean
  isLastUser?: boolean
  isStreamingMessage?: boolean
  errorOverride?: string
  workingTitle?: string
  workingNotes?: string[]
}

function getModeColorClasses(mode: AIMode) {
  return cn(getModeAccentClass(mode, 'text'), getModeTintClass(mode, 'subtle'))
}

function renderStreamingState(content: string, mode: AIMode) {
  if (!content.trim()) {
    return (
      <div className="flex items-center gap-2.5 py-0.5 text-[14px]">
        <span
          aria-hidden
          className={cn('size-1.5 rounded-full animate-breathe', getModeAccentClass(mode, 'bg'))}
        />
        <span className="text-shimmer">{mode === 'image' ? 'Creating image' : 'Thinking'}</span>
      </div>
    )
  }

  return (
    <div>
      <div className="max-w-none text-[15px] leading-7 text-foreground/90">
        {renderContent(content)}
      </div>
      <span
        role="status"
        aria-label="Still writing"
        className={cn('mt-2 block size-1.5 rounded-full animate-breathe', getModeAccentClass(mode, 'bg'))}
      />
    </div>
  )
}

function WorkingNotesPanel({
  title,
  notes,
  expanded,
  onToggle,
}: {
  title?: string
  notes: string[]
  expanded: boolean
  onToggle: () => void
}) {
  if (notes.length === 0) return null

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-border bg-white/[0.02]">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-white/[0.03]"
        onClick={(event) => {
          event.stopPropagation()
          onToggle()
        }}
      >
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-foreground/90">
            {title ?? 'Working notes'}
          </p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {expanded ? 'Hide progress' : 'Show progress'}
          </p>
        </div>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            expanded && 'rotate-180'
          )}
        />
      </button>

      {expanded ? (
        <div className="border-t border-border px-3 py-2.5">
          <ul className="space-y-1.5">
            {notes.map((note) => (
              <li
                key={note}
                className="animate-arrive flex items-start gap-2 text-[13px] leading-6 text-foreground/85"
              >
                <span className="mt-2.5 size-1 shrink-0 rounded-full bg-foreground/50" />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function renderContent(content: string) {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let currentCodeBlock: string[] | null = null
  let codeLanguage = ''

  lines.forEach((line, index) => {
    if (line.startsWith('```')) {
      if (currentCodeBlock === null) {
        currentCodeBlock = []
        codeLanguage = line.slice(3).trim()
      } else {
        elements.push(
          <CodeBlock
            key={`code-${index}`}
            code={currentCodeBlock.join('\n')}
            language={codeLanguage}
          />
        )
        currentCodeBlock = null
        codeLanguage = ''
      }
      return
    }

    if (currentCodeBlock !== null) {
      currentCodeBlock.push(line)
      return
    }

    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={index} className="mt-5 mb-2 text-[1.2rem] font-semibold tracking-[-0.015em] text-foreground first:mt-0">
          {line.slice(2)}
        </h1>
      )
      return
    }

    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={index} className="mt-5 mb-1.5 text-[1.075rem] font-semibold tracking-[-0.01em] text-foreground first:mt-0">
          {line.slice(3)}
        </h2>
      )
      return
    }

    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={index} className="mt-4 mb-1 text-[15px] font-semibold text-foreground first:mt-0">
          {line.slice(4)}
        </h3>
      )
      return
    }

    if (line.match(/^---+$/)) {
      elements.push(<hr key={index} className="my-5 border-border" />)
      return
    }

    if (line.match(/^[-*•]\s/)) {
      elements.push(
        <li key={index} className="ml-5 list-disc pl-1 marker:text-muted-foreground/70 [&+li]:mt-1">
          {formatInlineStyles(line.slice(2))}
        </li>
      )
      return
    }

    if (line.includes('|') && line.trim().startsWith('|')) {
      elements.push(
        <div
          key={index}
          className="overflow-x-auto bg-white/[0.03] px-2.5 py-1 font-mono text-[13px] first:rounded-t-md last:rounded-b-md"
        >
          {line}
        </div>
      )
      return
    }

    if (line.trim() === '') {
      elements.push(<div key={index} className="h-2" />)
      return
    }

    elements.push(
      <p key={index} className="leading-7">
        {formatInlineStyles(line)}
      </p>
    )
  })

  return elements
}

function formatInlineStyles(text: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`)/)

  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={i}
          className="rounded-[5px] bg-white/[0.07] px-1.5 py-0.5 font-mono text-[0.85em] text-foreground shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.05)]"
        >
          {part.slice(1, -1)}
        </code>
      )
    }

    const boldParts = part.split(/(\*\*[^*]+\*\*)/)

    return boldParts.map((boldPart, j) => {
      if (boldPart.startsWith('**') && boldPart.endsWith('**')) {
        return (
          <strong key={`${i}-${j}`} className="font-semibold text-foreground">
            {boldPart.slice(2, -2)}
          </strong>
        )
      }

      const italicParts = boldPart.split(/(\*[^*]+\*)/)

      return italicParts.map((italicPart, k) => {
        if (italicPart.startsWith('*') && italicPart.endsWith('*')) {
          return (
            <em key={`${i}-${j}-${k}`} className="italic">
              {italicPart.slice(1, -1)}
            </em>
          )
        }

        return italicPart
      })
    })
  })
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="my-4 overflow-hidden rounded-lg border border-border bg-black/30">
      <div className="flex items-center justify-between border-b border-border bg-white/[0.02] py-1 pr-1 pl-3">
        <span className="font-mono text-[11.5px] text-muted-foreground">
          {language || 'plaintext'}
        </span>
        <Button
          variant="ghost"
          size="sm"
          aria-label={copied ? 'Code copied' : 'Copy code'}
          className="h-7 gap-1.5 rounded-md px-2 text-[12px] text-muted-foreground hover:text-foreground"
          onClick={handleCopy}
        >
          {copied ? (
            <CheckIcon className="size-3.5 text-code" />
          ) : (
            <CopyIcon className="size-3.5" />
          )}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre className="overflow-x-auto p-4">
        <code className="font-mono text-[13px] leading-6 text-foreground/90">{code}</code>
      </pre>
    </div>
  )
}

function AttachmentList({
  message,
  onOpenImage,
  onDownloadImage,
}: {
  message: Message
  onOpenImage: (attachment: Attachment) => void
  onDownloadImage: (attachment: Attachment) => void
}) {
  const {
    listFileIntelligence,
    reindexFile,
    deleteFile,
    openWorkspaceTool,
  } = useChatContext()
  const [filesById, setFilesById] = useState<Record<string, FileIntelligence>>({})
  const [workingFileId, setWorkingFileId] = useState<string | null>(null)
  const fileIds = useMemo(
    () => [
      ...new Set(
        (message.attachments ?? [])
          .map((attachment) => attachment.fileId)
          .filter(Boolean) as string[]
      ),
    ],
    [message.attachments]
  )

  useEffect(() => {
    if (fileIds.length === 0) return

    let cancelled = false
    void listFileIntelligence({ ids: fileIds })
      .then((response) => {
        if (cancelled) return
        setFilesById(
          Object.fromEntries(response.files.map((file) => [file.id, file]))
        )
      })
      .catch((error) => {
        console.error('Failed to load file intelligence.', error)
      })

    return () => {
      cancelled = true
    }
  }, [fileIds, listFileIntelligence])

  const fallbackFile = (attachment: Attachment): FileIntelligence => ({
    id: attachment.fileId ?? attachment.id,
    fileName: attachment.name,
    mimeType: attachment.mimeType,
    byteSize: attachment.size,
    projectId: null,
    conversationId: null,
    messageId: message.id,
    visibility: 'private',
    viewUrl: attachment.previewUrl ?? null,
    downloadUrl: null,
    knowledgeStatus: attachment.fileId ? 'pending' : 'skipped',
    knowledgeStatusLabel: attachment.fileId ? 'Pending' : 'Skipped',
    knowledgeReason: attachment.fileId
      ? 'Indexing state has not been recorded yet.'
      : 'This attachment is not linked to stored file metadata.',
    chunkCount: 0,
    embeddingModel: null,
    knowledgeUpdatedAt: null,
    embeddingsAvailable: false,
    createdAt: attachment.createdAt,
    updatedAt: attachment.createdAt,
  })

  const handleAsk = (file: FileIntelligence) => {
    openWorkspaceTool({
      tool: 'ask-files',
      projectId: file.projectId,
      fileId: file.id,
    })
  }

  const handleReindex = async (file: FileIntelligence) => {
    setWorkingFileId(file.id)
    try {
      const updated = await reindexFile(file.id)
      if (updated) {
        setFilesById((previous) => ({ ...previous, [updated.id]: updated }))
      }
    } catch (error) {
      console.error('Failed to re-index file.', error)
    } finally {
      setWorkingFileId(null)
    }
  }

  const handleDelete = async (file: FileIntelligence) => {
    setWorkingFileId(file.id)
    try {
      await deleteFile(file.id)
      setFilesById((previous) => {
        const next = { ...previous }
        delete next[file.id]
        return next
      })
    } catch (error) {
      console.error('Failed to remove file.', error)
    } finally {
      setWorkingFileId(null)
    }
  }

  if (!message.attachments || message.attachments.length === 0) return null

  return (
    <div className="mt-3 space-y-2">
      {message.attachments.map((attachment) => {
        const file =
          (attachment.fileId ? filesById[attachment.fileId] : null) ??
          fallbackFile(attachment)

        return (
          <div key={attachment.id} className="space-y-2">
            <FileIntelligenceCard
              file={file}
              compact
              isWorking={workingFileId === file.id}
              onAsk={handleAsk}
              onReindex={attachment.fileId ? handleReindex : undefined}
              onDelete={attachment.fileId ? handleDelete : undefined}
            />
          {attachment.kind === 'image' && attachment.previewUrl ? (
            <ChatImageMessage
              attachment={attachment}
              onOpen={onOpenImage}
              onDownload={onDownloadImage}
            />
          ) : null}
          </div>
        )
      })}
    </div>
  )
}

function isFileKnowledgeSource(source: MessageSource): source is FileKnowledgeSource {
  return source.kind === 'file'
}

function SourceList({ message }: { message: Message }) {
  const sources = message.sources ?? []
  if (sources.length === 0) return null

  const fileSources = sources.filter(isFileKnowledgeSource)
  const webSources = sources.filter((source) => !isFileKnowledgeSource(source))
  const hasMixed = fileSources.length > 0 && webSources.length > 0

  return (
    <div className="mt-3 space-y-2">
      {fileSources.length > 0 ? (
        <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {hasMixed ? 'File context used' : 'Sources'}
          </p>
          <div className="mt-2 space-y-2.5">
            {fileSources.map((source) => {
              const hasLink = Boolean(source.url && source.url !== '#')
              const chunkLabel = `Chunk ${source.chunkIndex + 1}`
              const inner = (
                <>
                  <FileText className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-xs font-medium text-foreground/90">
                        {source.title}
                      </span>
                      <span className="shrink-0 rounded border border-border/60 bg-background/60 px-1 py-px text-[10px] text-muted-foreground">
                        {chunkLabel}
                      </span>
                    </span>
                    {source.snippet ? (
                      <span className="mt-1 block line-clamp-3 text-xs leading-5 text-muted-foreground">
                        {source.snippet}
                      </span>
                    ) : (
                      <span className="mt-1 block text-xs text-muted-foreground/60">
                        Relevant file context used
                      </span>
                    )}
                  </span>
                </>
              )

              return hasLink ? (
                <a
                  key={source.chunkId}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-start gap-2 text-xs leading-5 text-foreground/90 transition-colors hover:text-foreground"
                >
                  {inner}
                  <ExternalLink className="mt-0.5 size-3 shrink-0 text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100" />
                </a>
              ) : (
                <div
                  key={source.chunkId}
                  className="flex items-start gap-2 text-xs leading-5 text-foreground/90"
                >
                  {inner}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {webSources.length > 0 ? (
        <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {hasMixed ? 'Web sources' : 'Sources'}
          </p>
          <div className="mt-2 space-y-2">
            {webSources.map((source) => (
              <a
                key={`${source.id}-${source.url}`}
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="group flex items-start gap-2 text-xs leading-5 text-foreground/90 transition-colors hover:text-foreground sm:text-sm"
              >
                <span className="mt-0.5 shrink-0 rounded-md border border-border/70 bg-background/70 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                  {source.id}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{source.title}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {source.domain}
                    <ExternalLink className="size-3 opacity-70 transition-opacity group-hover:opacity-100" />
                  </span>
                </span>
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ImageViewerDialog({
  attachment,
  open,
  onOpenChange,
  onDownload,
}: {
  attachment: Attachment | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDownload: (attachment: Attachment) => void
}) {
  if (!attachment?.previewUrl) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-5xl rounded-[28px] border border-border/70 bg-background/95 p-0 shadow-2xl shadow-black/40">
        <DialogHeader className="border-b border-border/70 px-4 py-4 text-left sm:px-6">
          <DialogTitle>{attachment.name}</DialogTitle>
          <DialogDescription>
            View, download, or open this image in a new tab.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 p-3 sm:p-4">
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-background">
            {/* eslint-disable-next-line @next/next/no-img-element -- next/image is unoptimized project-wide; previewUrl has no known dimensions */}
            <img
              src={attachment.previewUrl}
              alt={attachment.name}
              className="max-h-[72vh] w-full object-contain bg-black/30"
            />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              className="rounded-xl"
              onClick={() => onDownload(attachment)}
            >
              <Download className="mr-2 size-4" />
              Download
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => openAttachmentImageInNewTab(attachment)}
            >
              <ExternalLink className="mr-2 size-4" />
              Open in new tab
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function getFirstImageAttachment(message: Message): Attachment | null {
  return (
    message.attachments?.find(
      (attachment) => attachment.kind === 'image' && attachment.previewUrl
    ) ?? null
  )
}

function ActionIconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            className="size-8 text-muted-foreground hover:text-foreground"
            onClick={onClick}
          >
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Memoized: while a reply streams, only the streaming message should re-render.
export const ChatMessage = memo(function ChatMessage({
  message,
  conversationId,
  onRegenerate,
  onRetry,
  onEdit,
  onAskAnotherMode,
  onSaveArtifact,
  onHandoff,
  onQualityAction,
  isLastAssistant,
  isLastUser,
  isStreamingMessage = false,
  errorOverride,
  workingTitle,
  workingNotes = [],
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [selectedImageAttachment, setSelectedImageAttachment] = useState<Attachment | null>(
    null
  )
  const [draftValue, setDraftValue] = useState(message.content)
  const [isWorkingExpanded, setIsWorkingExpanded] = useState(false)
  const [isSavingArtifact, setIsSavingArtifact] = useState(false)
  const [handoffDraft, setHandoffDraft] = useState<{
    target: AssistantHandoffTarget
    prompt: string
  } | null>(null)
  const [isSendingHandoff, setIsSendingHandoff] = useState(false)
  const [qualityDraft, setQualityDraft] = useState<{
    action: AssistantQualityAction
    prompt: string
  } | null>(null)
  const [isSendingQualityAction, setIsSendingQualityAction] = useState(false)

  useEffect(() => {
    if (!isStreamingMessage) {
      setIsWorkingExpanded(false)
    }
  }, [isStreamingMessage])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleOpenImage = (attachment: Attachment) => {
    setSelectedImageAttachment(attachment)
  }

  const handleDownloadImage = async (attachment: Attachment) => {
    await downloadAttachmentImage(attachment)
  }

  const handleSaveArtifact = async () => {
    if (!onSaveArtifact || effectiveStatus === 'streaming' || !message.content.trim()) {
      return
    }

    setIsSavingArtifact(true)
    try {
      await onSaveArtifact(message)
    } finally {
      setIsSavingArtifact(false)
    }
  }

  const handleOpenHandoff = (target: AssistantHandoffTarget) => {
    setHandoffDraft({
      target,
      prompt: buildAssistantHandoffPrompt({ message, target }),
    })
  }

  const handleSendHandoff = async () => {
    if (!onHandoff || !handoffDraft?.prompt.trim()) return

    setIsSendingHandoff(true)
    try {
      await onHandoff(message, handoffDraft.target, handoffDraft.prompt.trim())
      setHandoffDraft(null)
    } finally {
      setIsSendingHandoff(false)
    }
  }

  const handleOpenQualityAction = (action: AssistantQualityAction) => {
    setQualityDraft({
      action,
      prompt: buildAssistantQualityPrompt({ message, action }),
    })
  }

  const handleSendQualityAction = async () => {
    if (!onQualityAction || !qualityDraft?.prompt.trim()) return

    setIsSendingQualityAction(true)
    try {
      await onQualityAction(message, qualityDraft.action, qualityDraft.prompt.trim())
      setQualityDraft(null)
    } finally {
      setIsSendingQualityAction(false)
    }
  }

  const firstImageAttachment = getFirstImageAttachment(message)

  const effectiveStatus =
    errorOverride && message.status === 'streaming' ? 'error' : message.status
  const effectiveError = errorOverride ?? message.error
  const displayContent =
    effectiveStatus === 'error' && !message.content.trim()
      ? effectiveError ?? ''
      : message.content

  const renderedContent = useMemo(
    () => renderContent(displayContent),
    [displayContent]
  )
  const previewDocument = useMemo(
    () => getWebPreviewDocument(displayContent),
    [displayContent]
  )
  const canHandoff =
    Boolean(onHandoff) &&
    effectiveStatus !== 'streaming' &&
    effectiveStatus !== 'error' &&
    Boolean(message.content.trim())
  const canRunQualityAction =
    Boolean(onQualityAction) &&
    effectiveStatus !== 'streaming' &&
    effectiveStatus !== 'error' &&
    Boolean(message.content.trim())
  const canSendFeedback =
    message.role === 'assistant' &&
    effectiveStatus === 'complete' &&
    Boolean(message.content.trim())
  const canSaveArtifact =
    Boolean(onSaveArtifact) &&
    effectiveStatus === 'complete' &&
    Boolean(message.content.trim())
  const hasMoreActions =
    canSaveArtifact || canRunQualityAction || canHandoff || Boolean(firstImageAttachment)
  const qualityGroups = useMemo(
    () => getQualityActionGroupsForMessage(message),
    [message]
  )

  if (message.role === 'user') {
    return (
      <div className="group animate-arrive mb-8 flex justify-end">
        <div className="flex max-w-[92%] items-start sm:max-w-[80%]">
          <div className="flex min-w-0 flex-col items-end">
            <div className="min-w-0 max-w-full rounded-2xl rounded-br-md bg-white/[0.07] px-4 py-2.5 text-foreground shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.04)]">
              {isEditing ? (
                <div className="space-y-3">
                  <Textarea
                    value={draftValue}
                    onChange={(event) => setDraftValue(event.target.value)}
                    className="min-h-[120px] min-w-[min(32rem,70vw)] border-white/15 bg-black/20 text-foreground placeholder:text-muted-foreground"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setDraftValue(message.content)
                        setIsEditing(false)
                      }}
                    >
                      <XIcon className="size-3.5 mr-1.5" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="bg-white text-black hover:bg-white/90"
                      onClick={() => {
                        onEdit?.(draftValue.trim(), message.id)
                        setIsEditing(false)
                      }}
                      disabled={!draftValue.trim()}
                    >
                      Save & rerun
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  {!!message.content && (
                    <p className="[overflow-wrap:anywhere] text-[15px] leading-7 whitespace-pre-wrap">
                      {message.content}
                    </p>
                  )}
                  <AttachmentList
                    message={message}
                    onOpenImage={handleOpenImage}
                    onDownloadImage={handleDownloadImage}
                  />
                </div>
              )}
            </div>
            <div className="mt-1.5 flex min-h-8 flex-wrap items-center justify-end gap-2 text-[12px] text-muted-foreground/80">
              <span>{formatMessageTime(message.createdAt)}</span>
              {isLastUser && !isEditing && (
                <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                  <ActionIconButton label="Edit message" onClick={() => setIsEditing(true)}>
                    <PencilLine className="size-4" />
                  </ActionIconButton>
                  {onRetry ? (
                    <ActionIconButton label="Send again" onClick={onRetry}>
                      <RefreshIcon className="size-4" />
                    </ActionIconButton>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="group animate-arrive mb-8 flex justify-start">
        <div className="flex w-full min-w-0 items-start gap-3">
          <div
            className={cn(
              'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.06)]',
              getModeColorClasses(message.mode)
            )}
          >
            {message.customAssistant ? (
              <span className="text-sm leading-none">
                {message.customAssistant.iconEmoji}
              </span>
            ) : (
              <ModeIcon mode={message.mode} size="sm" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-1 flex h-7 items-center gap-2 text-[13px] font-medium text-foreground">
              {message.customAssistant?.name ?? MODE_CONFIGS[message.mode].name}
            </p>
            <div
              className={cn(
                'transition-colors',
                isStreamingMessage && workingNotes.length > 0 && 'cursor-pointer'
              )}
              onClick={() => {
                if (isStreamingMessage && workingNotes.length > 0) {
                  setIsWorkingExpanded((value) => !value)
                }
              }}
            >
              {message.branchLabel ? (
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-white/[0.02] px-2 py-0.5 text-[12px] text-muted-foreground">
                  <ModeIcon mode={message.mode} size="sm" />
                  {message.branchLabel}
                </div>
              ) : null}
              {message.customAssistant ? (
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-md border border-border bg-white/[0.02] px-2 py-0.5 text-[12px] text-muted-foreground">
                  <span>{message.customAssistant.iconEmoji}</span>
                  <span>{message.customAssistant.name}</span>
                  <span className="text-muted-foreground/70">
                    {MODE_CONFIGS[message.customAssistant.baseMode].name}
                  </span>
                </div>
              ) : null}
              {effectiveStatus === 'streaming' ? (
                renderStreamingState(displayContent, message.mode)
              ) : (
                <div className="max-w-none [overflow-wrap:anywhere] text-[15px] leading-7 text-foreground/90">
                  {renderedContent}
                </div>
              )}
              <AttachmentList
                message={message}
                onOpenImage={handleOpenImage}
                onDownloadImage={handleDownloadImage}
              />
              <SourceList message={message} />
              {isStreamingMessage ? (
                <WorkingNotesPanel
                  title={workingTitle}
                  notes={workingNotes}
                  expanded={isWorkingExpanded}
                  onToggle={() => setIsWorkingExpanded((value) => !value)}
                />
              ) : null}
            </div>

            {effectiveStatus !== 'streaming' ? (
              <div
                className={cn(
                  '-ml-1.5 mt-2 flex flex-wrap items-center gap-0.5 transition-opacity duration-200',
                  isLastAssistant || effectiveStatus === 'error'
                    ? 'opacity-100'
                    : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100'
                )}
              >
                {effectiveStatus === 'error' && onRetry ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mr-1 h-8 gap-1.5 rounded-full px-3 text-xs"
                    onClick={onRetry}
                  >
                    <RefreshIcon className="size-3.5" />
                    Retry
                  </Button>
                ) : null}

                {message.content.trim() ? (
                  <ActionIconButton
                    label={copied ? 'Copied' : 'Copy'}
                    onClick={() => void handleCopy()}
                  >
                    {copied ? (
                      <CheckIcon className="size-4 text-code" />
                    ) : (
                      <CopyIcon className="size-4" />
                    )}
                  </ActionIconButton>
                ) : null}

                {canSendFeedback ? (
                  <FeedbackButtons
                    entityType="message"
                    entityId={message.id}
                    metadata={{
                      assistantFamily: message.assistantFamily,
                      mode: message.mode,
                      model: message.model,
                      conversationId,
                      sourceCount: message.sources?.length ?? 0,
                      customAssistantId: message.customAssistantId,
                    }}
                  />
                ) : null}

                {firstImageAttachment ? (
                  <ActionIconButton
                    label="Download image"
                    onClick={() => void handleDownloadImage(firstImageAttachment)}
                  >
                    <Download className="size-4" />
                  </ActionIconButton>
                ) : null}

                {isLastAssistant && onRegenerate && effectiveStatus !== 'error' ? (
                  message.mode === 'image' ? (
                    <ActionIconButton label="Regenerate" onClick={() => onRegenerate()}>
                      <RefreshIcon className="size-4" />
                    </ActionIconButton>
                  ) : (
                    <DropdownMenu>
                      <TooltipProvider delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Regenerate"
                                className="size-8 text-muted-foreground hover:text-foreground"
                              >
                                <RefreshIcon className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                          </TooltipTrigger>
                          <TooltipContent>Regenerate</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <DropdownMenuContent align="start" className="w-64">
                        <DropdownMenuItem onSelect={() => onRegenerate()}>
                          <RefreshIcon className="size-4" />
                          Regenerate
                        </DropdownMenuItem>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <Sparkles className="size-4" />
                            Use different intelligence
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-64">
                            {INTELLIGENCE_LEVEL_OPTIONS.map((option) => (
                              <DropdownMenuItem
                                key={option.id}
                                className="items-start py-2"
                                onSelect={() => onRegenerate(option.id)}
                              >
                                <span className="min-w-0">
                                  <span className="block text-sm font-medium">
                                    {option.label}
                                  </span>
                                  <span className="block text-xs leading-5 text-muted-foreground">
                                    {option.hint}
                                  </span>
                                </span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        {onAskAnotherMode ? (
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <ModeIcon mode={message.mode} size="sm" />
                              Ask another assistant
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="w-48">
                              {MODE_ORDER.filter((mode) => mode !== message.mode).map((mode) => (
                                <DropdownMenuItem
                                  key={mode}
                                  onSelect={() => onAskAnotherMode(mode)}
                                >
                                  <span className={cn('inline-flex', getModeAccentClass(mode, 'text'))}>
                                    <ModeIcon mode={mode} size="sm" />
                                  </span>
                                  {MODE_CONFIGS[mode].name}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )
                ) : null}

                {previewDocument ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 rounded-full px-2.5 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setIsPreviewOpen(true)}
                  >
                    <Play className="size-3.5" />
                    Preview app
                  </Button>
                ) : null}

                {hasMoreActions ? (
                  <DropdownMenu>
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="More actions"
                              className="size-8 text-muted-foreground hover:text-foreground"
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent>More</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <DropdownMenuContent align="start" className="w-64">
                      {canSaveArtifact ? (
                        <DropdownMenuItem
                          disabled={isSavingArtifact}
                          onSelect={() => void handleSaveArtifact()}
                        >
                          <FileText className="size-4" />
                          {isSavingArtifact ? 'Saving…' : 'Save as artifact'}
                        </DropdownMenuItem>
                      ) : null}
                      {firstImageAttachment ? (
                        <DropdownMenuItem onSelect={() => handleOpenImage(firstImageAttachment)}>
                          <ImageIcon className="size-4" />
                          Open image
                        </DropdownMenuItem>
                      ) : null}
                      {canRunQualityAction ? (
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <Sparkles className="size-4" />
                            Improve this reply
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-56">
                            {qualityGroups.map((group) => (
                              <DropdownMenuSub key={group.id}>
                                <DropdownMenuSubTrigger>
                                  {group.family ? (
                                    <span
                                      className={cn(
                                        'inline-flex',
                                        getModeAccentClass(
                                          resolveQualityActionMode(group.actions[0], message),
                                          'text'
                                        )
                                      )}
                                    >
                                      <ModeIcon
                                        mode={resolveQualityActionMode(group.actions[0], message)}
                                        size="sm"
                                      />
                                    </span>
                                  ) : (
                                    <Sparkles className="size-4" />
                                  )}
                                  {group.label}
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="w-72">
                                  {group.actions.map((action) => (
                                    <DropdownMenuItem
                                      key={action.id}
                                      className="items-start py-2"
                                      onSelect={() => handleOpenQualityAction(action)}
                                    >
                                      <span className="min-w-0">
                                        <span className="block text-sm font-medium">
                                          {action.label}
                                        </span>
                                        <span className="block text-xs leading-5 text-muted-foreground">
                                          {action.description}
                                        </span>
                                      </span>
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      ) : null}
                      {canHandoff ? (
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <SendHorizontal className="size-4" />
                            Send to another assistant
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-72">
                            {ASSISTANT_HANDOFF_TARGETS.map((target) => (
                              <DropdownMenuItem
                                key={target.family}
                                className="items-start gap-2 py-2"
                                onSelect={() => handleOpenHandoff(target)}
                              >
                                <span
                                  className={cn(
                                    'mt-0.5 inline-flex',
                                    getModeAccentClass(target.mode, 'text')
                                  )}
                                >
                                  <ModeIcon mode={target.mode} size="sm" />
                                </span>
                                <span className="min-w-0">
                                  <span className="block text-sm font-medium">
                                    {target.label}
                                  </span>
                                  <span className="block text-xs leading-5 text-muted-foreground">
                                    {target.actionLabel}
                                  </span>
                                </span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}

                <span className="ml-1.5 text-xs text-muted-foreground">
                  {effectiveStatus === 'error'
                    ? 'Did not finish'
                    : formatMessageTime(message.createdAt)}
                </span>
              </div>
            ) : null}

            {effectiveError && (
              <p className="mt-2 text-xs text-destructive">{effectiveError}</p>
            )}
          </div>
        </div>
      </div>

      {previewDocument ? (
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="w-[calc(100vw-1rem)] max-w-5xl rounded-[28px] border border-border/70 bg-background/95 p-0 shadow-2xl shadow-black/40">
            <DialogHeader className="border-b border-border/70 px-4 py-4 text-left sm:px-6">
              <DialogTitle>Live Preview</DialogTitle>
              <DialogDescription>
                Run and inspect HTML, CSS, and JavaScript directly from this response.
              </DialogDescription>
            </DialogHeader>
            <div className="p-3 sm:p-4">
              <div className="overflow-hidden rounded-2xl border border-border/70 bg-background">
                <iframe
                  title="Zenquanta app preview"
                  srcDoc={previewDocument}
                  sandbox="allow-scripts allow-modals"
                  className="h-[65vh] min-h-[420px] w-full bg-white"
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

      {handoffDraft ? (
        <Dialog
          open={Boolean(handoffDraft)}
          onOpenChange={(open) => {
            if (!open && !isSendingHandoff) {
              setHandoffDraft(null)
            }
          }}
        >
          <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl rounded-[24px] border border-border/70 bg-background/95 p-0 shadow-2xl shadow-black/40">
            <DialogHeader className="border-b border-border/70 px-5 py-5 text-left sm:px-6">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'flex size-10 items-center justify-center rounded-xl border border-white/10 bg-card/80',
                    getModeAccentClass(handoffDraft.target.mode, 'text')
                  )}
                >
                  <ModeIcon mode={handoffDraft.target.mode} size="md" />
                </span>
                <div>
                  <DialogTitle>Send to {handoffDraft.target.label}</DialogTitle>
                  <DialogDescription className="mt-1">
                    {handoffDraft.target.description}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 px-5 py-5 sm:px-6">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Handoff prompt
                </label>
                <Textarea
                  value={handoffDraft.prompt}
                  onChange={(event) =>
                    setHandoffDraft((previous) =>
                      previous
                        ? {
                            ...previous,
                            prompt: event.target.value,
                          }
                        : previous
                    )
                  }
                  className="mt-2 min-h-[260px] resize-y rounded-2xl border-border/70 bg-card/50 text-sm leading-6"
                />
              </div>

              <div className="rounded-2xl border border-border/70 bg-card/50 px-4 py-3 text-xs leading-5 text-muted-foreground">
                Review or edit the prompt before sending. This will run through the
                normal {handoffDraft.target.mode === 'image' ? 'Prism image' : 'text chat'}{' '}
                path and may consume usage.
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-xl"
                  disabled={isSendingHandoff}
                  onClick={() => setHandoffDraft(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className={cn(
                    'rounded-xl text-white',
                    getModeAccentClass(handoffDraft.target.mode, 'bg')
                  )}
                  disabled={isSendingHandoff || !handoffDraft.prompt.trim()}
                  onClick={() => void handleSendHandoff()}
                >
                  {isSendingHandoff ? (
                    <span className="size-3.5 animate-spin rounded-full border border-current border-t-transparent" />
                  ) : (
                    <SendHorizontal className="size-3.5" />
                  )}
                  Send to {handoffDraft.target.label}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

      {qualityDraft ? (
        <Dialog
          open={Boolean(qualityDraft)}
          onOpenChange={(open) => {
            if (!open && !isSendingQualityAction) {
              setQualityDraft(null)
            }
          }}
        >
          <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl rounded-[24px] border border-border/70 bg-background/95 p-0 shadow-2xl shadow-black/40">
            <DialogHeader className="border-b border-border/70 px-5 py-5 text-left sm:px-6">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'flex size-10 items-center justify-center rounded-xl border border-white/10 bg-card/80',
                    getModeAccentClass(
                      resolveQualityActionMode(qualityDraft.action, message),
                      'text'
                    )
                  )}
                >
                  <ModeIcon
                    mode={resolveQualityActionMode(qualityDraft.action, message)}
                    size="md"
                  />
                </span>
                <div>
                  <DialogTitle>{qualityDraft.action.label}</DialogTitle>
                  <DialogDescription className="mt-1">
                    {qualityDraft.action.description}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 px-5 py-5 sm:px-6">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Follow-up prompt
                </label>
                <Textarea
                  value={qualityDraft.prompt}
                  onChange={(event) =>
                    setQualityDraft((previous) =>
                      previous
                        ? {
                            ...previous,
                            prompt: event.target.value,
                          }
                        : previous
                    )
                  }
                  className="mt-2 min-h-[260px] resize-y rounded-2xl border-border/70 bg-card/50 text-sm leading-6"
                />
              </div>

              <div className="rounded-2xl border border-border/70 bg-card/50 px-4 py-3 text-xs leading-5 text-muted-foreground">
                Review or edit the prompt before sending. This will run through the
                normal{' '}
                {resolveQualityActionMode(qualityDraft.action, message) === 'image'
                  ? 'Prism image'
                  : 'text chat'}{' '}
                path and may consume usage.
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-xl"
                  disabled={isSendingQualityAction}
                  onClick={() => setQualityDraft(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className={cn(
                    'rounded-xl text-white',
                    getModeAccentClass(
                      resolveQualityActionMode(qualityDraft.action, message),
                      'bg'
                    )
                  )}
                  disabled={isSendingQualityAction || !qualityDraft.prompt.trim()}
                  onClick={() => void handleSendQualityAction()}
                >
                  {isSendingQualityAction ? (
                    <span className="size-3.5 animate-spin rounded-full border border-current border-t-transparent" />
                  ) : (
                    <Sparkles className="size-3.5" />
                  )}
                  Run action
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

      <ImageViewerDialog
        attachment={selectedImageAttachment}
        open={Boolean(selectedImageAttachment)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedImageAttachment(null)
          }
        }}
        onDownload={handleDownloadImage}
      />
    </>
  )
})
