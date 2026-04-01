'use client'

import { AssistantFamily, AssistantRecommendationResult } from '@/types'
import { FAMILY_TO_MODE } from '@/lib/config/assistants'
import { getModeAccentClass, getModeTintClass, ModeIcon } from '@/lib/mode-utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface AssistantRecommendationDialogProps {
  open: boolean
  recommendation: AssistantRecommendationResult | null
  suppressForMessage: boolean
  onSuppressForMessageChange: (value: boolean) => void
  onSwitchAndContinue: () => void
  onContinueAnyway: () => void
  onCancel: () => void
  onOpenChange: (open: boolean) => void
}

function getFamilyLabel(family: AssistantFamily): string {
  return family.charAt(0).toUpperCase() + family.slice(1)
}

export function AssistantRecommendationDialog({
  open,
  recommendation,
  suppressForMessage,
  onSuppressForMessageChange,
  onSwitchAndContinue,
  onContinueAnyway,
  onCancel,
  onOpenChange,
}: AssistantRecommendationDialogProps) {
  if (!recommendation) return null

  const currentMode = FAMILY_TO_MODE[recommendation.currentAssistant]
  const recommendedMode = FAMILY_TO_MODE[recommendation.predictedAssistant]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-xl rounded-[24px] border border-border/70 bg-background/95 p-0 shadow-2xl shadow-black/40">
        <div className="overflow-hidden rounded-[26px]">
          <div className="border-b border-border/70 bg-gradient-to-b from-card/80 to-background px-5 py-5 sm:px-6">
            <DialogHeader className="space-y-3 text-left">
              <div className="inline-flex w-fit rounded-full border border-border/60 bg-card/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground sm:text-[11px]">
                Assistant recommendation
              </div>
              <DialogTitle className="text-lg font-semibold tracking-tight sm:text-xl">
                Better fit: {getFamilyLabel(recommendation.predictedAssistant)}
              </DialogTitle>
              <DialogDescription className="max-w-lg text-xs leading-6 sm:text-sm">
                This prompt is likely to do better on a different assistant.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-4 px-5 py-5 sm:px-6">
            <div
              className={`rounded-2xl border border-border/70 bg-card/60 p-4 ${getModeTintClass(recommendedMode, 'subtle')}`}
            >
              <div className="flex flex-wrap items-center gap-3">
                <div
                  className={`flex size-10 items-center justify-center rounded-2xl border border-white/10 bg-background/70 ${getModeAccentClass(recommendedMode, 'text')}`}
                >
                  <ModeIcon mode={recommendedMode} size="md" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">
                    Switch from {getFamilyLabel(recommendation.currentAssistant)} to{' '}
                    {getFamilyLabel(recommendation.predictedAssistant)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Confidence {Math.round(recommendation.confidence * 100)}%
                  </p>
                </div>
                <div
                  className={`inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[11px] ${getModeAccentClass(currentMode, 'text')}`}
                >
                  <ModeIcon mode={currentMode} size="sm" />
                  <span>{getFamilyLabel(recommendation.currentAssistant)}</span>
                </div>
                <div
                  className={`inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[11px] ${getModeAccentClass(recommendedMode, 'text')}`}
                >
                  <ModeIcon mode={recommendedMode} size="sm" />
                  <span>{getFamilyLabel(recommendation.predictedAssistant)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card/50 p-4">
              <p className="text-sm leading-7 text-foreground/90">
                Recommend {getFamilyLabel(recommendation.predictedAssistant)} because{' '}
                {recommendation.reason}.
              </p>
            </div>

            <label className="flex items-start gap-3 rounded-2xl border border-border/50 bg-background/30 px-4 py-3">
              <Checkbox
                checked={suppressForMessage}
                onCheckedChange={(checked) =>
                  onSuppressForMessageChange(Boolean(checked))
                }
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-medium text-foreground/90">
                  Don’t show this again for this message
                </p>
                <p className="text-[11px] leading-5 text-muted-foreground">
                  Only for this exact draft.
                </p>
              </div>
            </label>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" className="rounded-xl" onClick={onCancel}>
                Cancel
              </Button>
              <Button
                variant="secondary"
                className="rounded-xl"
                onClick={onContinueAnyway}
              >
                Continue with {getFamilyLabel(recommendation.currentAssistant)}
              </Button>
              <Button className="rounded-xl" onClick={onSwitchAndContinue}>
                Switch to {getFamilyLabel(recommendation.predictedAssistant)} and Continue
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
