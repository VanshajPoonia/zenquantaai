'use client'

import Link from 'next/link'
import { useEffect, useState, type FormEvent } from 'react'
import { ZenquantaLogo } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Stage =
  | 'loading'
  | 'signed-out'
  | 'confirm'
  | 'submitting'
  | 'approved'
  | 'denied'
  | 'error'

function formatCode(value: string): string {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
  return compact.length > 4 ? `${compact.slice(0, 4)}-${compact.slice(4)}` : compact
}

export default function CliAuthorizePage() {
  const [stage, setStage] = useState<Stage>('loading')
  const [code, setCode] = useState('')
  const [loginId, setLoginId] = useState<string | null>(null)
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    setCode(formatCode(new URLSearchParams(window.location.search).get('code') ?? ''))
    void fetch('/api/auth/session', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return setStage('signed-out')
        const body = (await response.json().catch(() => null)) as {
          user?: { loginId?: string | null }
        } | null
        setLoginId(body?.user?.loginId ?? null)
        setStage('confirm')
      })
      .catch(() => setStage('signed-out'))
  }, [])

  async function signIn(event: FormEvent) {
    event.preventDefault()
    setMessage('')
    const response = await fetch('/api/auth/password/sign-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    })
    const body = (await response.json().catch(() => null)) as {
      error?: string
      user?: { loginId?: string | null }
    } | null
    if (!response.ok) {
      setMessage(body?.error ?? 'Sign-in failed.')
      return
    }
    setLoginId(body?.user?.loginId ?? identifier)
    setPassword('')
    setStage('confirm')
  }

  async function decide(approve: boolean) {
    setStage('submitting')
    setMessage('')
    const response = await fetch('/api/cli/device/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userCode: code, approve }),
    })
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    if (!response.ok) {
      setMessage(body?.error ?? 'Something went wrong. Run `zq login` again.')
      setStage('error')
      return
    }
    setStage(approve ? 'approved' : 'denied')
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card/70 p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <ZenquantaLogo className="size-10" />
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Zenquanta AI
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Sign in to zq
            </h1>
          </div>
        </div>

        {stage === 'loading' ? <p className="text-sm text-muted-foreground">Checking your session...</p> : null}

        {stage === 'signed-out' ? (
          <form className="space-y-3" onSubmit={signIn}>
            <p className="text-sm text-muted-foreground">
              Sign in with your Zenquanta ID to connect the terminal.
            </p>
            <Input
              autoComplete="username"
              placeholder="Zenquanta ID"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
            />
            <Input
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {message ? <p className="text-sm text-destructive">{message}</p> : null}
            <Button type="submit" className="w-full" disabled={!identifier || !password}>
              Sign in
            </Button>
            <p className="text-xs text-muted-foreground">
              No account yet? <Link className="underline" href="/">Create one</Link>, then run
              {' '}<code>zq login</code> again.
            </p>
          </form>
        ) : null}

        {stage === 'confirm' || stage === 'submitting' ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Check that this code matches the one in your terminal. Approving lets zq use
              {loginId ? <> the account <span className="text-foreground">{loginId}</span></> : ' your account'}
              {' '}and its plan.
            </p>
            <p className="text-sm text-muted-foreground">
              Only approve a code you started yourself with <code>zq login</code> in the last few
              minutes. Never approve a code someone sent you.
            </p>
            <Input
              aria-label="Login code"
              className="text-center font-mono text-lg tracking-[0.3em]"
              value={code}
              onChange={(event) => setCode(formatCode(event.target.value))}
              placeholder="ABCD-EFGH"
            />
            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={code.length !== 9 || stage === 'submitting'}
                onClick={() => void decide(true)}
              >
                Approve
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                disabled={code.length !== 9 || stage === 'submitting'}
                onClick={() => void decide(false)}
              >
                Deny
              </Button>
            </div>
          </div>
        ) : null}

        {stage === 'approved' ? (
          <p className="text-sm text-foreground">
            zq is connected. You can close this tab and go back to your terminal.
          </p>
        ) : null}
        {stage === 'denied' ? (
          <p className="text-sm text-muted-foreground">Denied. zq was not connected.</p>
        ) : null}
        {stage === 'error' ? <p className="text-sm text-destructive">{message}</p> : null}
      </div>
    </div>
  )
}
