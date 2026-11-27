'use client'

import { useMemo, useState } from 'react'
import { Loader2, RotateCcw } from 'lucide-react'
import { useChatContext } from '@/lib/chat-context'
import { DEFAULT_PROJECT_ID, getChatContextWindowTokens } from '@/lib/config'
import { buildUserInstructionsBlock } from '@/lib/ai/user-instructions'
import { estimateContextUsage } from '@/lib/chat/context-meter'
import { cn } from '@/lib/utils'
import type { Attachment, Conversation, PendingAttachment } from '@/types'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { ComposerPlanSnapshot } from './composer-usage'

// lib/ai/chat.ts sends at most this much of a custom assistant's instructions.
const CUSTOM_ASSISTANT_INSTRUCTION_CHARS = 6_000
const RING_RADIUS = 7
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

function formatTokens(tokens: number): string {
  return Math.max(0, Math.round(tokens)).toLocaleString('en-US')
}

function formatUpdated(value: string | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000)
  const format = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' })
  if (Math.abs(minutes) < 60) return format.format(-minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return format.format(-hours, 'hour')
  return format.format(-Math.round(hours / 24), 'day')
}

function Row({ label, tokens }: { label: string; tokens: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="shrink-0 tabular-nums text-foreground">{formatTokens(tokens)}</dd>
    </div>
  )
}

