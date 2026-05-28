'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  BadgeCheck,
  Gauge,
  ImageIcon,
  Search,
  Sparkles,
  WalletCards,
  X,
} from 'lucide-react'
import {
  AIMode,
  Attachment,
  PendingAttachment,
  PlanChangeRequest,
  SessionSettings,
  SubscriptionStatus,
  SubscriptionTier,
} from '@/types'
import {
  DashboardLimitSnapshot,
  isNearLimit,
} from '@/lib/billing/upgrade-nudges'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type ComposerKind = 'chat' | 'image'
type UsageLevel = 'low' | 'medium' | 'high'

interface DashboardSnapshot {
  plan: {
    tier: SubscriptionTier
    status: SubscriptionStatus
    currentPeriodEndsAt: string
  }
  usage: {
    displayedCreditsTotal: number
    displayedCreditsUsed: number
    displayedCreditsRemaining: number
    textDisplayedCostUsd: number
    imageDisplayedCostUsd: number
    totalDisplayedCostUsd: number
  }
  limits?: DashboardLimitSnapshot
  pendingRequest?: PlanChangeRequest | null
  latestPlanRequest?: PlanChangeRequest | null
}

interface UsageTransparencyHintProps {
  mode: AIMode
  kind: ComposerKind
  content: string
  attachments: Array<Attachment | PendingAttachment>
  settings: SessionSettings
  disabled?: boolean
}

const QUALITY_MODES = [
  'Fast',
  'Balanced',
  'Best quality',
  'Lowest usage',
] as const

const PLAN_LABELS: Record<SubscriptionTier, string> = {
  free: 'Free',
  basic: 'Basic',
  pro: 'Pro',
  ultra: 'Ultra',
  prime: 'Prime',
}

function estimateDraftTokens(content: string) {
  if (!content.trim()) return 0
  return Math.max(1, Math.ceil(content.length / 4))
}

function getUsageLevel(input: {
  content: string
  kind: ComposerKind
  attachments: Array<Attachment | PendingAttachment>
  settings: SessionSettings
  mode: AIMode
  tier?: SubscriptionTier
}): UsageLevel {
  if (input.kind === 'image' || input.mode === 'image') {
    return estimateDraftTokens(input.content) > 700 ? 'high' : 'medium'
  }

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
  if (input.settings.modelOverride !== 'auto') score += 1
  if (input.tier && ['pro', 'ultra', 'prime'].includes(input.tier)) score += 1

  if (score >= 4) return 'high'
  if (score >= 2) return 'medium'
  return 'low'
}

function getUsageLevelCopy(level: UsageLevel, kind: ComposerKind) {
  if (kind === 'image') {
    return {
      label: level === 'high' ? 'High usage' : 'Medium usage',
      detail:
        'Prism will create one image and use image credits when you send.',
      className:
        level === 'high'
          ? 'border-orange-500/40 bg-orange-500/10 text-orange-100'
          : 'border-amber-500/40 bg-amber-500/10 text-amber-100',
    }
  }

  if (level === 'high') {
    return {
      label: 'High usage',
      detail: 'Longer context, tools, or premium routing may use more.',
      className: 'border-orange-500/40 bg-orange-500/10 text-orange-100',
    }
  }

  if (level === 'medium') {
    return {
      label: 'Medium usage',
      detail: 'This draft may use extra context or a larger response.',
      className: 'border-amber-500/40 bg-amber-500/10 text-amber-100',
    }
  }

  return {
    label: 'Low usage',
    detail: 'Short prompt with standard routing.',
    className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100',
  }
}

function formatCredits(value: number) {
  if (!Number.isFinite(value)) return '0'
  return Math.floor(value).toLocaleString()
}

function getNearLimitNudge(dashboard: DashboardSnapshot | null) {
  if (!dashboard?.limits) return null
  if (dashboard.pendingRequest) {
    return {
      id: 'pending-plan-request',
      title: 'Plan request pending',
      description: `Your ${dashboard.pendingRequest.requestedTier.toUpperCase()} request is waiting for manual admin activation.`,
      tone: 'amber' as const,
    }
  }

  const limits = dashboard.limits
  const candidates = [
    {
      id: 'daily-messages',
      title: 'Daily messages are running low',
      description: `${limits.dailyMessages.remaining.toLocaleString()} of ${limits.dailyMessages.limit.toLocaleString()} messages left today.`,
      ratio: limits.dailyMessages.ratio,
      active: isNearLimit(limits.dailyMessages),
    },
    {
      id: 'daily-images',
      title: 'Daily image limit is close',
      description: `${limits.dailyImages.remaining.toLocaleString()} of ${limits.dailyImages.limit.toLocaleString()} Prism generations left today.`,
      ratio: limits.dailyImages.ratio,
      active: isNearLimit(limits.dailyImages),
    },
    {
      id: 'image-credits',
      title: 'Image credits are running low',
      description: `${limits.imageCredits.remaining.toLocaleString()} image credits left this cycle.`,
      ratio: limits.imageCredits.ratio,
      active: isNearLimit(limits.imageCredits),
    },
    {
      id: 'displayed-credits',
      title: 'Plan usage is near its included amount',
      description: `${formatCredits(limits.displayedCredits.remaining)} displayed usage credits left this cycle.`,
      ratio: limits.displayedCredits.ratio,
      active: isNearLimit(limits.displayedCredits),
    },
  ]
    .filter((candidate) => candidate.active)
    .sort((a, b) => b.ratio - a.ratio)

  const top = candidates[0]
  if (!top) return null

  return {
    id: top.id,
    title: top.title,
    description: top.description,
    tone: 'rose' as const,
  }
}

