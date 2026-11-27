'use client'

import { useId, useState } from 'react'
import { Loader2, NotebookPen, Pencil } from 'lucide-react'
import { PROJECT_INSTRUCTIONS_MAX_CHARS } from '@/lib/ai/user-instructions'
import { cn } from '@/lib/utils'
import type { Project } from '@/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export function ProjectInstructionsCard({
  projectId,
  initialInstructions,
}: {
  projectId: string
  initialInstructions: string
}) {
  const fieldId = useId()
  const [instructions, setInstructions] = useState(initialInstructions)
  const [draft, setDraft] = useState(initialInstructions)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startEditing = () => {
    setDraft(instructions)
    setError(null)
    setIsEditing(true)
  }

  const save = async () => {
    setIsSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructions: draft }),
      })
      const payload = (await response.json().catch(() => null)) as
        | (Project & { error?: string })
        | null

      if (!response.ok) {
        throw new Error(payload?.error ?? 'Could not save the instructions.')
      }

      setInstructions(payload?.instructions ?? '')
      setIsEditing(false)
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Could not save the instructions.'
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section
      aria-labelledby={`${fieldId}-title`}
      className="rounded-2xl border border-border/60 bg-card/45 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id={`${fieldId}-title`}
          className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground"
        >
          <NotebookPen className="size-4" aria-hidden />
          Instructions
        </h2>
        {!isEditing ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={startEditing}
          >
            <Pencil className="mr-1.5 size-3.5" aria-hidden />
            {instructions ? 'Edit' : 'Add instructions'}
          </Button>
        ) : null}
      </div>

      {isEditing ? (
        <div className="mt-3 space-y-2">
          <label htmlFor={fieldId} className="sr-only">
            Project instructions
          </label>
          <Textarea
            id={fieldId}
            value={draft}
            maxLength={PROJECT_INSTRUCTIONS_MAX_CHARS}
            rows={6}
            autoFocus
            placeholder="For example: We are a 3-person bakery. Keep answers short."
            aria-describedby={`${fieldId}-count`}
            className="max-h-80 min-h-32 rounded-xl text-sm"
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p
              id={`${fieldId}-count`}
              className={cn(
                'text-xs tabular-nums text-muted-foreground',
                draft.length > PROJECT_INSTRUCTIONS_MAX_CHARS * 0.9 && 'text-amber-200'
              )}
            >
              {draft.length.toLocaleString('en-US')} /{' '}
              {PROJECT_INSTRUCTIONS_MAX_CHARS.toLocaleString('en-US')}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isSaving}
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isSaving || draft === instructions}
                onClick={() => void save()}
              >
                {isSaving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
                Save
              </Button>
            </div>
          </div>
          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      ) : instructions ? (
        <p className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-foreground/85 [overflow-wrap:anywhere]">
          {instructions}
        </p>
      ) : (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Tell every chat in this project what to know. For example: We are a 3-person bakery.
          Keep answers short.
        </p>
      )}

      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        Every assistant reads this in this project&apos;s chats. Don&apos;t put passwords here.
      </p>
    </section>
  )
}