export function ContextMeter({
  plan,
  draft,
  attachments,
}: {
  plan: ComposerPlanSnapshot | null
  draft: string
  attachments: Array<Attachment | PendingAttachment>
}) {
  const {
    currentChat,
    currentMode,
    sessionSettings,
    appSettings,
    projects,
    selectedProjectId,
    customAssistants,
    currentCustomAssistantId,
    isStreaming,
    openConversation,
  } = useChatContext()
  const [open, setOpen] = useState(false)
  const [isContinuing, setIsContinuing] = useState(false)
  const [continueError, setContinueError] = useState<string | null>(null)

  const projectId =
    currentChat?.projectId ??
    (selectedProjectId === 'all' ? DEFAULT_PROJECT_ID : selectedProjectId)
  const project = projects.find((item) => item.id === projectId)
  const customAssistant = currentCustomAssistantId
    ? customAssistants.find((item) => item.id === currentCustomAssistantId && item.isEnabled)
    : null
  const summary = sessionSettings.memory ? currentChat?.memorySummary?.trim() || null : null
  const tier = plan?.plan.tier

  const estimate = useMemo(
    () =>
      estimateContextUsage({
        instructionTexts: [
          buildUserInstructionsBlock({
            aboutYou: appSettings.aboutYou,
            responseInstructions: appSettings.responseInstructions,
            useCustomInstructions: appSettings.useCustomInstructions,
            projectName: project?.name,
            projectInstructions: project?.instructions,
          }),
          customAssistant?.systemInstructions.slice(0, CUSTOM_ASSISTANT_INSTRUCTION_CHARS) ?? '',
        ],
        summary,
        messages: currentChat?.messages ?? [],
        draft,
        draftAttachments: attachments,
        includeAttachmentText: sessionSettings.fileContext,
        windowTokens: tier ? getChatContextWindowTokens(currentMode, tier) : null,
      }),
    [
      appSettings.aboutYou,
      appSettings.responseInstructions,
      appSettings.useCustomInstructions,
      attachments,
      currentChat?.messages,
      currentMode,
      customAssistant?.systemInstructions,
      draft,
      project?.instructions,
      project?.name,
      sessionSettings.fileContext,
      summary,
      tier,
    ]
  )

  const messageCount = Math.min(estimate.recentCount + 1, estimate.windowSize)
  const fill =
    estimate.share !== null ? Math.min(estimate.share, 1) : messageCount / estimate.windowSize
  const percent = estimate.share !== null ? Math.round(estimate.share * 100) : null
  const tone =
    estimate.share === null
      ? 'text-muted-foreground'
      : estimate.share >= 0.9
        ? 'text-red-400'
        : estimate.share >= 0.7
          ? 'text-amber-300'
          : 'text-muted-foreground'
  const updated = formatUpdated(currentChat?.memoryUpdatedAt)
  const canStartFresh =
    Boolean(currentChat?.memorySummary?.trim()) &&
    currentChat?.surface !== 'cli' &&
    (currentChat?.messageCount ?? 0) > 0

  const startFresh = async () => {
    if (!currentChat) return
    setIsContinuing(true)
    setContinueError(null)

    try {
      const response = await fetch(
        `/api/conversations/${encodeURIComponent(currentChat.id)}/continue`,
        { method: 'POST' }
      )
      const payload = (await response.json().catch(() => null)) as
        | (Conversation & { error?: string })
        | null
      if (!response.ok || !payload?.id) {
        throw new Error(payload?.error ?? 'Could not start a new chat.')
      }
      setOpen(false)
      await openConversation(payload.id)
    } catch (error) {
      setContinueError(error instanceof Error ? error.message : 'Could not start a new chat.')
    } finally {
      setIsContinuing(false)
    }
  }

  const label =
    percent !== null
      ? `Context: about ${percent}% of what one message can send. Show details`
      : `Context: ${messageCount} of ${estimate.windowSize} recent messages. Show details`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={percent !== null ? `About ${percent}% used` : `${messageCount} of ${estimate.windowSize} messages`}
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            tone
          )}
        >
          <svg viewBox="0 0 18 18" className="size-[18px] -rotate-90" aria-hidden>
            <circle cx="9" cy="9" r={RING_RADIUS} fill="none" stroke="currentColor" strokeOpacity={0.2} strokeWidth={2.5} />
            <circle
              cx="9"
              cy="9"
              r={RING_RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={RING_CIRCUMFERENCE * (1 - Math.max(fill, 0.04))}
            />
          </svg>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-[min(20rem,calc(100vw-2rem))] space-y-3 rounded-xl text-[13px] leading-5">
        <div>
          <p className="font-medium text-foreground">What your next message sends</p>
          <p className="mt-0.5 text-muted-foreground">
            {percent !== null && estimate.windowTokens
              ? `About ${formatTokens(estimate.totalTokens)} of ${formatTokens(estimate.windowTokens)} tokens your plan allows per message (${percent}%).`
              : `${messageCount} of ${estimate.windowSize} recent messages, about ${formatTokens(estimate.totalTokens)} tokens.`}
          </p>
        </div>
        <dl className="space-y-1">
          <Row label="Instructions and setup" tokens={estimate.instructionsTokens} />
          <Row label="Summary of older messages" tokens={estimate.summaryTokens} />
          <Row label={`Recent messages (${estimate.recentCount})`} tokens={estimate.recentTokens} />
          <Row label="Your message and files" tokens={estimate.draftTokens} />
        </dl>
        <p className="text-muted-foreground">
          Zenquanta sends the last {estimate.windowSize} messages word for word, plus a short
          summary of older ones.
        </p>
        <p className="text-muted-foreground">
          {!sessionSettings.memory
            ? 'Memory is off for this chat, so older messages are not summarized.'
            : summary
              ? `This chat has a summary${updated ? `, updated ${updated}` : ''}.`
              : 'This chat has no summary yet.'}
        </p>
        <p className="text-xs text-muted-foreground/80">
          Web results and file excerpts are added when they are used, so the real total can be
          higher.
        </p>
        <div className="space-y-1.5 border-t border-border/70 pt-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full gap-1.5 rounded-lg"
            disabled={!canStartFresh || isContinuing || isStreaming}
            aria-describedby={!canStartFresh ? 'context-meter-fresh-hint' : undefined}
            onClick={() => void startFresh()}
          >
            {isContinuing ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <RotateCcw className="size-3.5" aria-hidden />
            )}
            Start fresh with a summary
          </Button>
          {!canStartFresh ? (
            <p id="context-meter-fresh-hint" className="text-center text-xs text-muted-foreground">
              Available after a longer chat
            </p>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              Opens a new chat in this project that carries the summary over.
            </p>
          )}
          {continueError ? (
            <p role="alert" className="text-center text-xs text-destructive">
              {continueError}
            </p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}
