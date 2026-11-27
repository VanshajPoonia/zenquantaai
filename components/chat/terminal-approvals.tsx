'use client'

import { useEffect, useState } from 'react'
import { useChatContext } from '@/lib/chat-context'
import { approvalTimeLeftMs, formatTimeLeft, type PendingCliApproval } from '@/lib/cli/approvals'
import { decideCliApproval, useCliApprovals } from '@/hooks/use-cli-approvals'
import { Button } from '@/components/ui/button'

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}

function ApprovalCard({ approval, serverOffsetMs }: { approval: PendingCliApproval; serverOffsetMs: number }) {
  const now = useNow(1_000)
  const [sending, setSending] = useState<'approve' | 'deny' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const left = approvalTimeLeftMs(approval.expiresAt, serverOffsetMs, now)
  const expired = left <= 0

  const answer = async (decision: 'approve' | 'deny') => {
    setSending(decision)
    setError(null)
    const result = await decideCliApproval(approval.id, decision)
    if (!result.ok) {
      setError(result.message)
      setSending(null)
    }
  }

  return (
    <section
      aria-labelledby={`approval-${approval.id}`}
      className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-3 text-left"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 id={`approval-${approval.id}`} className="text-[13px] font-medium text-amber-100">
          {approval.title}
        </h3>
        <span className="shrink-0 text-[12px] tabular-nums text-amber-100/70">{formatTimeLeft(left)}</span>
      </div>
      <p className="mt-0.5 text-[12px] text-muted-foreground">
        zq wants to use <code className="text-foreground/80">{approval.tool}</code>. It is asking in the
        terminal too, and the first answer counts.
      </p>
      <pre className="mt-2 max-h-48 overflow-auto rounded-md border border-white/[0.06] bg-black/40 p-2 font-mono text-[12px] leading-relaxed whitespace-pre-wrap break-all text-foreground/90">
        <code>{approval.detail}</code>
      </pre>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => void answer('approve')} disabled={expired || sending !== null}>
          {sending === 'approve' ? 'Approving...' : 'Approve once'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void answer('deny')}
          disabled={expired || sending !== null}
        >
          {sending === 'deny' ? 'Denying...' : 'Deny'}
        </Button>
        {expired ? (
          <span className="text-[12px] text-muted-foreground">Expired. Answer it in the terminal.</span>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-[12px] text-red-300">
          {error}
        </p>
      ) : null}
    </section>
  )
}

/** Pending zq prompts for one session, shown above its footer. */
export function TerminalApprovals({ conversationId }: { conversationId: string }) {
  const { approvals, serverOffsetMs } = useCliApprovals()
  const mine = approvals.filter((approval) => approval.conversationId === conversationId)
  if (mine.length === 0) return null

  return (
    <div className="mx-auto mb-3 w-full max-w-3xl space-y-2">
      {mine.map((approval) => (
        <ApprovalCard key={approval.id} approval={approval} serverOffsetMs={serverOffsetMs} />
      ))}
    </div>
  )
}

/** Points to a waiting zq session from anywhere else, since the sidebar is closed on phones. */
export function PendingApprovalsNotice() {
  const { approvals } = useCliApprovals()
  const { currentChat, chats, openConversation } = useChatContext()
  const elsewhere = approvals.find((approval) => approval.conversationId !== currentChat?.id)
  if (!elsewhere) return null

  const title = chats.find((chat) => chat.id === elsewhere.conversationId)?.title
  return (
    <div
      role="status"
      className="fixed inset-x-4 top-14 z-40 mx-auto flex max-w-md items-center gap-3 rounded-lg border border-amber-500/30 bg-[#17140d]/95 px-3 py-2 text-[13px] text-amber-100 shadow-lg backdrop-blur"
    >
      <span aria-hidden className="size-2 shrink-0 rounded-full bg-amber-400" />
      <span className="min-w-0 flex-1 truncate">
        zq is waiting for your answer{title ? ` in ${title}` : ''}.
      </span>
      <Button
        size="sm"
        variant="outline"
        className="h-7 shrink-0"
        onClick={() => void openConversation(elsewhere.conversationId)}
      >
        Open
      </Button>
    </div>
  )
}
