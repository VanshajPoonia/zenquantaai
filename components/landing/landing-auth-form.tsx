'use client'

import { FormEvent, RefObject, useEffect, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useChatContext } from '@/lib/chat-context'
import { cn } from '@/lib/utils'
import styles from './landing.module.css'

const ADMIN_CONTACT_EMAIL = 'zqai@vanshajpoonia.com'

export type AuthMode = 'sign-up' | 'sign-in'

export function LandingAuthForm({
  mode,
  onModeChange,
  identifierRef,
}: {
  mode: AuthMode
  onModeChange: (mode: AuthMode) => void
  identifierRef: RefObject<HTMLInputElement | null>
}) {
  const { requestPasswordSignIn, requestPasswordSignUp, authError } = useChatContext()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('accountDeleted') === '1') {
      setMessage('Your account was deleted and you have been signed out.')
    }
  }, [])

  const isSignUp = mode === 'sign-up'
  const submitting = status === 'submitting'
  const trimmedIdentifier = identifier.trim()
  const validationMessage =
    isSignUp && password && password.length < 8
      ? 'Use at least 8 characters for the password.'
      : isSignUp && confirmPassword && password !== confirmPassword
        ? 'The two passwords do not match.'
        : ''
  const canSubmit =
    Boolean(trimmedIdentifier) &&
    Boolean(password.trim()) &&
    !submitting &&
    (!isSignUp || (!validationMessage && Boolean(confirmPassword.trim())))
  const visibleAuthError = submitting ? null : authError
  const feedback = validationMessage || message || visibleAuthError
  const isError = Boolean(validationMessage) || status === 'error' || Boolean(visibleAuthError)

  function switchMode(next: AuthMode) {
    onModeChange(next)
    setStatus('idle')
    setMessage('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return

    setStatus('submitting')
    setMessage('')

    try {
      if (isSignUp) {
        const result = await requestPasswordSignUp(trimmedIdentifier, password)
        setMessage(result)
      } else {
        await requestPasswordSignIn(trimmedIdentifier, password)
      }
      setStatus('done')
    } catch (error) {
      setStatus('error')
      setMessage(
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : isSignUp
            ? 'Could not create the account right now. Try again in a moment.'
            : 'Could not sign in right now. Try again in a moment.'
      )
    }
  }

  return (
    <div className={cn(styles.formCard, 'w-full p-6 sm:p-8')}>
      <div className={cn(styles.segmented, 'grid grid-cols-2 gap-1 p-1 text-[13.5px] font-medium')}>
        <button
          type="button"
          aria-pressed={isSignUp}
          className="h-9"
          onClick={() => switchMode('sign-up')}
        >
          Create account
        </button>
        <button
          type="button"
          aria-pressed={!isSignUp}
          className="h-9"
          onClick={() => switchMode('sign-in')}
        >
          Sign in
        </button>
      </div>

      <form className="mt-7 space-y-5" onSubmit={handleSubmit} noValidate>
        <div>
          <label htmlFor="landing-identifier" className="mb-2 block text-[13.5px] font-medium">
            {isSignUp ? 'Pick a Zenquanta ID' : 'Your Zenquanta ID'}
          </label>
          <input
            ref={identifierRef}
            id="landing-identifier"
            name="username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder={isSignUp ? 'e.g. sam.rivera' : 'Enter your ID'}
            className={styles.field}
            disabled={submitting}
            aria-describedby="landing-identifier-hint"
          />
          <p id="landing-identifier-hint" className="mt-2 text-[12.5px] leading-5 text-[var(--text-3)]">
            {isSignUp
              ? '3 to 32 characters: letters, numbers, dots, dashes or underscores.'
              : 'The ID you picked when you signed up.'}
          </p>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label htmlFor="landing-password" className="block text-[13.5px] font-medium">
              Password
            </label>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12.5px] text-[var(--text-2)] transition-colors hover:text-[var(--text)]"
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <input
            id="landing-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={isSignUp ? 'At least 8 characters' : 'Enter your password'}
            className={styles.field}
            disabled={submitting}
          />
        </div>

        {isSignUp && (
          <div>
            <label htmlFor="landing-confirm" className="mb-2 block text-[13.5px] font-medium">
              Password again
            </label>
            <input
              id="landing-confirm"
              name="confirm-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Type it once more"
              className={styles.field}
              disabled={submitting}
            />
          </div>
        )}

        <button type="submit" className={cn(styles.buttonPrimary, 'mt-2 w-full')} disabled={!canSubmit}>
          {submitting
            ? isSignUp
              ? 'Creating your account…'
              : 'Signing in…'
            : isSignUp
              ? 'Create my free account'
              : 'Sign in'}
        </button>

        {feedback && (
          <p
            role={isError ? 'alert' : 'status'}
            className={cn(
              'rounded-xl px-4 py-3 text-[13.5px] leading-6',
              isError
                ? 'bg-[oklch(0.3_0.09_25_/_0.45)] text-[oklch(0.86_0.08_25)] shadow-[inset_0_0_0_1px_oklch(0.6_0.15_25_/_0.35)]'
                : 'bg-white/[0.05] text-[var(--text)] shadow-[inset_0_0_0_1px_var(--line)]'
            )}
          >
            {feedback}
          </p>
        )}
      </form>

      <p className="mt-6 text-[12.5px] leading-5 text-[var(--text-3)]">
        Locked out or stuck?{' '}
        <a
          href={`mailto:${ADMIN_CONTACT_EMAIL}?subject=Zenquanta%20AI%20sign-in%20help`}
          className={styles.textLink}
        >
          Email the admin
        </a>
      </p>
    </div>
  )
}
