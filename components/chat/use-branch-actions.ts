'use client'

import { useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { useChatContext } from '@/lib/chat-context'
import type { AIMode, Message } from '@/types'

interface BranchResult {
  id: string
  title: string
  mode: AIMode
}

/** Branch actions for the open chat. Each one opens the new chat when it is ready. */
export function useBranchActions() {
  const { currentChat, isStreaming, openConversation, prefillComposerText } = useChatContext()
  const busyRef = useRef(false)

  const branch = useCallback(
    async (messageId: string, before: boolean): Promise<BranchResult | null> => {
      if (!currentChat || busyRef.current) return null
      if (isStreaming) {
        toast.error('Wait for the reply to finish, then branch.')
        return null
      }

      busyRef.current = true
      try {
        const response = await fetch(
          `/api/conversations/${encodeURIComponent(currentChat.id)}/branch`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageId, before }),
          }
        )
        const body = (await response.json().catch(() => null)) as
          | { conversation?: BranchResult; error?: string }
          | null
        if (!response.ok || !body?.conversation) {
          toast.error(body?.error ?? 'Could not branch this chat. Please try again.')
          return null
        }

        const opened = await openConversation(body.conversation.id)
        if (!opened) {
          toast.error('The branch was made but did not open. Find it in your chat list.')
          return null
        }
        return body.conversation
      } catch {
        toast.error('Could not branch this chat. Check your connection.')
        return null
      } finally {
        busyRef.current = false
      }
    },
    [currentChat, isStreaming, openConversation]
  )

  const branchFromMessage = useCallback(
    async (message: Message) => {
      if (await branch(message.id, false)) toast.success('Branch opened. The original chat is unchanged.')
    },
    [branch]
  )

  // Branches just before an earlier message and puts its text back in the composer.
  const editInBranch = useCallback(
    async (message: Message) => {
      if (!(await branch(message.id, true))) return
      prefillComposerText(message.content, message.mode)
      toast.success('Branch opened. Edit the message and send it.')
    },
    [branch, prefillComposerText]
  )

  return { branchFromMessage, editInBranch }
}
