'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Message, AIMode } from '@/lib/types'
import { ModeIcon, getModeAccentClass } from '@/lib/mode-utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  CopyIcon,
  RefreshIcon,
  CheckIcon,
  UserIcon,
} from '@/components/icons'

interface ChatMessageProps {
  message: Message
  onRegenerate?: () => void
  onRetry?: () => void
  isLastAssistant?: boolean
}

function getModeColorClasses(mode: AIMode) {
  return cn(
    'bg-opacity-20 border-opacity-30',
    getModeAccentClass(mode, 'text'),
    getModeAccentClass(mode, 'border'),
    `bg-${mode}/20`
  )
}

// Simple markdown-like rendering
function renderContent(content: string) {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let currentCodeBlock: string[] | null = null
  let codeLanguage = ''

  lines.forEach((line, index) => {
    // Code block start/end
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

    // Headers
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

    // Horizontal rule
    if (line.match(/^---+$/)) {
      elements.push(
        <hr key={index} className="my-4 border-border" />
      )
      return
    }

    // List items
    if (line.match(/^[-*•]\s/)) {
      elements.push(
        <li key={index} className="ml-4 list-disc">
          {formatInlineStyles(line.slice(2))}
        </li>
      )
      return
    }

    // Table detection
    if (line.includes('|') && line.trim().startsWith('|')) {
      elements.push(
        <div key={index} className="overflow-x-auto text-sm font-mono bg-muted/30 px-2 py-1 rounded">
          {line}
        </div>
      )
      return
    }

    // Empty lines
    if (line.trim() === '') {
      elements.push(<div key={index} className="h-2" />)
      return
    }

    // Regular paragraph
    elements.push(
      <p key={index} className="leading-relaxed">
        {formatInlineStyles(line)}
      </p>
    )
  })

  return elements
}

function formatInlineStyles(text: string): React.ReactNode {
  // Process inline code
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
    // Bold
    const boldParts = part.split(/(\*\*[^*]+\*\*)/)
    return boldParts.map((boldPart, j) => {
      if (boldPart.startsWith('**') && boldPart.endsWith('**')) {
        return (
          <strong key={`${i}-${j}`} className="font-semibold">
            {boldPart.slice(2, -2)}
          </strong>
        )
      }
      // Italic
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

export function ChatMessage({
  message,
  onRegenerate,
  onRetry,
  isLastAssistant,
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false)

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
      <div className="flex justify-end mb-6">
        <div className="flex items-start gap-3 max-w-[85%]">
          <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-md px-4 py-3">
            <p className="text-sm leading-relaxed">{message.content}</p>
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
            <div className="prose prose-sm prose-invert max-w-none text-foreground">
              {renderedContent}
            </div>
          </div>
          {/* Action buttons */}
          <div
            className={cn(
              'flex items-center gap-1 mt-2 transition-opacity',
              isLastAssistant ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
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
              <>
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
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
