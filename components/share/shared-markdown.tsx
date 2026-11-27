'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

// A small read-only renderer for shared chats. The workspace renderer lives in
// components/chat/message.tsx and pulls in the whole chat context.

// Only http(s) links render, so shared text cannot produce javascript: or data: hrefs.
const LINK_SPLIT = /(\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/
const LINK = /^\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)$/

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="my-4 overflow-hidden rounded-lg border border-border bg-black/30">
      <div className="flex items-center justify-between border-b border-border bg-white/[0.02] py-1 pr-1 pl-3">
        <span className="font-mono text-[11.5px] text-muted-foreground">{language || 'plaintext'}</span>
        <button
          type="button"
          onClick={() => void copy()}
          aria-label={copied ? 'Code copied' : 'Copy code'}
          className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4">
        <code className="font-mono text-[13px] leading-6 text-foreground/90">{code}</code>
      </pre>
    </div>
  )
}

function renderEmphasis(text: string, key: string) {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, index) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <strong key={`${key}-${index}`} className="font-semibold text-foreground">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    )
  )
}

function renderInline(text: string) {
  return text.split(/(`[^`]+`)/).map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={index} className="rounded-[5px] bg-white/[0.07] px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
          {part.slice(1, -1)}
        </code>
      )
    }
    return part.split(LINK_SPLIT).map((piece, linkIndex) => {
      const link = piece.match(LINK)
      const key = `${index}-${linkIndex}`
      return link ? (
        <a
          key={key}
          href={link[2]}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="text-foreground underline decoration-white/30 underline-offset-2 hover:decoration-white/70"
        >
          {renderEmphasis(link[1], key)}
        </a>
      ) : (
        renderEmphasis(piece, key)
      )
    })
  })
}

export function SharedMarkdown({ content }: { content: string }) {
  const elements: React.ReactNode[] = []
  let code: string[] | null = null
  let language = ''

  content.split('\n').forEach((line, index) => {
    if (line.startsWith('```')) {
      if (code === null) {
        code = []
        language = line.slice(3).trim()
      } else {
        elements.push(<CodeBlock key={`code-${index}`} code={code.join('\n')} language={language} />)
        code = null
      }
      return
    }
    if (code !== null) {
      code.push(line)
      return
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/)
    if (heading) {
      elements.push(
        <h3 key={index} className="mt-5 mb-1.5 text-[1.05rem] font-semibold text-foreground first:mt-0">
          {renderInline(heading[2])}
        </h3>
      )
    } else if (/^---+$/.test(line)) {
      elements.push(<hr key={index} className="my-5 border-border" />)
    } else if (/^[-*•]\s/.test(line)) {
      elements.push(
        <li key={index} className="ml-5 list-disc pl-1 marker:text-muted-foreground/70">
          {renderInline(line.slice(2))}
        </li>
      )
    } else if (line.trim() === '') {
      elements.push(<div key={index} className="h-2" />)
    } else {
      elements.push(
        <p key={index} className="leading-7">
          {renderInline(line)}
        </p>
      )
    }
  })

  // An unclosed fence still shows its code.
  if (code !== null) {
    elements.push(<CodeBlock key="code-end" code={(code as string[]).join('\n')} language={language} />)
  }

  return <>{elements}</>
}
