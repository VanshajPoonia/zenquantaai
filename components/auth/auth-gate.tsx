'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import { Eye, EyeOff, LifeBuoy } from 'lucide-react'
import { useChatContext } from '@/lib/chat-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ZenquantaLogo } from '@/components/icons'

const ADMIN_CONTACT_EMAIL = 'zqai@vanshajpoonia.com'

export function AuthGate() {
  const {
    requestPasswordSignIn,
    requestPasswordSignUp,
    authError,
  } = useChatContext()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordMode, setPasswordMode] = useState<'sign-in' | 'sign-up'>(
    'sign-in'
  )
  const [status, setStatus] = useState<
    'idle' | 'submitting' | 'signed-in' | 'error'
  >('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)

    if (searchParams.get('accountDeleted') === '1') {
      setMessage('Your account was deleted and you have been signed out.')
    }
  }, [])

  function toAuthErrorMessage(error: unknown, fallback: string): string {
    if (!(error instanceof Error)) return fallback

    const message = error.message.trim()

    return message || fallback
  }

  const trimmedIdentifier = identifier.trim()
  const identifierHint =
    passwordMode === 'sign-in'
      ? 'Use the ID you created during signup. Example: vanshaj, zenquanta.dev, vanshaj_01'
      : 'Pick a unique ID with 3-32 characters. You can use letters, numbers, dots, underscores, and dashes.'
  const validationMessage =
    passwordMode === 'sign-up' && password && password.length < 8
      ? 'Use at least 8 characters for the password.'
      : passwordMode === 'sign-up' &&
          confirmPassword &&
          password !== confirmPassword
        ? 'Passwords do not match.'
        : ''
  const canSubmit =
    Boolean(trimmedIdentifier) &&
    Boolean(password.trim()) &&
    status !== 'submitting' &&
    (!validationMessage || passwordMode === 'sign-in') &&
    (passwordMode === 'sign-in' || Boolean(confirmPassword.trim()))
  // A stale session error should not linger while a new attempt is running.
  const visibleAuthError = status === 'submitting' ? null : authError
  const feedbackTone =
    validationMessage || status === 'error' || visibleAuthError
      ? 'error'
      : message
        ? 'success'
        : 'neutral'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return

    setStatus('submitting')
    setMessage('')

    try {
      if (passwordMode === 'sign-in') {
        await requestPasswordSignIn(identifier.trim(), password)
        setStatus('signed-in')
      } else {
        const nextMessage = await requestPasswordSignUp(identifier.trim(), password)
        setStatus('signed-in')
        setMessage(nextMessage)
      }
    } catch (error) {
      setStatus('error')
      setMessage(
        toAuthErrorMessage(
          error,
          passwordMode === 'sign-in'
            ? 'Unable to sign in right now.'
            : 'Unable to create the account right now.'
        )
      )
    }
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-y-auto bg-background px-6 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-1/2 h-80 w-[min(40rem,100%)] -translate-x-1/2 bg-[radial-gradient(closest-side,oklch(0.68_0.13_275_/_0.14),transparent)] blur-2xl"
      />

      <div className="animate-arrive relative w-full max-w-md rounded-2xl border border-white/[0.09] bg-card/80 p-8 shadow-[inset_0_1px_0_rgb(255_255_255_/_0.05),0_40px_90px_-40px_rgb(0_0_0_/_0.95)]">
        <div className="mb-8 flex items-center gap-2.5">
          <ZenquantaLogo className="size-8 rounded-lg" />
          <p className="text-[14px] font-semibold tracking-[-0.01em] text-foreground">Zenquanta AI</p>
        </div>

        <h1 className="font-display text-[1.9rem] leading-tight text-foreground">
          Six assistants. One workspace.
        </h1>

        <p className="mb-6 mt-3 text-sm leading-7 text-muted-foreground">
          Keep your chats, projects, prompts, and uploads synced to your
          account. Use your Zenquanta ID and password to access the workspace.
        </p>

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-2 gap-1 rounded-full border border-border/60 bg-background/60 p-1">
            <Button
              type="button"
              variant={passwordMode === 'sign-in' ? 'cta' : 'ghost'}
              className="rounded-full"
              onClick={() => setPasswordMode('sign-in')}
            >
              Sign in
            </Button>
            <Button
              type="button"
              variant={passwordMode === 'sign-up' ? 'cta' : 'ghost'}
              className="rounded-full"
              onClick={() => setPasswordMode('sign-up')}
            >
              Create account
            </Button>
          </div>

          <label htmlFor="auth-identifier" className="sr-only">
            Zenquanta ID
          </label>
          <Input
            id="auth-identifier"
            name="username"
            type="text"
            autoComplete="username"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder={
              passwordMode === 'sign-in' ? 'Enter your ID' : 'Choose your ID'
            }
            className="h-12 rounded-xl"
            disabled={status === 'submitting'}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <div className="border-t border-border/60 px-1 py-3 text-xs leading-6 text-muted-foreground">
            <p className="eyebrow mb-1">ID guide</p>
            <p>{identifierHint}</p>
          </div>

          <label htmlFor="auth-password" className="sr-only">
            Password
          </label>
          <Input
            id="auth-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete={passwordMode === 'sign-in' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={
              passwordMode === 'sign-in' ? 'Enter your password' : 'Create a password'
            }
            className="h-12 rounded-xl"
            disabled={status === 'submitting'}
          />

          {passwordMode === 'sign-up' && (
            <>
              <label htmlFor="auth-confirm-password" className="sr-only">
                Confirm password
              </label>
              <Input
                id="auth-confirm-password"
                name="confirm-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Confirm your password"
                className="h-12 rounded-xl"
                disabled={status === 'submitting'}
              />
            </>
          )}

          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full px-2 py-1 transition-colors hover:text-foreground"
              onClick={() => setShowPassword((previous) => !previous)}
            >
              {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              <span>{showPassword ? 'Hide password' : 'Show password'}</span>
            </button>

            <Button asChild variant="link" className="h-auto px-0 text-xs text-muted-foreground">
              <Link
                href={`mailto:${ADMIN_CONTACT_EMAIL}?subject=Zenquanta%20AI%20auth%20help`}
              >
                <LifeBuoy className="size-3.5" />
                Contact admin
              </Link>
            </Button>
          </div>

          <Button
            type="submit"
            variant="cta"
            className="h-12 w-full text-base"
            disabled={!canSubmit}
          >
            {status === 'submitting'
              ? passwordMode === 'sign-in'
                ? 'Signing in…'
                : 'Creating account…'
              : passwordMode === 'sign-in'
                ? 'Sign in'
                : 'Create account'}
          </Button>
        </form>

        {(validationMessage || message || visibleAuthError) && (
          <div
            role={feedbackTone === 'error' ? 'alert' : 'status'}
            className={
              feedbackTone === 'error'
                ? 'mt-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive'
                : feedbackTone === 'success'
                  ? 'mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200'
                  : 'mt-4 rounded-2xl border border-border/70 bg-background/60 px-4 py-3 text-sm text-muted-foreground'
            }
          >
            {validationMessage || message || visibleAuthError}
          </div>
        )}
      </div>
    </div>
  )
}
