'use client'

import { useEffect, useState } from 'react'
import { Check, FileText, GitCompareArrows, Loader2, Trophy } from 'lucide-react'
import { MODE_CONFIGS } from '@/lib/config'
import { getAssistantFamilyFromMode } from '@/lib/config/assistants'
import { cn } from '@/lib/utils'
import { useChatContext } from '@/lib/chat-context'
import { AIMode, ModelComparison } from '@/types'
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

interface ModelComparisonButtonProps {
  value: string
  disabled?: boolean
  onSaved?: () => void
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
    const defaults: AIMode[] = currentMode === 'image'
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

  const prompt = value.trim()
  const canCompare = prompt.length > 0 && selectedModes.length >= 2 && !isComparing

  useEffect(() => {
    if (workspaceToolRequest?.tool !== 'model-comparison') return

    setOpen(true)
    clearWorkspaceToolRequest(workspaceToolRequest.requestId)
  }, [clearWorkspaceToolRequest, workspaceToolRequest])

  const toggleMode = (mode: AIMode) => {
    setSelectedModes((previous) => {
      if (previous.includes(mode)) {
        return previous.filter((item) => item !== mode)
      }

      if (previous.length >= 4) return previous
      return [...previous, mode]
    })
  }

  const runComparison = async () => {
    if (!canCompare) return

    setIsComparing(true)
    setComparison(null)
    setComparisonError(null)
    try {
      const result = await runModelComparison({
        content: prompt,
        targetModes: selectedModes,
      })
      setComparison(result)
      if (!result) {
        setComparisonError('Comparison could not be created.')
      }
    } catch (error) {
      setComparison(null)
      setComparisonError(
        error instanceof Error
          ? error.message
          : 'Comparison could not be created.'
      )
    } finally {
      setIsComparing(false)
    }
  }

  const saveCandidate = async (candidateId: string) => {
    if (!comparison) return

    setSavingCandidateId(candidateId)
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

    setSavingArtifactCandidateId(candidateId)
    try {
      const artifact = await saveArtifact({
        title: `${candidate.label} comparison response`,
        content: candidate.content,
        artifactType: /```[\s\S]+```/.test(candidate.content)
          ? 'code'
          : 'document',
        sourceType: 'model_comparison',
        projectId: comparison.projectId,
        conversationId: comparison.conversationId,
        metadata: {
          savedFrom: 'model_comparison',
          comparisonId: comparison.id,
          candidateId: candidate.id,
          assistantFamily: candidate.assistantFamily,
          mode: candidate.mode,
          model: candidate.model,
          label: candidate.label,
          selected: comparison.selectedCandidateId === candidate.id,
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
          <TooltipContent>Compare assistants</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-6xl overflow-y-auto rounded-2xl border-border/70 bg-background/95">
          <DialogHeader>
            <DialogTitle>Compare assistant responses</DialogTitle>
            <DialogDescription>
              Send this prompt to multiple text assistants, compare the outputs,
              then save the best response into the conversation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-card/40 p-3">
              <p className="line-clamp-3 text-sm text-foreground">{prompt}</p>
            </div>

            <div className="grid gap-2 sm:grid-cols-5">
              {TEXT_COMPARE_MODES.map((mode) => {
                const config = MODE_CONFIGS[mode]
                const checked = selectedModes.includes(mode)
                return (
                  <button
                    key={mode}
                    type="button"
                    className={cn(
                      'flex items-center gap-2 rounded-xl border p-3 text-left text-sm transition-colors',
                      checked
                        ? 'border-primary/70 bg-primary/10 text-foreground'
                        : 'border-border/60 bg-card/40 text-muted-foreground hover:text-foreground'
                    )}
                    onClick={() => toggleMode(mode)}
                  >
                    <Checkbox checked={checked} className="pointer-events-none" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {config.name}
                      </span>
                      <span className="block truncate text-xs opacity-75">
                        {getAssistantFamilyFromMode(mode)}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>

            {comparison ? (
              <div className="grid gap-3 lg:grid-cols-3">
                {comparison.candidates.map((candidate) => (
                  <div
                    key={candidate.id}
                    className="flex min-h-80 flex-col rounded-2xl border border-border/60 bg-card/50 p-4"
                  >
                    <div className="space-y-2 border-b border-border/60 pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="truncate text-sm font-semibold text-foreground">
                            {candidate.label}
                          </h4>
                          <p className="truncate text-xs text-muted-foreground">
                            {candidate.model}
                          </p>
                        </div>
                        {comparison.selectedCandidateId === candidate.id ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/40 px-2 py-0.5 text-xs text-primary">
                            <Check className="size-3" />
                            Saved
                          </span>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <span>{candidate.assistantFamily}</span>
                        <span>{formatLatency(candidate.latencyMs)}</span>
                        <span>{candidate.usage?.totalTokens ?? 0} tokens</span>
                        <span>{formatCost(candidate.usage?.displayedCostUsd)}</span>
                      </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto py-3 text-sm leading-6 text-foreground">
                      {candidate.status === 'complete' ? (
                        <div className="whitespace-pre-wrap">{candidate.content}</div>
                      ) : (
                        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                          {candidate.error ?? 'This candidate failed.'}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                      <Button
                        type="button"
                        className="rounded-xl"
                        disabled={
                          candidate.status !== 'complete' ||
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
                        Save as best
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl"
                        disabled={
                          candidate.status !== 'complete' ||
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
                ))}
              </div>
            ) : comparisonError ? (
              <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-5 text-sm text-destructive">
                {comparisonError}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/60 bg-card/30 px-4 py-8 text-center text-sm text-muted-foreground">
                Choose at least two assistants, then run the comparison.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button type="button" disabled={!canCompare} onClick={() => void runComparison()}>
              {isComparing ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <GitCompareArrows className="mr-2 size-4" />
              )}
              Compare
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
