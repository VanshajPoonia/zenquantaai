'use client'

import { XIcon } from 'lucide-react'
import { AssistantFamily, AssistantRecommendationResult } from '@/types'
import {
  ASSISTANT_FAMILY_COPY,
  FAMILY_TO_MODE,
} from '@/lib/config/assistants'
import { cn } from '@/lib/utils'
import {
  getModeAccentClass,
  getModeTintClass,
  ModeIcon,
} from '@/lib/mode-utils'
import { Button } from '@/components/ui/button'

interface AssistantRecommendationChipProps {
  recommendation: AssistantRecommendationResult
  disabled?: boolean
  onUseRecommendation: () => void
  onIgnore: () => void
}

function getFamilyLabel(family: AssistantFamily): string {
  return ASSISTANT_FAMILY_COPY[family]?.shortName ?? family
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.9) return 'Strong match'
  if (confidence >= 0.8) return 'Good match'
  return 'Possible match'
}

export function AssistantRecommendationChip({
  recommendation,
  disabled,
  onUseRecommendation,
  onIgnore,
}: AssistantRecommendationChipProps) {
  const recommendedMode = FAMILY_TO_MODE[recommendation.predictedAssistant]
  const label = getFamilyLabel(recommendation.predictedAssistant)

  return (
    <div
      className={cn(
        'mb-2 flex flex-col gap-2 rounded-xl border border-border/70 bg-card/80 px-3 py-2.5 text-sm shadow-lg shadow-black/10 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between',
        getModeTintClass(recommendedMode, 'subtle')
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <div
          className={cn(
            'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-background/70',
            getModeAccentClass(recommendedMode, 'text')
          )}
        >
          <ModeIcon mode={recommendedMode} size="sm" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-foreground">
              {label} fits this prompt
            </p>
            <span
              className={cn(
                'rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[11px] font-medium',
                getModeAccentClass(recommendedMode, 'text')
              )}
            >
              {getConfidenceLabel(recommendation.confidence)}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {recommendation.reason}.
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-auto">
        <Button
          type="button"
          size="sm"
          className={cn(
            'rounded-lg text-white',
            getModeAccentClass(recommendedMode, 'bg')
          )}
          disabled={disabled}
          onClick={onUseRecommendation}
        >
          Use {label}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="rounded-lg text-muted-foreground hover:text-foreground"
          disabled={disabled}
          onClick={onIgnore}
          aria-label="Ignore assistant recommendation"
        >
          <XIcon className="size-4" />
        </Button>
      </div>
    </div>
  )
}