export function UsageTransparencyHint({
  mode,
  kind,
  content,
  attachments,
  settings,
  disabled,
}: UsageTransparencyHintProps) {
  const [dashboard, setDashboard] = useState<DashboardSnapshot | null>(null)
  const [dashboardUnavailable, setDashboardUnavailable] = useState(false)
  const [dismissedNudges, setDismissedNudges] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false

    async function loadDashboard() {
      try {
        const response = await fetch('/api/dashboard', { cache: 'no-store' })
        if (!response.ok) throw new Error('Dashboard unavailable')
        const payload = (await response.json()) as DashboardSnapshot
        if (!cancelled) {
          setDashboard(payload)
          setDashboardUnavailable(false)
        }
      } catch {
        if (!cancelled) {
          setDashboard(null)
          setDashboardUnavailable(true)
        }
      }
    }

    void loadDashboard()

    return () => {
      cancelled = true
    }
  }, [])

  const level = useMemo(
    () =>
      getUsageLevel({
        content,
        kind,
        attachments,
        settings,
        mode,
        tier: dashboard?.plan.tier,
      }),
    [attachments, content, dashboard?.plan.tier, kind, mode, settings]
  )
  const levelCopy = getUsageLevelCopy(level, kind)
  const usesWebSearch = kind === 'chat' && (mode === 'live' || settings.webSearch)
  const usesFileContext = kind === 'chat' && settings.fileContext
  const usesImageCredits = kind === 'image' || mode === 'image'
  const usesPremiumModel =
    kind === 'chat' &&
    (settings.modelOverride !== 'auto' ||
      (dashboard?.plan.tier ? ['pro', 'ultra', 'prime'].includes(dashboard.plan.tier) : false))
  const showRemaining =
    Boolean(dashboard) && dashboard!.usage.displayedCreditsTotal > 0
  const nearLimitNudge = getNearLimitNudge(dashboard)
  const visibleNearLimitNudge =
    nearLimitNudge && !dismissedNudges.includes(nearLimitNudge.id)
      ? nearLimitNudge
      : null

  return (
    <div
      className={cn(
        'mb-3 rounded-2xl border border-border/60 bg-card/55 p-3 text-xs text-muted-foreground shadow-sm',
        disabled && 'opacity-70'
      )}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn('rounded-full', levelCopy.className)}>
              <Gauge className="size-3" />
              {levelCopy.label}
            </Badge>
            {usesPremiumModel ? (
              <Badge
                variant="outline"
                className="rounded-full border-violet-500/40 bg-violet-500/10 text-violet-100"
              >
                <Sparkles className="size-3" />
                Premium model
              </Badge>
            ) : null}
            {usesWebSearch ? (
              <Badge
                variant="outline"
                className="rounded-full border-sky-500/40 bg-sky-500/10 text-sky-100"
              >
                <Search className="size-3" />
                Uses web search
              </Badge>
            ) : null}
            {usesFileContext ? (
              <Badge
                variant="outline"
                className="rounded-full border-cyan-500/40 bg-cyan-500/10 text-cyan-100"
              >
                <BadgeCheck className="size-3" />
                Uses file context
              </Badge>
            ) : null}
            {usesImageCredits ? (
              <Badge
                variant="outline"
                className="rounded-full border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-100"
              >
                <ImageIcon className="size-3" />
                Uses image credits
              </Badge>
            ) : null}
          </div>
          <p className="leading-5">
            {levelCopy.detail}{' '}
            {dashboard ? (
              <span>
                Plan: {PLAN_LABELS[dashboard.plan.tier]}
                {showRemaining
                  ? `, ${formatCredits(dashboard.usage.displayedCreditsRemaining)} usage credits left.`
                  : '. Plan limits are checked on send.'}
              </span>
            ) : dashboardUnavailable ? (
              <span>Plan usage will still be checked on send.</span>
            ) : (
              <span>Loading plan usage...</span>
            )}
          </p>
        </div>

        <TooltipProvider delayDuration={250}>
          <div className="flex shrink-0 flex-wrap gap-1.5">
            {QUALITY_MODES.map((label) => (
              <Tooltip key={label}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={label === 'Balanced' ? 'secondary' : 'outline'}
                    size="sm"
                    disabled
                    className="h-7 rounded-full px-2.5 text-[11px]"
                  >
                    {label === 'Balanced' ? (
                      <WalletCards className="mr-1 size-3" />
                    ) : null}
                    {label}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Usage profile controls are coming soon; current routing is unchanged.
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
      </div>
      {kind === 'image' ? (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] leading-4 text-muted-foreground">
          <AlertCircle className="size-3 shrink-0" />
          Image credits are enforced by the existing Prism generation route.
        </p>
      ) : null}
      {visibleNearLimitNudge ? (
        <div
          className={cn(
            'mt-3 flex flex-col gap-3 rounded-xl border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between',
            visibleNearLimitNudge.tone === 'rose'
              ? 'border-rose-500/30 bg-rose-500/10 text-rose-100'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-100'
          )}
        >
          <div className="min-w-0">
            <p className="font-medium">{visibleNearLimitNudge.title}</p>
            <p className="mt-1 leading-5 opacity-85">
              {visibleNearLimitNudge.description} Upgrades stay manual through plan requests.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button asChild size="sm" variant="secondary" className="h-8 rounded-full">
              <Link href="/pricing">View plans</Link>
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="size-8 rounded-full"
              onClick={() =>
                setDismissedNudges((previous) => [
                  ...previous,
                  visibleNearLimitNudge.id,
                ])
              }
            >
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
