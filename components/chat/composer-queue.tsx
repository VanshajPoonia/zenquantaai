'use client'

import { Pause, Pencil, X } from 'lucide-react'
import { useChatContext, type QueuedPrompt } from '@/lib/chat-context'
import { MODE_CONFIGS } from '@/lib/types'
import { oneLine } from '@/lib/chat/commands'
import { queueKey } from '@/lib/chat/prompt-queue'
import { Button } from '@/components/ui/button'

// Messages queued in this chat while a reply streams, shown above the composer.
export function ComposerQueue({ onEdit }: { onEdit: (prompt: QueuedPrompt) => void }) {
  const {
    currentChat,
    currentMode,
    queuedPrompts,
    isQueuePaused,
    removeQueuedPrompt,
    takeQueuedPrompt,
    sendQueuedPromptNow,
    resumeQueue,
    clearQueue,
  } = useChatContext()
  const key = queueKey(currentChat?.id)
  const items = queuedPrompts.filter((prompt) => queueKey(prompt.conversationId) === key)

  if (items.length === 0) return null

  return (
    <section
      aria-label="Queued messages"
      className="animate-arrive mb-2 rounded-xl border border-white/[0.08] bg-card/80 p-1.5"
    >
      <div className="flex min-h-7 items-center gap-2 px-1.5">
        <p role="status" className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-muted-foreground">
          {isQueuePaused ? (
            <>
              <Pause aria-hidden className="size-3.5 shrink-0" />
              Queue paused
            </>
          ) : (
            `${items.length} queued`
          )}
        </p>
        {isQueuePaused ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 rounded-full px-2.5 text-xs"
              onClick={resumeQueue}
            >
              Resume
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 rounded-full px-2.5 text-xs text-muted-foreground"
              onClick={clearQueue}
            >
              Clear
            </Button>
          </>
        ) : null}
      </div>

      <ol className="max-h-36 overflow-y-auto">
        {items.map((prompt, index) => {
          const preview = oneLine(prompt.input.content, 120)
          const assistantName =
            prompt.mode !== currentMode ? MODE_CONFIGS[prompt.mode].name : null

          return (
            <li
              key={prompt.id}
              className="flex items-center gap-1 rounded-lg py-0.5 pl-1.5 text-[13px] hover:bg-white/[0.03]"
            >
              <span className="min-w-0 flex-1 truncate text-foreground/90">
                {assistantName ? (
                  <span className="text-muted-foreground">{assistantName}: </span>
                ) : null}
                {preview}
              </span>
              {index === 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 rounded-full px-2.5 text-xs"
                  onClick={() => sendQueuedPromptNow(prompt.id)}
                >
                  Send now
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 rounded-full text-muted-foreground"
                aria-label={`Edit queued message: ${oneLine(preview, 40)}`}
                onClick={() => {
                  const taken = takeQueuedPrompt(prompt.id)
                  if (taken) onEdit(taken)
                }}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 rounded-full text-muted-foreground"
                aria-label={`Remove queued message: ${oneLine(preview, 40)}`}
                onClick={() => removeQueuedPrompt(prompt.id)}
              >
                <X className="size-3.5" />
              </Button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
