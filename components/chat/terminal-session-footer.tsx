'use client'

import { useEffect, useState } from 'react'
import { useChatContext } from '@/lib/chat-context'
import { formatLastUpdate } from '@/lib/cli/live-session'
import { useLiveCliSession } from '@/hooks/use-live-cli-session'
import type { Conversation } from '@/types'
import { TerminalApprovals } from './terminal-approvals'

function LivePill() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[12px] font-medium text-emerald-300">
      <span aria-hidden className="relative flex size-1.5">
        <span className="absolute inline-flex size-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
        <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
      </span>
      Live
    </span>
  )
}

/** The read-only footer of a zq session: live status and how to continue in the terminal. */
export function TerminalSessionFooter({ chat }: { chat: Conversation }) {
  const { applyLiveMessages } = useChatContext()
  const { isLive, lastActivityAt } = useLiveCliSession(chat, applyLiveMessages)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (isLive || lastActivityAt === null) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [isLive, lastActivityAt])

  const repo = chat.workspace?.repo ? ` in ${chat.workspace.repo}` : ''

  return (
    <div className="border-t border-border px-4 py-3 text-center text-[13px] text-muted-foreground">
      <TerminalApprovals conversationId={chat.id} />
      <p aria-live="polite" className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        {isLive ? <LivePill /> : null}
        {!isLive && lastActivityAt !== null ? (
          <span className="text-muted-foreground/80">{formatLastUpdate(now - lastActivityAt)}.</span>
        ) : null}
        <span>
          {isLive ? `This session is running in zq on your computer${repo}.` : `This session ran in zq on your computer${repo}.`}{' '}
          Continue it there with{' '}
          <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-foreground/85">zq -r</code>.
        </span>
      </p>
    </div>
  )
}
