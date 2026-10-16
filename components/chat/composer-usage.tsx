'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, Gauge, ImageIcon, Lock, X } from 'lucide-react'
import {
  AIMode,
  Attachment,
  PendingAttachment,
  PlanChangeRequest,
  SessionSettings,
  SubscriptionTier,
  UsageOptimization,
} from '@/types'
import {
  getAllowedModelsForTier,
  getUsageOptimizationFromModelOverride,
  INTELLIGENCE_LEVEL_OPTIONS,
  resolveModelConfig,
} from '@/lib/config'
import {
  DashboardLimitSnapshot,
  isNearLimit,
} from '@/lib/billing/upgrade-nudges'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type ComposerKind = 'chat' | 'image'

export interface ComposerPlanSnapshot {
  plan: {
    tier: SubscriptionTier
  }
  limits?: DashboardLimitSnapshot
  pendingRequest?: PlanChangeRequest | null
}

const PLAN_NAMES: Record<SubscriptionTier, string> = {
  free: 'Free',
  basic: 'Basic',
  pro: 'Pro',
  ultra: 'Ultra',
  prime: 'Prime',
}

// One plan lookup per composer mount, shared by the intelligence picker and
// the usage notice so they do not each fetch the dashboard.
export function useComposerPlan() {
  const [plan, setPlan] = useState<ComposerPlanSnapshot | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch('/api/dashboard', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: ComposerPlanSnapshot | null) => {
        if (!cancelled) setPlan(payload)
      })
      .catch(() => {
        if (!cancelled) setPlan(null)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return plan
}

function estimateDraftTokens(content: string) {
  if (!content.trim()) return 0
  return Math.max(1, Math.ceil(content.length / 4))
}

function isHeavyDraft(input: {
  content: string
  attachments: Array<Attachment | PendingAttachment>
  settings: SessionSettings
  mode: AIMode
}) {
  let score = 0
  const tokenEstimate = estimateDraftTokens(input.content)

  if (tokenEstimate > 5000) score += 2
  else if (tokenEstimate > 1500) score += 1

  if (input.settings.maxTokens > 3500) score += 2
  else if (input.settings.maxTokens > 1800) score += 1

  if (input.attachments.length > 3) score += 2
  else if (input.attachments.length > 0) score += 1

  if (input.settings.webSearch || input.mode === 'live') score += 1
  if (input.settings.fileContext) score += 1

  return score >= 4
}

function getLimitNotice(plan: ComposerPlanSnapshot | null) {
  if (!plan?.limits) return null

  if (plan.pendingRequest) {
    return {
      id: 'pending-plan-request',
      tone: 'neutral' as const,
      text: `Your ${PLAN_NAMES[plan.pendingRequest.requestedTier] ?? 'new'} plan request is pending. It switches on once an admin approves it.`,
    }
  }

  const { limits } = plan
  const candidates = [
    {
      id: 'daily-messages',
      text: `${limits.dailyMessages.remaining.toLocaleString()} of ${limits.dailyMessages.limit.toLocaleString()} messages left today.`,
      snapshot: limits.dailyMessages,
    },
    {
      id: 'daily-images',
      text: `${limits.dailyImages.remaining.toLocaleString()} of ${limits.dailyImages.limit.toLocaleString()} images left today.`,
      snapshot: limits.dailyImages,
    },
    {
      id: 'image-credits',
      text: `${limits.imageCredits.remaining.toLocaleString()} image credits left this cycle.`,
      snapshot: limits.imageCredits,
    },
    {
      id: 'usage-credits',
      text: `${Math.floor(limits.displayedCredits.remaining).toLocaleString()} usage credits left this cycle.`,
      snapshot: limits.displayedCredits,
    },
  ]
    .filter((candidate) => isNearLimit(candidate.snapshot))
    .sort((a, b) => b.snapshot.ratio - a.snapshot.ratio)

  const top = candidates[0]
  return top ? { id: top.id, tone: 'warning' as const, text: top.text } : null
}

interface ComposerUsageNoticeProps {
  plan: ComposerPlanSnapshot | null
  mode: AIMode
  kind: ComposerKind
  content: string
  attachments: Array<Attachment | PendingAttachment>
  settings: SessionSettings
}

// Stays silent for ordinary drafts. It only speaks up when a limit is close,
// a plan request is pending, or the draft is unusually heavy.
export function ComposerUsageNotice({
  plan,
  mode,
  kind,
  content,
  attachments,
  settings,
}: ComposerUsageNoticeProps) {
  const [dismissed, setDismissed] = useState<string[]>([])
  const limitNotice = getLimitNotice(plan)
  const heavy =
    kind === 'chat' &&
    mode !== 'image' &&
    isHeavyDraft({ content, attachments, settings, mode })

  if (limitNotice && !dismissed.includes(limitNotice.id)) {
    return (
      <div
        role="status"
        className={cn(
          'mb-2 flex items-center gap-3 rounded-xl border px-3 py-2 text-xs',
          limitNotice.tone === 'warning'
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
            : 'border-border/70 bg-card/70 text-muted-foreground'
        )}
      >
        <Gauge className="size-3.5 shrink-0" aria-hidden />
        <p className="min-w-0 flex-1 leading-5">{limitNotice.text}</p>
        {limitNotice.tone === 'warning' ? (
          <Link
            href="/pricing"
            className="shrink-0 font-medium underline-offset-4 hover:underline"
          >
            See plans
          </Link>
        ) : null}
        <button
          type="button"
          aria-label="Dismiss"
          className="-mr-1 shrink-0 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100"
          onClick={() => setDismissed((previous) => [...previous, limitNotice.id])}
        >
          <X className="size-3.5" />
        </button>
      </div>
    )
  }

  if (kind === 'image') {
    return (
      <p className="mb-2 flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
        <ImageIcon className="size-3.5 shrink-0" aria-hidden />
        Prism creates one image from this prompt and uses image credits from your plan.
      </p>
    )
  }

  if (heavy) {
    return (
      <p className="mb-2 flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
        <Gauge className="size-3.5 shrink-0" aria-hidden />
        This is a large request, so it uses more of your plan than a short message.
      </p>
    )
  }

  return null
}

interface IntelligencePickerProps {
  plan: ComposerPlanSnapshot | null
  mode: AIMode
  settings: SessionSettings
  disabled?: boolean
  onChange: (level: UsageOptimization) => void
}

export function IntelligencePicker({
  plan,
  mode,
  settings,
  disabled,
  onChange,
}: IntelligencePickerProps) {
  const selectedLevel = getUsageOptimizationFromModelOverride(settings.modelOverride)
  const selected =
    INTELLIGENCE_LEVEL_OPTIONS.find((option) => option.id === selectedLevel) ??
    INTELLIGENCE_LEVEL_OPTIONS[0]
  const allowedModels = useMemo(
    () => (plan ? getAllowedModelsForTier(plan.plan.tier) : null),
    [plan]
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          aria-label={`Intelligence: ${selected.label}`}
          className="h-8 gap-1 rounded-full px-2.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground"
        >
          {selected.label}
          <ChevronDown className="size-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-72">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Intelligence for this chat
        </DropdownMenuLabel>
        {INTELLIGENCE_LEVEL_OPTIONS.map((option) => {
          const optionModel = resolveModelConfig(
            mode,
            option.modelOverride,
            plan?.plan.tier ?? 'free'
          ).model
          const locked = Boolean(allowedModels) && !allowedModels!.includes(optionModel)
          const isSelected = option.id === selected.id

          return (
            <DropdownMenuItem
              key={option.id}
              className="items-start gap-2 py-2"
              onSelect={() => onChange(option.id)}
            >
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                {isSelected ? (
                  <Check className="size-4" />
                ) : locked ? (
                  <Lock className="size-3.5 text-muted-foreground" />
                ) : null}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{option.label}</span>
                <span className="block text-xs leading-5 text-muted-foreground">
                  {locked ? 'Not included in your plan yet. ' : ''}
                  {option.hint}
                </span>
              </span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
