'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  Download,
  ExternalLink,
  ImageIcon,
  PencilLine,
  Play,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AIMode, Attachment, Message, MODE_CONFIGS, MODE_ORDER } from '@/lib/types'
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
  UserIcon,
  XIcon,
} from '@/components/icons'
import { getWebPreviewDocument } from '@/lib/utils/web-preview'
import {
  downloadAttachmentImage,
  openAttachmentImageInNewTab,
} from '@/lib/utils/image-download'

interface ChatMessageProps {
  message: Message
  onRegenerate?: () => void
  onRetry?: () => void
  onEdit?: (content: string, targetMessageId?: string) => void
  onAskAnotherMode?: (mode: AIMode) => void
  isLastAssistant?: boolean
  isLastUser?: boolean
  isStreamingMessage?: boolean
  workingTitle?: string
  workingNotes?: string[]
}

function getModeColorClasses(mode: AIMode) {
  return cn(
    'border-opacity-30',
    getModeAccentClass(mode, 'text'),
    getModeAccentClass(mode, 'border'),
    getModeTintClass(mode, 'strong')
  )
}

function renderStreamingState(content: string) {
  if (!content.trim()) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div className="flex gap-1">
          <span className="size-2 rounded-full bg-current animate-bounce" />
          <span
            className="size-2 rounded-full bg-current animate-bounce"
            style={{ animationDelay: '120ms' }}
          />
          <span
            className="size-2 rounded-full bg-current animate-bounce"
            style={{ animationDelay: '240ms' }}
          />
        </div>
        <span>Generating response...</span>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="prose prose-sm prose-invert max-w-none text-foreground">
        {renderContent(content)}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="size-1.5 rounded-full bg-current animate-pulse" />
        Streaming
      </div>
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
    <div className="mt-3 rounded-2xl border border-border/60 bg-background/40">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-background/40 sm:px-4"
        onClick={(event) => {
          event.stopPropagation()
          onToggle()
        }}
      >
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {title ?? 'Working notes'}
          </p>
          <p className="mt-1 text-xs text-foreground/85 sm:text-sm">
            Click to view live response progress
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
        <div className="border-t border-border/60 px-3 py-3 sm:px-4">
          <ul className="space-y-2">
            {notes.map((note) => (
              <li
                key={note}
                className="flex items-start gap-2 text-xs leading-6 text-foreground/90 sm:text-sm"
              >
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-foreground/70" />
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
        <h1 key={index} className="text-xl font-bold mt-4 mb-2">
          {line.slice(2)}
        </h1>
      )
      return
    }

    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={index} className="text-lg font-semibold mt-3 mb-2">
          {line.slice(3)}
        </h2>
      )
      return
    }

    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={index} className="text-base font-semibold mt-2 mb-1">
          {line.slice(4)}
        </h3>
      )
      return
    }

    if (line.match(/^---+$/)) {
      elements.push(<hr key={index} className="my-4 border-border" />)
      return
    }

    if (line.match(/^[-*•]\s/)) {
      elements.push(
        <li key={index} className="ml-4 list-disc">
          {formatInlineStyles(line.slice(2))}
        </li>
      )
      return
    }

    if (line.includes('|') && line.trim().startsWith('|')) {
      elements.push(
        <div
          key={index}
          className="overflow-x-auto text-sm font-mono bg-muted/30 px-2 py-1 rounded"
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
      <p key={index} className="leading-relaxed">
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
          className="px-1.5 py-0.5 rounded bg-muted font-mono text-sm"
        >
          {part.slice(1, -1)}
        </code>
      )
    }

    const boldParts = part.split(/(\*\*[^*]+\*\*)/)

    return boldParts.map((boldPart, j) => {
      if (boldPart.startsWith('**') && boldPart.endsWith('**')) {
        return (
          <strong key={`${i}-${j}`} className="font-semibold">
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
    <div className="my-3 rounded-xl overflow-hidden border border-border bg-background/50">
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b border-border">
        <span className="text-xs font-mono text-muted-foreground">
          {language || 'plaintext'}
        </span>
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-6"
                onClick={handleCopy}
              >
                {copied ? (
                  <CheckIcon className="size-3 text-code" />
                ) : (
                  <CopyIcon className="size-3" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{copied ? 'Copied!' : 'Copy code'}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <pre className="p-4 overflow-x-auto">
        <code className="text-sm font-mono leading-relaxed">{code}</code>
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
  if (!message.attachments || message.attachments.length === 0) return null

  return (
    <div className="mt-3 space-y-2">
      {message.attachments.map((attachment) => (
        <div
          key={attachment.id}
          className="rounded-xl border border-border/60 bg-background/50 px-3 py-2"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {attachment.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {attachment.kind}
                {attachment.isExtracted ? ' • text extracted' : ''}
              </p>
            </div>
            {attachment.previewUrl ? (
              attachment.kind === 'image' ? (
                <button
                  type="button"
                  className="rounded-lg transition-opacity hover:opacity-90"
                  onClick={() => onOpenImage(attachment)}
                >
                  <img
                    src={attachment.previewUrl}
                    alt={attachment.name}
                    className="size-12 rounded-lg object-cover"
                  />
                </button>
              ) : (
                <img
                  src={attachment.previewUrl}
                  alt={attachment.name}
                  className="size-12 rounded-lg object-cover"
                />
              )
            ) : null}
          </div>
          {attachment.kind === 'image' && attachment.previewUrl ? (
            <div className="mt-3 overflow-hidden rounded-xl border border-border/60 bg-background/80">
              <button
                type="button"
                className="block w-full cursor-pointer"
                onClick={() => onOpenImage(attachment)}
              >
                <img
                  src={attachment.previewUrl}
                  alt={attachment.name}
                  className="max-h-[360px] w-full object-cover"
                />
              </button>
              <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs text-muted-foreground">
                <span>{attachment.textContent ? 'Generated visual' : 'Image attachment'}</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 rounded-full px-2.5 text-xs text-foreground"
                    onClick={() => onOpenImage(attachment)}
                  >
                    View
                    <ExternalLink className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 rounded-full px-2.5 text-xs text-foreground"
                    onClick={() => onDownloadImage(attachment)}
                  >
                    Download
                    <Download className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ))}
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

export function ChatMessage({
  message,
  onRegenerate,
  onRetry,
  onEdit,
  onAskAnotherMode,
  isLastAssistant,
  isLastUser,
  isStreamingMessage = false,
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

  const firstImageAttachment = getFirstImageAttachment(message)

  const renderedContent = useMemo(
    () => renderContent(message.content),
    [message.content]
  )
  const previewDocument = useMemo(
    () => getWebPreviewDocument(message.content),
    [message.content]
  )

  if (message.role === 'user') {
    return (
      <div className="flex justify-end mb-6 group">
        <div className="flex items-start gap-3 max-w-[85%]">
          <div className="flex flex-col items-end">
            <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-md px-4 py-3 min-w-[280px]">
              {isEditing ? (
                <div className="space-y-3">
                  <Textarea
                    value={draftValue}
                    onChange={(event) => setDraftValue(event.target.value)}
                    className="min-h-[120px] border-white/15 bg-white/5 text-primary-foreground placeholder:text-primary-foreground/60"
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
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
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
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span>{formatMessageTime(message.createdAt)}</span>
              {isLastUser && !isEditing && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-7 text-muted-foreground hover:text-foreground"
                    onClick={() => setIsEditing(true)}
                  >
                    <PencilLine className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-7 text-muted-foreground hover:text-foreground"
                    onClick={onRetry}
                  >
                    <RefreshIcon className="size-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>
          <div className="shrink-0 size-8 rounded-full bg-primary/20 flex items-center justify-center">
            <UserIcon className="size-4 text-primary" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex justify-start mb-6 group">
        <div className="flex items-start gap-3 max-w-[85%]">
          <div
            className={cn(
              'shrink-0 size-8 rounded-full flex items-center justify-center border',
              getModeColorClasses(message.mode)
            )}
          >
            <ModeIcon mode={message.mode} size="sm" />
          </div>
          <div className="flex-1">
            <div
              className={cn(
                'bg-card border border-border rounded-2xl rounded-tl-md px-4 py-3 transition-colors',
                isStreamingMessage &&
                  workingNotes.length > 0 &&
                  'cursor-pointer hover:border-border/80 hover:bg-card/95'
              )}
              onClick={() => {
                if (isStreamingMessage && workingNotes.length > 0) {
                  setIsWorkingExpanded((value) => !value)
                }
              }}
            >
              {message.branchLabel ? (
                <div className="mb-3 inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  <ModeIcon mode={message.mode} size="sm" />
                  {message.branchLabel}
                </div>
              ) : null}
              {message.status === 'streaming' ? (
                renderStreamingState(message.content)
              ) : (
                <div className="prose prose-sm prose-invert max-w-none text-foreground">
                  {renderedContent}
                </div>
              )}
              <AttachmentList
                message={message}
                onOpenImage={handleOpenImage}
                onDownloadImage={handleDownloadImage}
              />
              {isStreamingMessage ? (
                <WorkingNotesPanel
                  title={workingTitle}
                  notes={workingNotes}
                  expanded={isWorkingExpanded}
                  onToggle={() => setIsWorkingExpanded((value) => !value)}
                />
              ) : null}
            </div>

            <div
              className={cn(
                'flex flex-wrap items-center gap-1 mt-2 transition-opacity',
                isLastAssistant || message.status === 'error'
                  ? 'opacity-100'
                  : 'opacity-0 group-hover:opacity-100'
              )}
            >
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-7"
                      onClick={handleCopy}
                    >
                      {copied ? (
                        <CheckIcon className="size-3.5 text-code" />
                      ) : (
                        <CopyIcon className="size-3.5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{copied ? 'Copied!' : 'Copy'}</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {previewDocument ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 rounded-full px-2.5 text-xs"
                  onClick={() => setIsPreviewOpen(true)}
                >
                  <Play className="size-3.5" />
                  Preview app
                </Button>
              ) : null}

              {firstImageAttachment ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 rounded-full px-2.5 text-xs"
                    onClick={() => handleOpenImage(firstImageAttachment)}
                  >
                    <ImageIcon className="size-3.5" />
                    Open image
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 rounded-full px-2.5 text-xs"
                    onClick={() => void handleDownloadImage(firstImageAttachment)}
                  >
                    <Download className="size-3.5" />
                    Download
                  </Button>
                </>
              ) : null}

              {isLastAssistant && (
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="size-7"
                        onClick={onRegenerate}
                      >
                        <RefreshIcon className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Regenerate</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {isLastAssistant && onAskAnotherMode ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 gap-1 rounded-full px-2.5 text-xs">
                      Another mode
                      <ChevronDown className="size-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-44">
                    {MODE_ORDER.filter((mode) => mode !== message.mode).map((mode) => (
                      <DropdownMenuItem
                        key={mode}
                        onClick={() => onAskAnotherMode(mode)}
                      >
                        <span className={cn('mr-2 inline-flex', getModeAccentClass(mode, 'text'))}>
                          <ModeIcon mode={mode} size="sm" />
                        </span>
                        {MODE_CONFIGS[mode].name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}

              {(isLastAssistant || message.status === 'error') && (
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="size-7"
                        onClick={onRetry}
                      >
                        <RefreshIcon className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Retry</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              <span className="ml-1 text-xs text-muted-foreground">
                {message.status === 'streaming'
                  ? 'Streaming'
                  : message.status === 'error'
                    ? 'Needs retry'
                    : formatMessageTime(message.createdAt)}
              </span>
            </div>

            {message.error && (
              <p className="mt-2 text-xs text-destructive">{message.error}</p>
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
}
