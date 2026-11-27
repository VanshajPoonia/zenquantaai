'use client'

import { History } from 'lucide-react'
import { useChatContext } from '@/lib/chat-context'

export function ContinuedFromBanner() {
  const { currentChat, openConversation } = useChatContext()
  const continuedFrom = currentChat?.continuedFrom
  if (!continuedFrom) return null

  const title = continuedFrom.title.trim() || 'an earlier chat'

  return (
    <div
      role="note"
      className="border-b border-border/70 bg-white/[0.02] px-4 py-2 text-[12.5px] text-muted-foreground"
    >
      <p className="mx-auto flex max-w-3xl items-center gap-2">
        <History className="size-3.5 shrink-0" aria-hidden />
        <span className="min-w-0">
          Continued from{' '}
          <button
            type="button"
            className="font-medium text-foreground/85 underline-offset-4 [overflow-wrap:anywhere] hover:underline"
            onClick={() => void openConversation(continuedFrom.conversationId)}
          >
            {title}
          </button>
          . Zenquanta carried over a summary.
        </span>
      </p>
    </div>
  )
}
