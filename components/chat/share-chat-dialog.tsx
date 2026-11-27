'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Check, Copy, Link2, Loader2, ShieldCheck } from 'lucide-react'
import type {
  ConversationShareInfo,
  ConversationSharePreview,
  ConversationSharesResponse,
} from '@/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

function shareUrl(token: string): string {
  return `${window.location.origin}/share/c/${encodeURIComponent(token)}`
}

function formatCreated(value: string): string {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

async function readError(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? fallback
}

function describePreview(preview: ConversationSharePreview): string {
  const messages = `${preview.messageCount} ${preview.messageCount === 1 ? 'message' : 'messages'} up to now. Later messages stay private.`
  if (preview.redactionCount === 0) return messages
  const hidden =
    preview.redactionCount === 1
      ? '1 thing that looked like a key will be hidden.'
      : `${preview.redactionCount} things that looked like keys will be hidden.`
  return `${messages} ${hidden}`
}

function CopyLinkButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl(token))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy. Select the link and copy it by hand.')
    }
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className="h-8 shrink-0 gap-1.5"
      onClick={() => void copy()}
    >
      {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      {copied ? 'Copied' : 'Copy link'}
    </Button>
  )
}

export function ShareChatDialog({
  open,
  onOpenChange,
  chatId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  chatId: string
}) {
  const [data, setData] = useState<ConversationSharesResponse | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [newShareId, setNewShareId] = useState<string | null>(null)

  const base = `/api/conversations/${encodeURIComponent(chatId)}/shares`

  const load = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch(base, { cache: 'no-store' })
      if (!response.ok) {
        setError(await readError(response, 'Could not load share links.'))
        return
      }
      setData((await response.json()) as ConversationSharesResponse)
    } catch {
      setError('Could not load share links. Check your connection.')
    } finally {
      setIsLoading(false)
    }
  }, [base])

  useEffect(() => {
    if (!open) return
    setData(null)
    setNewShareId(null)
    void load()
  }, [load, open])

  const createLink = async () => {
    setIsCreating(true)
    setError('')
    try {
      const response = await fetch(base, { method: 'POST' })
      if (!response.ok) {
        setError(await readError(response, 'Could not make a link.'))
        return
      }
      const { share } = (await response.json()) as { share: ConversationShareInfo }
      setNewShareId(share.id)
      setData((previous) =>
        previous ? { ...previous, shares: [share, ...previous.shares] } : previous
      )
    } catch {
      setError('Could not make a link. Check your connection.')
    } finally {
      setIsCreating(false)
    }
  }

  const revokeLink = async (shareId: string) => {
    setRevokingId(shareId)
    setError('')
    try {
      const response = await fetch(`${base}/${encodeURIComponent(shareId)}`, { method: 'DELETE' })
      if (!response.ok) {
        setError(await readError(response, 'Could not turn off the link.'))
        return
      }
      setData((previous) =>
        previous
          ? { ...previous, shares: previous.shares.filter((share) => share.id !== shareId) }
          : previous
      )
      if (newShareId === shareId) setNewShareId(null)
      toast.success('Link turned off')
    } catch {
      setError('Could not turn off the link. Check your connection.')
    } finally {
      setRevokingId(null)
    }
  }

  const preview = data?.preview
  const newShare = data?.shares.find((share) => share.id === newShareId) ?? null
  const otherShares = data?.shares.filter((share) => share.id !== newShareId) ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share this chat</DialogTitle>
          <DialogDescription>
            Anyone with the link can read a copy of this chat as it is now. They cannot write in it.
          </DialogDescription>
        </DialogHeader>

        {isLoading && !data ? (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Checking what would be shared…
          </p>
        ) : null}

        {preview ? (
          <div className="space-y-3">
            {preview.blockedReason ? (
              <p className="rounded-lg border border-border bg-white/[0.02] px-3 py-2.5 text-sm text-muted-foreground">
                {preview.blockedReason}
              </p>
            ) : (
              <p className="flex items-start gap-2 rounded-lg border border-border bg-white/[0.02] px-3 py-2.5 text-sm text-foreground/90">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span>{describePreview(preview)}</span>
              </p>
            )}
            <p className="text-[12.5px] leading-5 text-muted-foreground">
              Files, images and memory are not included. Hiding keys is a best effort, so read the
              chat before you share it. Deleting the chat turns its links off.
            </p>

            {newShare ? (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <p className="text-[13px] font-medium text-foreground">Your new link</p>
                <input
                  readOnly
                  aria-label="Share link"
                  value={shareUrl(newShare.token)}
                  onFocus={(event) => event.currentTarget.select()}
                  className="h-8 w-full min-w-0 rounded-md border border-border bg-background px-2 font-mono text-[12px] text-foreground outline-none focus:border-foreground/30"
                />
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-destructive hover:text-destructive"
                    disabled={revokingId === newShare.id}
                    onClick={() => void revokeLink(newShare.id)}
                  >
                    {revokingId === newShare.id ? 'Turning off…' : 'Revoke'}
                  </Button>
                  <CopyLinkButton token={newShare.token} />
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="cta"
                className="h-9 gap-2 px-4"
                disabled={isCreating || Boolean(preview.blockedReason)}
                onClick={() => void createLink()}
              >
                {isCreating ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Link2 className="size-4" aria-hidden />
                )}
                {isCreating ? 'Making the link…' : 'Create link'}
              </Button>
            )}
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {otherShares.length > 0 ? (
          <div className="border-t border-border pt-3">
            <p className="mb-2 text-[13px] font-medium text-foreground">Live links</p>
            <ul className="space-y-2">
              {otherShares.map((share) => (
                <li key={share.id} className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 text-[12.5px] text-muted-foreground">
                    {formatCreated(share.createdAt)} · {share.messageCount}{' '}
                    {share.messageCount === 1 ? 'message' : 'messages'}
                  </span>
                  <CopyLinkButton token={share.token} />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-destructive hover:text-destructive"
                    disabled={revokingId === share.id}
                    onClick={() => void revokeLink(share.id)}
                  >
                    {revokingId === share.id ? 'Turning off…' : 'Revoke'}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
