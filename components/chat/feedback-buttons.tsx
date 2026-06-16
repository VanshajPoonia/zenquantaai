'use client'

import { useState } from 'react'
import { Check, Loader2, Send, ThumbsDown, ThumbsUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  FeedbackEntityType,
  FeedbackRating,
  FeedbackSubmitResponse,
} from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface FeedbackButtonsProps {
  entityType: FeedbackEntityType
  entityId: string
  metadata?: Record<string, unknown>
  allowNeutral?: boolean
  className?: string
}

export function FeedbackButtons({
  entityType,
  entityId,
  metadata,
  allowNeutral = false,
  className,
}: FeedbackButtonsProps) {
  const [selectedRating, setSelectedRating] = useState<FeedbackRating | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showReason, setShowReason] = useState(false)
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submitFeedback = async (rating: FeedbackRating, reasonValue?: string) => {
    setIsSubmitting(true)
    setError(null)
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType,
          entityId,
          rating,
          reason: reasonValue,
          metadata,
        }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null
        throw new Error(payload?.error ?? 'Unable to save feedback.')
      }

      ;(await response.json()) as FeedbackSubmitResponse
      setSelectedRating(rating)
      setShowReason(false)
      setReason('')
      setMessage('Thanks for the feedback')
      window.setTimeout(() => setMessage(null), 2400)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to save feedback.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDownvote = () => {
    if (!showReason) {
      setShowReason(true)
      setError(null)
      return
    }

    void submitFeedback('down', reason)
  }

  return (
    <div className={cn('flex min-w-0 flex-wrap items-center gap-1.5', className)}>
      <Button
        type="button"
        variant={selectedRating === 'up' ? 'secondary' : 'ghost'}
        size="icon-sm"
        className="size-7"
        disabled={isSubmitting}
        onClick={() => void submitFeedback('up')}
        aria-label="Rate helpful"
      >
        {isSubmitting && selectedRating === 'up' ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <ThumbsUp className="size-3.5" />
        )}
      </Button>
      <Button
        type="button"
        variant={selectedRating === 'down' ? 'secondary' : 'ghost'}
        size="icon-sm"
        className="size-7"
        disabled={isSubmitting}
        onClick={handleDownvote}
        aria-label="Rate not helpful"
      >
        {isSubmitting && showReason ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <ThumbsDown className="size-3.5" />
        )}
      </Button>
      {allowNeutral ? (
        <Button
          type="button"
          variant={selectedRating === 'neutral' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-7 rounded-full px-2 text-xs"
          disabled={isSubmitting}
          onClick={() => void submitFeedback('neutral')}
        >
          Neutral
        </Button>
      ) : null}
      {showReason ? (
        <form
          className="flex min-w-0 flex-1 items-center gap-1"
          onSubmit={(event) => {
            event.preventDefault()
            void submitFeedback('down', reason)
          }}
        >
          <Input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Optional reason"
            className="h-7 min-w-[10rem] rounded-full text-xs"
            maxLength={500}
            disabled={isSubmitting}
          />
          <Button
            type="submit"
            variant="ghost"
            size="icon-sm"
            className="size-7"
            disabled={isSubmitting}
            aria-label="Send feedback"
          >
            {isSubmitting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
          </Button>
        </form>
      ) : null}
      {message ? (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Check className="size-3.5 text-emerald-400" />
          {message}
        </span>
      ) : null}
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  )
}
