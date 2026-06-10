'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  Eye,
  EyeOff,
  FileText,
  GitCompareArrows,
  Gauge,
  Loader2,
  Palette,
  ShieldCheck,
  Sparkles,
  Timer,
  Trophy,
} from 'lucide-react'
import { MODE_CONFIGS } from '@/lib/config'
import { ASSISTANT_FAMILY_COPY, getAssistantFamilyFromMode } from '@/lib/config/assistants'
import { getUpgradeNudgeForError } from '@/lib/billing/upgrade-nudges'
import { cn } from '@/lib/utils'
import { useChatContext } from '@/lib/chat-context'
import {
  AIMode,
  ModelComparison,
  ModelComparisonCandidate,
  PlanChangeRequest,
  SubscriptionTier,
} from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const TEXT_COMPARE_MODES: AIMode[] = [
  'general',
  'creative',
  'logic',
  'code',
  'live',
]

type ModelDuelScoreLabel =
  | 'overall'
  | 'accuracy'
  | 'creativity'
  | 'speed'
  | 'structure'

const SCORE_LABELS: Array<{
  id: ModelDuelScoreLabel
  label: string
  icon: typeof Trophy
}> = [
  { id: 'overall', label: 'Best overall', icon: Trophy },
  { id: 'accuracy', label: 'Best for accuracy', icon: ShieldCheck },
  { id: 'creativity', label: 'Best for creativity', icon: Palette },
  { id: 'speed', label: 'Best for speed', icon: Timer },
  { id: 'structure', label: 'Best for structure', icon: Gauge },
]

interface ModelComparisonButtonProps {
  value: string
  disabled?: boolean
  onSaved?: () => void
}

interface ModelDuelDashboardSnapshot {
  plan: {
    tier: SubscriptionTier
  }
  pendingRequest?: PlanChangeRequest | null
}

function candidateLetter(index: number) {
  return String.fromCharCode(65 + index)
}

function formatCost(value: number | undefined): string {
  if (!value || value <= 0) return '$0.0000'
  return `$${value.toFixed(4)}`
}

function formatLatency(value: number | null | undefined): string {
  if (!value) return 'n/a'
  if (value < 1000) return `${value}ms`
  return `${(value / 1000).toFixed(1)}s`
}

function getScoreLabelsForCandidate(
  candidateId: string,
  assignments: Record<ModelDuelScoreLabel, string | null>
) {
  return SCORE_LABELS.filter((score) => assignments[score.id] === candidateId)
}

function getArtifactType(content: string) {
  return /```[\s\S]+```/.test(content) ? 'code' : 'document'
}

function getCandidateDisplayName(input: {
  candidate: ModelComparisonCandidate
  index: number
  isHidden: boolean
}) {
  if (input.isHidden) return `Candidate ${candidateLetter(input.index)}`
  return input.candidate.label
}

