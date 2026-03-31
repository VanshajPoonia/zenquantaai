'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { ZenquantaLogo } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [authParam, setAuthParam] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>(
    'idle'
  )
  const [message, setMessage] = useState('')

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    setAuthParam(searchParams.get('auth') ?? '')
  }, [])

  const authError = useMemo(() => {
    if (authParam === 'failed') {
      return 'That reset link could not be verified. Please request a new one.'
    }

    if (authParam === 'missing-token') {
      return 'The reset link was incomplete. Please request a new one.'
    }

    return ''
  }, [authParam])

  const validationError =
    password && confirmPassword && password !== confirmPassword
      ? 'Passwords do not match.'
      : password && password.length < 8
        ? 'Password must be at least 8 characters.'
        : ''

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-md rounded-[32px] border border-border/70 bg-card/70 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="mb-8 flex items-center gap-4">
          <ZenquantaLogo className="size-12" />
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">
              Zenquanta AI
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Set a new password
            </h1>
          </div>
        </div>

        <p className="mb-6 text-sm leading-7 text-muted-foreground">
          Choose a new password for your workspace. Once it is updated, you can
          sign in with your ID and password.
        </p>

        <div className="space-y-4">
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="New password"
            className="h-12 rounded-2xl"
            disabled={status === 'submitting'}
          />

          <Input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Confirm new password"
            className="h-12 rounded-2xl"
            disabled={status === 'submitting'}
          />

          <Button
            className="h-12 w-full rounded-2xl"
            disabled={
              status === 'submitting' ||
              !password.trim() ||
              !confirmPassword.trim() ||
              Boolean(validationError) ||
              Boolean(authError)
            }
            onClick={async () => {
              setStatus('submitting')
              setMessage('')

              try {
                const response = await fetch('/api/auth/password/update', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  cache: 'no-store',
                  body: JSON.stringify({ password }),
                })

                const payload = (await response.json().catch(() => null)) as
                  | { error?: string; message?: string }
                  | null

                if (!response.ok) {
                  throw new Error(
                    payload?.error ??
                      'Unable to update your password right now.'
                  )
                }

                setStatus('success')
                setMessage(
                  payload?.message ??
                    'Your password has been updated. Redirecting you back to Zenquanta AI…'
                )

                window.setTimeout(() => {
                  router.replace('/')
                }, 1000)
              } catch (error) {
                setStatus('error')
                setMessage(
                  error instanceof Error
                    ? error.message
                    : 'Unable to update your password right now.'
                )
              }
            }}
          >
            {status === 'submitting' ? 'Updating password…' : 'Save new password'}
          </Button>
        </div>

        {(authError || validationError || message) && (
          <div className="mt-4 rounded-2xl border border-border/70 bg-background/60 px-4 py-3 text-sm text-muted-foreground">
            {authError || validationError || message}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground">
          <span>Need a fresh reset link?</span>
          <Button asChild variant="link" className="h-auto px-0">
            <Link href="/">Back to sign in</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
