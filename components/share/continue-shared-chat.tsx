'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'
import { getChatPath } from '@/lib/utils/chat-path'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Stage = 'idle' | 'copying' | 'auth' | 'submitting'
type AuthMode = 'sign-up' | 'sign-in'

async function readError(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null
  return body?.error ?? fallback
}

/** Copies the shared chat for the visitor. Signed-out visitors make an account here first. */
export function ContinueSharedChat({ token }: { token: string }) {
  const [stage, setStage] = useState<Stage>('idle')
  const [mode, setMode] = useState<AuthMode>('sign-up')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')

  const copyChat = async () => {
    setStage('copying')
    setError('')
    try {
      const response = await fetch(`/api/share/conversations/${encodeURIComponent(token)}/copy`, {
        method: 'POST',
      })
      if (response.status === 401) {
        setStage('auth')
        return
      }
      if (!response.ok) {
        setError(await readError(response, 'Could not copy this chat. Please try again.'))
        setStage('idle')
        return
      }
      const body = (await response.json()) as { conversation: { id: string } }
      window.location.assign(getChatPath(body.conversation.id))
    } catch {
      setError('Could not reach Zenquanta. Check your connection and try again.')
      setStage('idle')
    }
  }

  const validation =
    mode === 'sign-up' && password && password.length < 8
      ? 'Use at least 8 characters for the password.'
      : mode === 'sign-up' && confirmPassword && password !== confirmPassword
        ? 'Passwords do not match.'
        : ''
  const canSubmit =
    stage !== 'submitting' &&
    Boolean(identifier.trim()) &&
    Boolean(password) &&
    !validation &&
    (mode === 'sign-in' || Boolean(confirmPassword))

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) return
    setStage('submitting')
    setError('')
    try {
      const response = await fetch(`/api/auth/password/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      })
      if (!response.ok) {
        setError(
          await readError(
            response,
            mode === 'sign-up' ? 'Could not create the account.' : 'Could not sign in.'
          )
        )
        setStage('auth')
        return
      }
      setPassword('')
      setConfirmPassword('')
      await copyChat()
    } catch {
      setError('Could not reach Zenquanta. Check your connection and try again.')
      setStage('auth')
    }
  }

  const showForm = stage === 'auth' || stage === 'submitting'

  return (
    <section
      aria-labelledby="continue-heading"
      className="mt-10 rounded-2xl border border-border bg-card/60 p-5 sm:p-6"
    >
      <h2 id="continue-heading" className="text-[15px] font-semibold text-foreground">
        Continue this chat in Zenquanta
      </h2>
      <p className="mt-1.5 text-[13px] leading-6 text-muted-foreground">
        You get your own copy to keep talking in. The person who shared it will not see what you
        add. Files and images do not come with it.
      </p>

      {!showForm ? (
        <Button
          type="button"
          variant="cta"
          className="mt-4 h-10 gap-2 px-5"
          disabled={stage === 'copying'}
          onClick={() => void copyChat()}
        >
          {stage === 'copying' ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <ArrowRight className="size-4" aria-hidden />
          )}
          {stage === 'copying' ? 'Copying the chat…' : 'Continue this chat in Zenquanta'}
        </Button>
      ) : (
        <form className="mt-4 space-y-3" onSubmit={(event) => void submitAuth(event)} noValidate>
          <p className="text-[13px] text-foreground">
            {mode === 'sign-up'
              ? 'Make a free account first. It takes a minute and needs no email.'
              : 'Sign in, then the chat is copied to your account.'}
          </p>
          <div>
            <label htmlFor="share-identifier" className="mb-1 block text-[12px] text-muted-foreground">
              Zenquanta ID
            </label>
            <Input
              id="share-identifier"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              disabled={stage === 'submitting'}
              className="h-10"
            />
            {mode === 'sign-up' ? (
              <p className="mt-1 text-[12px] text-muted-foreground">
                3 to 32 characters: letters, numbers, dots, underscores and dashes.
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="share-password" className="mb-1 block text-[12px] text-muted-foreground">
              Password
            </label>
            <Input
              id="share-password"
              type="password"
              autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={stage === 'submitting'}
              className="h-10"
            />
          </div>
          {mode === 'sign-up' ? (
            <div>
              <label htmlFor="share-confirm" className="mb-1 block text-[12px] text-muted-foreground">
                Confirm password
              </label>
              <Input
                id="share-confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={stage === 'submitting'}
                className="h-10"
              />
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button type="submit" variant="cta" className="h-10 px-5" disabled={!canSubmit}>
              {stage === 'submitting'
                ? 'One moment…'
                : mode === 'sign-up'
                  ? 'Create account and continue'
                  : 'Sign in and continue'}
            </Button>
            <button
              type="button"
              className="text-[13px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
              onClick={() => {
                setMode(mode === 'sign-up' ? 'sign-in' : 'sign-up')
                setError('')
              }}
            >
              {mode === 'sign-up' ? 'I already have an account' : 'Make a new account instead'}
            </button>
          </div>
          <p className="text-[12px] text-muted-foreground">
            By continuing you agree to the{' '}
            <Link href="/terms" className="underline underline-offset-4">Terms</Link> and{' '}
            <Link href="/privacy" className="underline underline-offset-4">Privacy Policy</Link>.
          </p>
        </form>
      )}

      {validation || error ? (
        <p role="alert" className="mt-3 text-[13px] text-destructive">
          {validation || error}
        </p>
      ) : null}
    </section>
  )
}
