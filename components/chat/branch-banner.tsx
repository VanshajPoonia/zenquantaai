'use client'

import { useEffect, useState } from 'react'
import { GitBranch } from 'lucide-react'
import { useChatContext } from '@/lib/chat-context'
import type { ConversationFork } from '@/types'

/** A slim note at the top of a branched chat. It links back only while the source chat exists. */
export function BranchBanner({ fork }: { fork: ConversationFork }) {
  const { conversations, openConversation } = useChatContext()
  const listed = conversations.find((conversation) => conversation.id === fork.conversationId)
  const [checked, setChecked] = useState<{ id: string; exists: boolean } | null>(null)

  // The sidebar list is paged, so a source that is not in it may still exist.
  useEffect(() => {
    if (listed) return
    let cancelled = false
    void fetch(`/api/conversations/${encodeURIComponent(fork.conversationId)}?messageLimit=1`, {
      cache: 'no-store',
    })
      .then((response) => {
        if (!cancelled) setChecked({ id: fork.conversationId, exists: response.ok })
      })
      .catch(() => {
        if (!cancelled) setChecked({ id: fork.conversationId, exists: false })
      })
    return () => {
      cancelled = true
    }
  }, [fork.conversationId, listed])

  const exists = Boolean(listed) || (checked?.id === fork.conversationId && checked.exists)
  const title = listed?.title ?? fork.title

  return (
    <div className="flex shrink-0 items-center justify-center gap-1.5 border-b border-border px-4 py-1.5 text-[12.5px] text-muted-foreground">
      <GitBranch className="size-3.5 shrink-0" aria-hidden />
      <span className="shrink-0">Branched from</span>
      {exists ? (
        <button
          type="button"
          onClick={() => void openConversation(fork.conversationId)}
          className="min-w-0 truncate font-medium text-foreground/85 underline decoration-white/20 underline-offset-2 hover:decoration-white/60"
        >
          {title}
        </button>
      ) : (
        <span className="min-w-0 truncate">{title}</span>
      )}
    </div>
  )
}
