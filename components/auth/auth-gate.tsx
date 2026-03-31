'use client'

import { useState } from 'react'
import { useChatContext } from '@/lib/chat-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ZenquantaLogo } from '@/components/icons'

export function AuthGate() {
  const {
    requestPasswordSignIn,
    requestPasswordSignUp,
    authError,
  } = useChatContext()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [passwordMode, setPasswordMode] = useState<'sign-in' | 'sign-up'>(
    'sign-in'
  )
  const [status, setStatus] = useState<
    'idle' | 'submitting' | 'signed-in' | 'error'
  >('idle')
  const [message, setMessage] = useState('')

  function toAuthErrorMessage(error: unknown, fallback: string): string {
    if (!(error instanceof Error)) return fallback

    const message = error.message.trim()

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
          Keep your chats, projects, prompts, and uploads synced to your
          account. Use a simple ID and password for now while we keep the rest of
          the Zenquanta workspace connected to Supabase in the background.
        </p>

        <div className="space-y-4">
          <Input
            type="text"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="Choose an ID"
            className="h-12 rounded-2xl"
            disabled={status === 'submitting'}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />

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
            disabled={status === 'submitting'}
          />

          <Button
            className="h-12 w-full rounded-2xl"
            disabled={
              !identifier.trim() || !password.trim() || status === 'submitting'
            }
            onClick={async () => {
              setStatus('submitting')
              setMessage('')

              try {
                if (passwordMode === 'sign-in') {
                  await requestPasswordSignIn(identifier.trim(), password)
                  setStatus('signed-in')
                } else {
                  const nextMessage = await requestPasswordSignUp(
                    identifier.trim(),
                    password
                  )
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
            }}
          >
            {status === 'submitting'
              ? passwordMode === 'sign-in'
                ? 'Signing in…'
                : 'Creating account…'
              : passwordMode === 'sign-in'
                ? 'Sign in'
                : 'Create account'}
          </Button>
        </div>

        <p className="mt-4 text-xs leading-6 text-muted-foreground">
          IDs can use letters, numbers, dots, underscores, and dashes.
        </p>

        {(message || authError) && (
          <div className="mt-4 rounded-2xl border border-border/70 bg-background/60 px-4 py-3 text-sm text-muted-foreground">
            {message || authError}
          </div>
        )}
      </div>
    </div>
  )
}
