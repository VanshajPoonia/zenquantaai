'use client'

import Link from 'next/link'
import { ExternalLink, FileText, ImageIcon, SquareTerminal } from 'lucide-react'
import { MODE_CONFIGS } from '@/lib/config'
import { cn } from '@/lib/utils'
import { getModeAccentClass, getModeTintClass, ModeIcon } from '@/lib/mode-utils'
import type { ConversationShareSnapshot, SharedChatMessage } from '@/types'
import { ZenquantaLogo } from '@/components/icons'
import { ToolSteps } from '@/components/chat/tool-steps'
import { SharedMarkdown } from './shared-markdown'
import { ContinueSharedChat } from './continue-shared-chat'

const IMAGE_PLACEHOLDER = 'Image not included in shared chats'

function AttachmentNames({ names }: { names: string[] }) {
  if (names.length === 0) return null
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Attached files">
      {names.map((name, index) => (
        <li
          key={`${name}-${index}`}
          className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-white/[0.02] px-2 py-0.5 text-[12px] text-muted-foreground"
        >
          <FileText className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{name}</span>
        </li>
      ))}
    </ul>
  )
}

function Sources({ message }: { message: SharedChatMessage }) {
  if (message.sources.length === 0) return null
  return (
    <div className="mt-3 border-t border-border pt-2.5">
      <p className="mb-1.5 text-[12px] font-medium text-muted-foreground">Sources</p>
      <ol className="space-y-1 text-[13px]">
        {message.sources.map((source, index) => (
          <li key={`${source.title}-${index}`} className="flex min-w-0 items-start gap-2">
            <span className="w-4 shrink-0 text-right text-muted-foreground/70">{index + 1}</span>
            {source.url ? (
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex min-w-0 items-center gap-1 text-foreground/85 underline decoration-white/20 underline-offset-2 hover:decoration-white/60"
              >
                <span className="truncate">{source.title}</span>
                <ExternalLink className="size-3 shrink-0" aria-hidden />
              </a>
            ) : (
              <span className="truncate text-muted-foreground">{source.title}</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}

function UserMessage({ message }: { message: SharedChatMessage }) {
  return (
    <div className="mb-8 flex justify-end">
      <div className="min-w-0 max-w-[92%] rounded-2xl rounded-br-md bg-white/[0.07] px-4 py-2.5 text-foreground shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.04)] sm:max-w-[80%]">
        <p className="sr-only">You said</p>
        {message.content ? (
          <p className="[overflow-wrap:anywhere] text-[15px] leading-7 whitespace-pre-wrap">
            {message.content}
          </p>
        ) : null}
        <AttachmentNames names={message.attachmentNames} />
      </div>
    </div>
  )
}

function AssistantMessage({ message }: { message: SharedChatMessage }) {
  const name = message.customAssistant?.name ?? MODE_CONFIGS[message.mode].name

  return (
    <div className="mb-8 flex w-full min-w-0 items-start gap-3">
      <div
        aria-hidden
        className={cn(
          'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg shadow-[inset_0_0_0_1px_rgb(255_255_255_/_0.06)]',
          getModeAccentClass(message.mode, 'text'),
          getModeTintClass(message.mode, 'subtle')
        )}
      >
        {message.customAssistant ? (
          <span className="text-sm leading-none">{message.customAssistant.iconEmoji}</span>
        ) : (
          <ModeIcon mode={message.mode} size="sm" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-1 flex h-7 items-center text-[13px] font-medium text-foreground">{name}</p>
        <ToolSteps parts={message.parts} isStreaming={false} />
        <div className="max-w-none [overflow-wrap:anywhere] text-[15px] leading-7 text-foreground/90">
          <SharedMarkdown content={message.content} />
        </div>
        {message.imageOmitted ? (
          <p className="mt-3 inline-flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-[13px] text-muted-foreground">
            <ImageIcon className="size-4" aria-hidden />
            {IMAGE_PLACEHOLDER}
          </p>
        ) : null}
        <AttachmentNames names={message.attachmentNames} />
        <Sources message={message} />
      </div>
    </div>
  )
}

export function SharedChatView({
  token,
  snapshot,
  sharedOn,
}: {
  token: string
  snapshot: ConversationShareSnapshot
  sharedOn: string
}) {
  const count = snapshot.messages.length

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-12 max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-[14px] font-semibold text-foreground">
            <ZenquantaLogo className="size-5 rounded" />
            Zenquanta AI
          </Link>
          <span className="text-[12px] text-muted-foreground">Read-only</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-8 pb-16 sm:px-6">
        <div className="mb-8 border-b border-border pb-6">
          <p className="text-[12.5px] text-muted-foreground">
            Shared from Zenquanta AI on {sharedOn}
          </p>
          <h1 className="mt-1.5 text-xl font-semibold tracking-[-0.01em] [overflow-wrap:anywhere] text-foreground">
            {snapshot.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
            {snapshot.surface === 'cli' ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-0.5">
                <SquareTerminal className="size-3.5" aria-hidden />
                Terminal session
              </span>
            ) : null}
            <span>
              {count} {count === 1 ? 'message' : 'messages'}
            </span>
            <span aria-hidden>·</span>
            <span>A snapshot. Newer messages stay private.</span>
          </div>
        </div>

        {snapshot.messages.map((message, index) =>
          message.role === 'user' ? (
            <UserMessage key={index} message={message} />
          ) : (
            <AssistantMessage key={index} message={message} />
          )
        )}

        <ContinueSharedChat token={token} />
      </main>
    </div>
  )
}
