'use client'

import { useEffect, useMemo, useState } from 'react'
import { useChatContext } from '@/lib/chat-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ZenquantaLogo } from '@/components/icons'

export function AuthGate() {
  const {
    requestMagicLink,
    requestPasswordSignIn,
    requestPasswordSignUp,
    requestPasswordReset,
    authError,
  } = useChatContext()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authMethod, setAuthMethod] = useState<'magic-link' | 'password'>(
    'magic-link'
  )
  const [passwordMode, setPasswordMode] = useState<'sign-in' | 'sign-up'>(
    'sign-in'
  )
  const [status, setStatus] = useState<
    | 'idle'
    | 'sending'
    | 'sent'
    | 'signing-in'
    | 'signed-in'
    | 'resetting'
    | 'error'
  >('idle')
  const [message, setMessage] = useState('')
  const [magicLinkCooldownUntil, setMagicLinkCooldownUntil] = useState<number | null>(
    null
  )
  const [resetCooldownUntil, setResetCooldownUntil] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!magicLinkCooldownUntil && !resetCooldownUntil) return

    const timer = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [magicLinkCooldownUntil, resetCooldownUntil])

  const magicLinkCooldownRemaining = useMemo(() => {
    if (!magicLinkCooldownUntil) return 0
    return Math.max(0, Math.ceil((magicLinkCooldownUntil - now) / 1000))
  }, [magicLinkCooldownUntil, now])

  const resetCooldownRemaining = useMemo(() => {
    if (!resetCooldownUntil) return 0
    return Math.max(0, Math.ceil((resetCooldownUntil - now) / 1000))
  }, [resetCooldownUntil, now])

  useEffect(() => {
    if (magicLinkCooldownUntil && magicLinkCooldownRemaining === 0) {
      setMagicLinkCooldownUntil(null)
    }
  }, [magicLinkCooldownRemaining, magicLinkCooldownUntil])

  useEffect(() => {
    if (resetCooldownUntil && resetCooldownRemaining === 0) {
      setResetCooldownUntil(null)
    }
  }, [resetCooldownRemaining, resetCooldownUntil])

  const isMagicLinkCoolingDown = magicLinkCooldownRemaining > 0
  const isResetCoolingDown = resetCooldownRemaining > 0

  function toAuthErrorMessage(error: unknown, fallback: string): string {
    if (!(error instanceof Error)) return fallback

    const message = error.message.trim()
    const normalized = message.toLowerCase()

    if (
      normalized.includes('60 seconds') ||
      normalized.includes('wait') ||
      normalized.includes('rate limit') ||
      normalized.includes('security purposes')
    ) {
      return 'Please wait about a minute before requesting another email.'
    }

    return message || fallback
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background px-6">
      <div className="w-full max-w-md rounded-[32px] border border-border/70 bg-card/70 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="mb-8 flex items-center gap-4">
          <ZenquantaLogo className="size-12" />
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">
              Zenquanta AI
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Sign in to your workspace
            </h1>
          </div>
        </div>

        <p className="mb-6 text-sm leading-7 text-muted-foreground">
          Keep your chats, projects, prompts, and uploads synced to your account.
          Use a magic link for quick access, or sign in with email and password if
          your account is already verified.
        </p>

        <Tabs
          value={authMethod}
          onValueChange={(value) =>
            setAuthMethod(value as 'magic-link' | 'password')
          }
          className="mb-4"
        >
          <TabsList className="grid w-full grid-cols-2 rounded-2xl">
            <TabsTrigger value="magic-link" className="rounded-xl">
              Magic Link
            </TabsTrigger>
            <TabsTrigger value="password" className="rounded-xl">
              Email + Password
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="space-y-4">
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="h-12 rounded-2xl"
            disabled={
              status === 'sending' ||
              status === 'signing-in' ||
              status === 'resetting'
            }
          />

          {authMethod === 'password' && (
            <>
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-background/60 p-1">
                <Button
                  type="button"
                  variant={passwordMode === 'sign-in' ? 'default' : 'ghost'}
                  className="rounded-xl"
                  onClick={() => setPasswordMode('sign-in')}
                >
                  Sign in
                </Button>
                <Button
                  type="button"
                  variant={passwordMode === 'sign-up' ? 'default' : 'ghost'}
                  className="rounded-xl"
                  onClick={() => setPasswordMode('sign-up')}
                >
                  Create account
                </Button>
              </div>

              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                className="h-12 rounded-2xl"
                disabled={
                  status === 'sending' ||
                  status === 'signing-in' ||
                  status === 'resetting'
                }
              />

              {passwordMode === 'sign-in' && (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto px-0 text-xs text-muted-foreground"
                    disabled={
                      !email.trim() ||
                      status === 'resetting' ||
                      isResetCoolingDown
                    }
                    onClick={async () => {
                      setStatus('resetting')
                      setMessage('')

                      try {
                        const nextMessage = await requestPasswordReset(
                          email.trim()
                        )
                        setResetCooldownUntil(Date.now() + 60_000)
                        setStatus('sent')
                        setMessage(nextMessage)
                      } catch (error) {
                        setStatus('error')
                        setMessage(
                          toAuthErrorMessage(
                            error,
                            'Unable to send the password reset link.'
                          )
                        )
                      }
                    }}
                  >
                    {isResetCoolingDown
                      ? `Reset link sent (${resetCooldownRemaining}s)`
                      : 'Forgot password?'}
                  </Button>
                </div>
              )}
            </>
          )}

          {authMethod === 'magic-link' ? (
            <Button
              className="h-12 w-full rounded-2xl"
              disabled={
                !email.trim() || status === 'sending' || isMagicLinkCoolingDown
              }
              onClick={async () => {
                setStatus('sending')
                setMessage('')

                try {
                  await requestMagicLink(email.trim())
                  setMagicLinkCooldownUntil(Date.now() + 60_000)
                  setStatus('sent')
                  setMessage('Check your inbox for the sign-in link.')
                } catch (error) {
                  setStatus('error')
                  setMessage(
                    toAuthErrorMessage(
                      error,
                      'Unable to send the magic link right now.'
                    )
                  )
                }
              }}
            >
              {status === 'sending'
                ? 'Sending link…'
                : isMagicLinkCoolingDown
                  ? `Magic link sent (${magicLinkCooldownRemaining}s)`
                  : 'Email me a magic link'}
            </Button>
          ) : (
            <Button
              className="h-12 w-full rounded-2xl"
              disabled={
                !email.trim() ||
                !password.trim() ||
                status === 'sending' ||
                status === 'signing-in' ||
                status === 'resetting'
              }
              onClick={async () => {
                setStatus('signing-in')
                setMessage('')

                try {
                  if (passwordMode === 'sign-in') {
                    await requestPasswordSignIn(email.trim(), password)
                    setStatus('signed-in')
                  } else {
                    const nextMessage = await requestPasswordSignUp(
                      email.trim(),
                      password
                    )
                    setStatus('sent')
                    setMessage(nextMessage)
                  }
                } catch (error) {
                  setStatus('error')
                  setMessage(
                    error instanceof Error
                      ? error.message
                      : passwordMode === 'sign-in'
                        ? 'Unable to sign in right now.'
                        : 'Unable to create the account right now.'
                  )
                }
              }}
            >
              {status === 'signing-in'
                ? passwordMode === 'sign-in'
                  ? 'Signing in…'
                  : 'Creating account…'
                : status === 'resetting'
                  ? 'Sending reset link…'
                : passwordMode === 'sign-in'
                  ? 'Sign in with password'
                  : 'Create account'}
            </Button>
          )}
        </div>

        {authMethod === 'password' && passwordMode === 'sign-up' && (
          <p className="mt-4 text-xs leading-6 text-muted-foreground">
            First-time password accounts must confirm their email from the
            verification link before password sign-in will work.
          </p>
        )}

        {(message || authError) && (
          <div className="mt-4 rounded-2xl border border-border/70 bg-background/60 px-4 py-3 text-sm text-muted-foreground">
            {message || authError}
          </div>
        )}
      </div>
    </div>
  )
}
