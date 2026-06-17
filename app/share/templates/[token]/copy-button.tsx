'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Copy, Loader2 } from 'lucide-react'
import { TemplateShareType } from '@/types'

interface CopyToWorkspaceButtonProps {
  token: string
  templateType: TemplateShareType
  title: string
}

export function CopyToWorkspaceButton({
  token,
  templateType,
  title,
}: CopyToWorkspaceButtonProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  const handleCopy = async () => {
    setStatus('loading')
    try {
      const res = await fetch(`/api/share/templates/${token}/copy`, { method: 'POST' })
      if (res.status === 401) {
        window.location.href = `/?next=${encodeURIComponent(window.location.pathname)}`
        return
      }
      if (!res.ok) {
        setStatus('error')
        return
      }
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  const label =
    templateType === 'prompt' ? 'Copy prompt to my library' : 'Copy playbook to my library'

  if (status === 'done') {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-400">
        <Check className="size-4" />
        <span>
          <span className="font-medium">{title}</span> copied to your library.{' '}
          <Link href="/" className="underline hover:no-underline">
            Open workspace
          </Link>
        </span>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex items-center gap-2 text-sm text-destructive">
        <span>Something went wrong. Please try again.</span>
        <button
          type="button"
          onClick={() => setStatus('idle')}
          className="underline hover:no-underline"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      disabled={status === 'loading'}
      onClick={() => void handleCopy()}
      className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-card/60 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-card/80 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {status === 'loading' ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Copy className="size-3.5" />
      )}
      {label}
    </button>
  )
}
