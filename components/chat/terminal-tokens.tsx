'use client'

import { useCallback, useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'

interface TerminalToken {
  id: string
  name: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
  expiresAt: string
}

function ago(value: string | null): string {
  return value ? formatDistanceToNow(new Date(value), { addSuffix: true }) : 'never'
}

/** Install steps for zq plus the signed-in user's zq tokens, each revocable. */
export function TerminalTokens() {
  const [tokens, setTokens] = useState<TerminalToken[] | null>(null)
  const [error, setError] = useState('')
  const [revoking, setRevoking] = useState<string | null>(null)

  const load = useCallback(async () => {
    const response = await fetch('/api/cli/tokens', { cache: 'no-store' })
    const body = (await response.json().catch(() => null)) as { tokens?: TerminalToken[]; error?: string } | null
    if (!response.ok) {
      setError(body?.error ?? 'Could not load terminal sign-ins.')
      setTokens([])
      return
    }
    setTokens(body?.tokens ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function revoke(id: string) {
    setRevoking(id)
    const response = await fetch(`/api/cli/tokens/${id}`, { method: 'DELETE' })
    setRevoking(null)
    if (!response.ok) {
      setError('Could not revoke that sign-in.')
      return
    }
    setTokens((current) => current?.filter((token) => token.id !== id) ?? null)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-white/[0.02] p-3 text-[13px] text-muted-foreground">
        <p className="mb-2 text-foreground/85">Use Forge in your terminal with zq. It needs Node.js 22.19 or newer.</p>
        <pre className="overflow-x-auto font-mono text-[12px] leading-6 text-foreground/85">
          npm install -g zenquanta{'\n'}zq login
        </pre>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-foreground">Signed-in terminals</p>
        {tokens === null ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : tokens.length === 0 ? (
          <p className="text-sm text-muted-foreground">No terminals are signed in.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {tokens.map((token) => (
              <li key={token.id} className="flex items-center gap-3 px-3 py-2 text-[13px]">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-foreground/90">{token.name}</p>
                  <p className="truncate text-muted-foreground">
                    zq_{token.prefix}... · used {ago(token.lastUsedAt)} · expires {ago(token.expiresAt)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 shrink-0 rounded-full px-3 text-xs"
                  disabled={revoking === token.id}
                  onClick={() => void revoke(token.id)}
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      </div>
    </div>
  )
}
