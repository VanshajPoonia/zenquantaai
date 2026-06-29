'use client'

import { useState } from 'react'
import { KeyRound, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function UserPasswordResetCard({ targetUserId }: { targetUserId: string }) {
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)

  const validationError =
    password && password.length < 8 ? 'Password must be at least 8 characters.' : ''

  const submit = async () => {
    setStatus('submitting')
    setError(null)
    try {
      const response = await fetch(`/api/admin/users/${targetUserId}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const body = (await response.json().catch(() => ({}))) as {
        message?: string
        error?: string
      }
      if (!response.ok) {
        throw new Error(body.error ?? 'Unable to update password.')
      }
      setStatus('done')
      setPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update password.')
      setStatus('idle')
    }
  }

  return (
    <Card className="rounded-3xl border-border/70 bg-card/70">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-5 text-muted-foreground" />
            Reset password
          </CardTitle>
          <Badge variant="secondary" className="rounded-full">
            Admin-only
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-muted-foreground">
          Set a new password for this user if they&apos;re locked out. This signs
          them out of every existing session — share the new password through a
          secure channel and ask them to sign in and change it.
        </p>

        <div className="space-y-2">
          <Label htmlFor="admin-set-password">New password</Label>
          <Input
            id="admin-set-password"
            type="password"
            autoComplete="off"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              setStatus('idle')
            }}
            className="rounded-xl"
            disabled={status === 'submitting'}
          />
        </div>

        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          disabled={status === 'submitting' || !password || Boolean(validationError)}
          onClick={() => void submit()}
        >
          {status === 'submitting' ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <KeyRound className="mr-2 size-4" />
          )}
          Set new password
        </Button>

        {status === 'done' ? (
          <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
            Password updated. The user&apos;s existing sessions were signed out.
          </p>
        ) : null}

        {validationError ? (
          <p className="text-xs text-muted-foreground">{validationError}</p>
        ) : null}

        {error ? (
          <p className="rounded-xl border border-destructive/35 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
