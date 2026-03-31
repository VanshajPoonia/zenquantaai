'use client'

import { useState } from 'react'
import { useChatContext } from '@/lib/chat-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ZenquantaLogo } from '@/components/icons'

export function AuthGate() {
  const { requestMagicLink, authError } = useChatContext()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>(
    'idle'
  )
  const [message, setMessage] = useState('')

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
              Sign in with a magic link
            </h1>
          </div>
        </div>

        <p className="mb-6 text-sm leading-7 text-muted-foreground">
          Keep your chats, projects, prompts, and uploads synced to your account.
          Enter your email and we&apos;ll send you a secure sign-in link.
        </p>

        <div className="space-y-4">
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="h-12 rounded-2xl"
            disabled={status === 'sending'}
          />
          <Button
            className="h-12 w-full rounded-2xl"
            disabled={!email.trim() || status === 'sending'}
            onClick={async () => {
              setStatus('sending')
              setMessage('')

              try {
                await requestMagicLink(email.trim())
                setStatus('sent')
                setMessage('Check your inbox for the sign-in link.')
              } catch (error) {
                setStatus('error')
                setMessage(
                  error instanceof Error
                    ? error.message
                    : 'Unable to send the magic link right now.'
                )
              }
            }}
          >
            {status === 'sending' ? 'Sending link…' : 'Email me a magic link'}
          </Button>
        </div>

        {(message || authError) && (
          <div className="mt-4 rounded-2xl border border-border/70 bg-background/60 px-4 py-3 text-sm text-muted-foreground">
            {message || authError}
          </div>
        )}
      </div>
    </div>
  )
}
