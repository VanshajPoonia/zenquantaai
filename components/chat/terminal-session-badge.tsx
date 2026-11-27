'use client'

import { SquareTerminal } from 'lucide-react'
import { useHasPendingApproval } from '@/hooks/use-cli-approvals'
import type { ConversationSummary } from '@/types'

/** The terminal icon on a zq session row, with an amber dot while zq waits for an answer. */
export function TerminalSessionBadge({ chat }: { chat: ConversationSummary }) {
  const waiting = useHasPendingApproval(chat.id)
  const label = `zq session${chat.workspace?.repo ? ` in ${chat.workspace.repo}` : ''}${waiting ? ', waiting for your answer' : ''}`

  return (
    <span role="img" aria-label={label} className="relative flex shrink-0">
      <SquareTerminal aria-hidden className="size-3 text-sidebar-foreground/40" />
      {waiting ? (
        <span aria-hidden className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-amber-400 ring-1 ring-sidebar" />
      ) : null}
    </span>
  )
}