export function ModelComparisonButton({
  value,
  disabled,
  onSaved,
}: ModelComparisonButtonProps) {
  const {
    currentMode,
    runModelComparison,
    chooseModelComparisonResponse,
    saveArtifact,
    workspaceToolRequest,
    clearWorkspaceToolRequest,
  } = useChatContext()
  const [open, setOpen] = useState(false)
  const [selectedModes, setSelectedModes] = useState<AIMode[]>(() => {
    const defaults: AIMode[] =
      currentMode === 'image'
        ? ['general', 'creative', 'logic']
        : [currentMode, 'general', 'logic']

    return [...new Set(defaults)]
      .filter((mode) => TEXT_COMPARE_MODES.includes(mode))
      .slice(0, 3)
  })
  const [comparison, setComparison] = useState<ModelComparison | null>(null)
  const [comparisonError, setComparisonError] = useState<string | null>(null)
  const [isComparing, setIsComparing] = useState(false)
  const [savingCandidateId, setSavingCandidateId] = useState<string | null>(null)
  const [savingArtifactCandidateId, setSavingArtifactCandidateId] =
    useState<string | null>(null)
  const [blindMode, setBlindMode] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [dashboard, setDashboard] = useState<ModelDuelDashboardSnapshot | null>(null)
  const [scoreAssignments, setScoreAssignments] = useState<
    Record<ModelDuelScoreLabel, string | null>
  >({
    overall: null,
    accuracy: null,
    creativity: null,
    speed: null,
    structure: null,
  })

  const prompt = value.trim()
  const completedCandidateCount =
    comparison?.candidates.filter((candidate) => candidate.status === 'complete')
      .length ?? 0
  const identitiesHidden = Boolean(comparison && blindMode && !revealed)
  const canCompare = prompt.length > 0 && selectedModes.length >= 2 && !isComparing
  const selectedModeNames = useMemo(
    () => selectedModes.map((mode) => MODE_CONFIGS[mode].name).join(', '),
    [selectedModes]
  )
  const upgradeErrorNudge = getUpgradeNudgeForError(comparisonError)
  const showManualUpgradeNudge =
    dashboard &&
    ['free', 'basic'].includes(dashboard.plan.tier) &&
    !dashboard.pendingRequest

  useEffect(() => {
    if (workspaceToolRequest?.tool !== 'model-comparison') return

    setOpen(true)
    clearWorkspaceToolRequest(workspaceToolRequest.requestId)
  }, [clearWorkspaceToolRequest, workspaceToolRequest])

  useEffect(() => {
    if (!open) return

    let cancelled = false

    async function loadDashboard() {
      try {
        const response = await fetch('/api/dashboard', { cache: 'no-store' })
        if (!response.ok) return
        const payload = (await response.json()) as ModelDuelDashboardSnapshot
        if (!cancelled) {
          setDashboard(payload)
        }
      } catch {
        if (!cancelled) {
          setDashboard(null)
        }
      }
    }

    void loadDashboard()

    return () => {
      cancelled = true
    }
  }, [open])

  const toggleMode = (mode: AIMode) => {
    setSelectedModes((previous) => {
      if (previous.includes(mode)) {
        return previous.filter((item) => item !== mode)
      }

      if (previous.length >= 4) return previous
      return [...previous, mode]
    })
  }

  const assignScore = (score: ModelDuelScoreLabel, candidateId: string) => {
    setScoreAssignments((previous) => ({
      ...previous,
      [score]: previous[score] === candidateId ? null : candidateId,
    }))
  }

  const runComparison = async () => {
    if (!canCompare) return

    setIsComparing(true)
    setComparison(null)
    setComparisonError(null)
    setRevealed(false)
    setScoreAssignments({
      overall: null,
      accuracy: null,
      creativity: null,
      speed: null,
      structure: null,
    })

    try {
      const result = await runModelComparison({
        content: prompt,
        targetModes: selectedModes,
      })
      setComparison(result)
      if (!result) {
        setComparisonError('Model Duel could not be created.')
      }
    } catch (error) {
      setComparison(null)
      setComparisonError(
        error instanceof Error
          ? error.message
          : 'Model Duel could not be created.'
      )
    } finally {
      setIsComparing(false)
    }
  }

  const saveCandidate = async (candidateId: string) => {
    if (!comparison) return

    setSavingCandidateId(candidateId)
    setRevealed(true)

    try {
      const conversation = await chooseModelComparisonResponse(
        comparison.id,
        candidateId
      )

      if (conversation) {
        setOpen(false)
        onSaved?.()
      }
    } finally {
      setSavingCandidateId(null)
    }
  }

  const saveCandidateArtifact = async (candidateId: string) => {
    if (!comparison) return
    const candidate = comparison.candidates.find((item) => item.id === candidateId)
    if (!candidate || candidate.status !== 'complete' || !candidate.content.trim()) {
      return
    }

    const scoreLabels = getScoreLabelsForCandidate(candidate.id, scoreAssignments)

    setSavingArtifactCandidateId(candidateId)
    try {
      const artifact = await saveArtifact({
        title: `${candidate.label} Model Duel response`,
        content: candidate.content,
        artifactType: getArtifactType(candidate.content),
        sourceType: 'model_comparison',
        projectId: comparison.projectId,
        conversationId: comparison.conversationId,
        metadata: {
          savedFrom: 'model_duel',
          comparisonId: comparison.id,
          candidateId: candidate.id,
          assistantFamily: candidate.assistantFamily,
          mode: candidate.mode,
          model: candidate.model,
          label: candidate.label,
          selected: comparison.selectedCandidateId === candidate.id,
          scoreLabels: scoreLabels.map((score) => score.label),
          blindMode,
        },
      })
      if (artifact) {
        setOpen(false)
      }
    } finally {
      setSavingArtifactCandidateId(null)
    }
  }

  return (
    <>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground"
              disabled={disabled || !prompt}
              onClick={() => setOpen(true)}
            >
              <GitCompareArrows className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Model Duel</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-7xl overflow-y-auto rounded-[28px] border-border/70 bg-background/95 p-0 shadow-2xl shadow-black/40">
          <DialogHeader className="border-b border-border/70 px-5 py-5 text-left sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <GitCompareArrows className="size-5" />
                  Model Duel
                </DialogTitle>
                <DialogDescription className="mt-2 max-w-2xl">
                  Compare 2-4 text assistants, review the strongest response, then
                  save the winner to the conversation or Artifact Studio.
                </DialogDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-full">
                  {selectedModes.length}/4 selected
                </Badge>
                <Badge variant="secondary" className="rounded-full">
                  Text only
                </Badge>
                {comparison ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => setRevealed((value) => !value)}
                  >
                    {identitiesHidden ? (
                      <Eye className="mr-2 size-4" />
                    ) : (
                      <EyeOff className="mr-2 size-4" />
                    )}
                    {identitiesHidden ? 'Reveal' : 'Hide names'}
                  </Button>
                ) : null}
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5 px-5 py-5 sm:px-6">
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Prompt
                  </p>
                  <Badge variant="outline" className="rounded-full">
                    {prompt.length} chars
                  </Badge>
                </div>
                <p className="line-clamp-4 text-sm leading-6 text-foreground">
                  {prompt || 'Type a prompt before opening Model Duel.'}
                </p>
              </div>

              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="font-medium">Usage heads-up</p>
                    <p className="mt-1 text-xs leading-5 text-amber-100/80">
                      This duel can generate one response per selected assistant.
                      Each response may consume text usage, and plan limits are
                      enforced by the existing comparison API.
                    </p>
                    <p className="mt-2 text-xs text-amber-100/70">
                      Current duel: {selectedModeNames || 'No assistants selected'}
                    </p>
                    {showManualUpgradeNudge ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <p className="text-xs text-amber-100/80">
                          Comparing often? Manual plan requests can add more room.
                        </p>
                        <Button
                          asChild
                          size="sm"
                          variant="secondary"
                          className="h-8 rounded-full"
                        >
                          <Link href="/pricing">Request plan</Link>
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/40 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Blind Mode</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Hide assistant and model names while reviewing responses.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {blindMode ? (
                  <EyeOff className="size-4 text-muted-foreground" />
                ) : (
                  <Eye className="size-4 text-muted-foreground" />
                )}
                <Switch
                  checked={blindMode}
                  onCheckedChange={(checked) => {
                    setBlindMode(checked)
                    if (!checked) setRevealed(true)
                    if (checked) setRevealed(false)
                  }}
                />
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-5">
              {TEXT_COMPARE_MODES.map((mode) => {
                const config = MODE_CONFIGS[mode]
                const family = getAssistantFamilyFromMode(mode)
                const checked = selectedModes.includes(mode)
                return (
                  <div
                    key={mode}
                    role="button"
                    tabIndex={0}
                    className={cn(
                      'flex min-h-[92px] cursor-pointer items-start gap-2 rounded-2xl border p-3 text-left text-sm transition-colors',
                      checked
                        ? 'border-primary/70 bg-primary/10 text-foreground shadow-lg shadow-black/10'
                        : 'border-border/60 bg-card/40 text-muted-foreground hover:text-foreground'
                    )}
                    onClick={() => toggleMode(mode)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      toggleMode(mode)
                    }}
                  >
                    <Checkbox checked={checked} className="mt-0.5 pointer-events-none" />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">
                        {config.name}
                      </span>
                      <span className="mt-1 block text-xs opacity-75">
                        {ASSISTANT_FAMILY_COPY[family].shortName}
                      </span>
                      <span className="mt-1 line-clamp-2 text-xs opacity-70">
                        {ASSISTANT_FAMILY_COPY[family].description}
                      </span>
                    </span>
                  </div>
                )
              })}
            </div>

            {comparison ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Duel results
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {completedCandidateCount}/{comparison.candidates.length}{' '}
                      candidates completed. Assign scoring labels before saving if
                      useful.
                    </p>
                  </div>
                  <Badge variant={identitiesHidden ? 'secondary' : 'outline'} className="rounded-full">
                    {identitiesHidden ? 'Blind review active' : 'Names visible'}
                  </Badge>
                </div>

                <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-4">
                  {comparison.candidates.map((candidate, index) => {
                    const displayName = getCandidateDisplayName({
                      candidate,
                      index,
                      isHidden: identitiesHidden,
                    })
                    const scoreLabels = getScoreLabelsForCandidate(
                      candidate.id,
                      scoreAssignments
                    )
                    const completed = candidate.status === 'complete'

                    return (
                      <div
                        key={candidate.id}
                        className={cn(
                          'flex min-h-[460px] flex-col rounded-2xl border bg-card/50 p-4',
                          scoreAssignments.overall === candidate.id
                            ? 'border-primary/70 shadow-xl shadow-primary/10'
                            : 'border-border/60'
                        )}
                      >
                        <div className="space-y-3 border-b border-border/60 pb-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h4 className="truncate text-sm font-semibold text-foreground">
                                {displayName}
                              </h4>
                              <p className="truncate text-xs text-muted-foreground">
                                {identitiesHidden
                                  ? 'Identity hidden'
                                  : `${ASSISTANT_FAMILY_COPY[candidate.assistantFamily].shortName} / ${candidate.model}`}
                              </p>
                            </div>
                            {comparison.selectedCandidateId === candidate.id ? (
                              <Badge variant="secondary" className="rounded-full">
                                <Check className="size-3" />
                                Saved
                              </Badge>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {scoreLabels.length > 0 ? (
                              scoreLabels.map((score) => {
                                const Icon = score.icon
                                return (
                                  <Badge
                                    key={score.id}
                                    variant="outline"
                                    className="rounded-full"
                                  >
                                    <Icon className="size-3" />
                                    {score.label}
                                  </Badge>
                                )
                              })
                            ) : (
                              <Badge variant="outline" className="rounded-full">
                                Unscored
                              </Badge>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                            <span>Latency: {formatLatency(candidate.latencyMs)}</span>
                            <span>Tokens: {candidate.usage?.totalTokens ?? 0}</span>
                            <span>Shown usage: {formatCost(candidate.usage?.displayedCostUsd)}</span>
                            <span>Sources: {candidate.sources?.length ?? 0}</span>
                          </div>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto py-3 text-sm leading-6 text-foreground">
                          {completed ? (
                            <div className="whitespace-pre-wrap">{candidate.content}</div>
                          ) : (
                            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                              {candidate.error ?? 'This candidate failed.'}
                            </div>
                          )}
                        </div>

                        <div className="space-y-3 border-t border-border/60 pt-3">
                          <div className="flex flex-wrap gap-1.5">
                            {SCORE_LABELS.map((score) => {
                              const Icon = score.icon
                              const active = scoreAssignments[score.id] === candidate.id
                              return (
                                <Button
                                  key={score.id}
                                  type="button"
                                  variant={active ? 'secondary' : 'outline'}
                                  size="sm"
                                  className="h-7 rounded-full px-2 text-[11px]"
                                  disabled={!completed}
                                  onClick={() => assignScore(score.id, candidate.id)}
                                >
                                  <Icon className="mr-1 size-3" />
                                  {score.label.replace('Best for ', '')}
                                </Button>
                              )
                            })}
                          </div>

                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                            <Button
                              type="button"
                              className="rounded-xl"
                              disabled={
                                !completed ||
                                Boolean(comparison.selectedCandidateId) ||
                                Boolean(savingCandidateId)
                              }
                              onClick={() => void saveCandidate(candidate.id)}
                            >
                              {savingCandidateId === candidate.id ? (
                                <Loader2 className="mr-2 size-4 animate-spin" />
                              ) : (
                                <Trophy className="mr-2 size-4" />
                              )}
                              Save winner
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="rounded-xl"
                              disabled={
                                !completed ||
                                Boolean(savingArtifactCandidateId)
                              }
                              onClick={() => void saveCandidateArtifact(candidate.id)}
                            >
                              {savingArtifactCandidateId === candidate.id ? (
                                <Loader2 className="mr-2 size-4 animate-spin" />
                              ) : (
                                <FileText className="mr-2 size-4" />
                              )}
                              Save artifact
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : comparisonError ? (
              <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-5 text-sm text-destructive">
                <p className="font-medium">
                  {upgradeErrorNudge?.title ?? 'Model Duel could not run'}
                </p>
                <p className="mt-1">
                  {upgradeErrorNudge?.description ?? comparisonError}
                </p>
                {upgradeErrorNudge ? (
                  <Button
                    asChild
                    size="sm"
                    variant="secondary"
                    className="mt-3 rounded-full"
                  >
                    <Link href="/pricing">View plans</Link>
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/60 bg-card/30 px-4 py-8 text-center text-sm text-muted-foreground">
                Choose 2-4 text assistants, then run the duel.
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-border/70 px-5 py-4 sm:px-6">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button
              type="button"
              disabled={!canCompare}
              onClick={() => void runComparison()}
            >
              {isComparing ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <GitCompareArrows className="mr-2 size-4" />
              )}
              Run Model Duel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
