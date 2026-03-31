'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, PencilLine } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AIMode, Message, MODE_CONFIGS, MODE_ORDER } from '@/lib/types'
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
  CheckIcon,
  CopyIcon,
  RefreshIcon,
  UserIcon,
  XIcon,
} from '@/components/icons'

interface ChatMessageProps {
  message: Message
  onRegenerate?: () => void
  onRetry?: () => void
  onEdit?: (content: string, targetMessageId?: string) => void
  onAskAnotherMode?: (mode: AIMode) => void
  isLastAssistant?: boolean
  isLastUser?: boolean
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

function AttachmentList({ message }: { message: Message }) {
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
              <img
                src={attachment.previewUrl}
                alt={attachment.name}
                className="size-12 rounded-lg object-cover"
              />
            ) : null}
          </div>
        </div>
      ))}
    </div>
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
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [draftValue, setDraftValue] = useState(message.content)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const renderedContent = useMemo(
    () => renderContent(message.content),
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
                  <AttachmentList message={message} />
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
          <div className="bg-card border border-border rounded-2xl rounded-tl-md px-4 py-3">
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
          </div>

          <div
            className={cn(
              'flex items-center gap-1 mt-2 transition-opacity',
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
            {message.usage && (
              <span className="rounded-full border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                ${message.usage.estimatedCostUsd.toFixed(4)}
              </span>
            )}
          </div>

          {message.error && (
            <p className="mt-2 text-xs text-destructive">{message.error}</p>
          )}
        </div>
      </div>
    </div>
  )
}
