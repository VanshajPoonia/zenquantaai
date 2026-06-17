'use client'

import { useState } from 'react'
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react'
import {
  UserPurgeCounts,
  UserPurgePreview,
  UserPurgeResult,
  UserPurgeScope,
} from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const PURGE_COUNT_LABELS: Array<{ key: keyof UserPurgeCounts; label: string }> = [
  { key: 'conversations', label: 'Conversations' },
  { key: 'projects', label: 'Projects' },
  { key: 'files', label: 'Files' },
  { key: 'generatedImages', label: 'Images' },
  { key: 'artifacts', label: 'Artifacts' },
  { key: 'prompts', label: 'Prompts' },
  { key: 'playbooks', label: 'Playbooks' },
  { key: 'customAssistants', label: 'Assistants' },
  { key: 'modelComparisons', label: 'Duels' },
  { key: 'integrations', label: 'Integrations' },
  { key: 'usageAndPlanData', label: 'Usage/plan' },
  { key: 'telemetry', label: 'Telemetry' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'objectRefs', label: 'Objects' },
]

export function UserPurgeCard({
  targetUserId,
  currentAdminUserId,
}: {
  targetUserId: string
  currentAdminUserId: string
}) {
  const isSelf = targetUserId === currentAdminUserId
  const [scope, setScope] = useState<UserPurgeScope>('full_account')
  const [preview, setPreview] = useState<UserPurgePreview | null>(null)
  const [confirmation, setConfirmation] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'purging' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<UserPurgeResult | null>(null)

  const resetForScope = (nextScope: UserPurgeScope) => {
    setScope(nextScope)
    setPreview(null)
    setConfirmation('')
    setError(null)
    setResult(null)
    setStatus('idle')
  }

  const loadPreview = async () => {
    setStatus('loading')
    setError(null)
    setResult(null)
    try {
      const response = await fetch(`/api/admin/users/${targetUserId}/purge/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope }),
      })
      const body = (await response.json().catch(() => ({}))) as {
        preview?: UserPurgePreview
        error?: string
      }
      if (!response.ok || !body.preview) {
        throw new Error(body.error ?? 'Unable to preview purge.')
      }
      setPreview(body.preview)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to preview purge.')
    } finally {
      setStatus('idle')
    }
  }

  const runPurge = async () => {
    setStatus('purging')
    setError(null)
    try {
      const response = await fetch(`/api/admin/users/${targetUserId}/purge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, confirmation }),
      })
      const body = (await response.json().catch(() => ({}))) as {
        result?: UserPurgeResult
        error?: string
      }
      if (!response.ok || !body.result) {
        throw new Error(body.error ?? 'Unable to purge user.')
      }
      setResult(body.result)
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to purge user.')
      setStatus('idle')
    }
  }

  return (
    <Card className="rounded-3xl border-destructive/40 bg-destructive/5">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-destructive" />
            User purge
          </CardTitle>
          <Badge variant="destructive" className="rounded-full">
            Admin-only
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-muted-foreground">
          Preview and purge this user&apos;s Zenquanta data. Full account purge
          removes credentials and PII while preserving scrubbed audit anchors.
        </p>

        <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
          <div className="space-y-2">
            <Label>Purge scope</Label>
            <Select
              value={scope}
              onValueChange={(value) => resetForScope(value as UserPurgeScope)}
              disabled={isSelf}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="workspace_data">Workspace data</SelectItem>
                <SelectItem value="full_account">Full account</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="self-end text-xs leading-6 text-muted-foreground">
            Admin purge is deliberately foreground-only and records safe audit
            details. Admins cannot purge their own account.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          disabled={isSelf || status === 'loading' || status === 'purging'}
          onClick={() => void loadPreview()}
        >
          {status === 'loading' ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Trash2 className="mr-2 size-4" />
          )}
          Preview purge
        </Button>

        {preview ? (
          <div className="space-y-3 rounded-2xl border border-border/70 bg-background/45 p-3">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {PURGE_COUNT_LABELS.map(({ key, label }) => (
                <div
                  key={key}
                  className="rounded-xl border border-border/60 bg-card/40 px-3 py-2"
                >
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {preview.counts[key].toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-purge-confirmation">
                Type{' '}
                <span className="font-mono text-foreground">
                  {preview.requiresConfirmation}
                </span>{' '}
                to confirm
              </Label>
              <Input
                id="admin-purge-confirmation"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="rounded-xl"
                autoComplete="off"
              />
            </div>
            <Button
              type="button"
              variant="destructive"
              className="rounded-xl"
              disabled={
                isSelf ||
                status === 'purging' ||
                confirmation.trim() !== preview.requiresConfirmation
              }
              onClick={() => void runPurge()}
            >
              {status === 'purging' ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 size-4" />
              )}
              Purge user
            </Button>
          </div>
        ) : null}

        {result ? (
          <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
            Purge completed. Object cleanup: {result.objectDeletion.deleted}/
            {result.objectDeletion.attempted} removed
            {result.partialFailure ? ', with some storage cleanup failures.' : '.'}
          </p>
        ) : null}

        {isSelf ? (
          <p className="rounded-xl border border-destructive/35 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            You cannot purge the currently signed-in admin account.
          </p>
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

