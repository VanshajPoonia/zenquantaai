'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  Check,
  Code2,
  GraduationCap,
  ImageIcon,
  Loader2,
  Megaphone,
  Sparkles,
} from 'lucide-react'
import {
  getOnboardingRecommendation,
  ONBOARDING_ASSISTANT_MODES,
  ONBOARDING_USE_CASES,
  STARTER_PACKS,
} from '@/lib/config'
import { MODE_CONFIGS } from '@/lib/types'
import { useChatContext } from '@/lib/chat-context'
import { cn } from '@/lib/utils'
import { AIMode, OnboardingUseCase, StarterPackId } from '@/types'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ModeIcon } from '@/lib/mode-utils'

const PACK_IDS = Object.keys(STARTER_PACKS) as StarterPackId[]

const USE_CASE_ICONS: Record<OnboardingUseCase, typeof GraduationCap> = {
  school_research: GraduationCap,
  coding: Code2,
  business: BriefcaseBusiness,
  marketing_content: Megaphone,
  personal_productivity: Check,
  image_generation: ImageIcon,
  all_in_one: Sparkles,
}

function getInitialUseCase(): OnboardingUseCase {
  return 'all_in_one'
}

function nextFromUseCase(useCase: OnboardingUseCase) {
  const recommendation = getOnboardingRecommendation(useCase)
  return {
    defaultMode: recommendation.defaultMode,
    starterPackId: recommendation.starterPackId,
  }
}

export function OnboardingDialog() {
  const {
    isOnboardingOpen,
    completeOnboarding,
    skipOnboarding,
  } = useChatContext()
  const initial = nextFromUseCase(getInitialUseCase())
  const [step, setStep] = useState(0)
  const [useCase, setUseCase] = useState<OnboardingUseCase>(getInitialUseCase)
  const [defaultMode, setDefaultMode] = useState<AIMode>(initial.defaultMode)
  const [starterPackId, setStarterPackId] = useState<StarterPackId>(
    initial.starterPackId
  )
  const [createStarterProject, setCreateStarterProject] = useState(true)
  const [installStarterPrompts, setInstallStarterPrompts] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const starterPack = STARTER_PACKS[starterPackId]
  const currentStep = Math.min(step, 3)
  const progress = `${currentStep + 1} / 4`

  const selectedRecommendation = useMemo(
    () => getOnboardingRecommendation(useCase),
    [useCase]
  )

  useEffect(() => {
    if (!isOnboardingOpen) return

    setStep(0)
    setError(null)
  }, [isOnboardingOpen])

  const updateUseCase = (nextUseCase: OnboardingUseCase) => {
    const recommendation = getOnboardingRecommendation(nextUseCase)

    setUseCase(nextUseCase)
    setDefaultMode(recommendation.defaultMode)
    setStarterPackId(recommendation.starterPackId)
  }

  const handleSkip = async () => {
    if (isSubmitting) return

    setIsSubmitting(true)
    setError(null)
    try {
      await skipOnboarding()
    } catch (skipError) {
      setError(
        skipError instanceof Error ? skipError.message : 'Onboarding could not be skipped.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFinish = async () => {
    if (isSubmitting) return

    setIsSubmitting(true)
    setError(null)
    try {
      await completeOnboarding({
        useCase,
        defaultMode,
        starterPackId,
        createStarterProject,
        installStarterPrompts,
      })
    } catch (completeError) {
      setError(
        completeError instanceof Error
          ? completeError.message
          : 'Onboarding could not be completed.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (open || isSubmitting) return

    void handleSkip()
  }

  return (
    <Dialog open={isOnboardingOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-4xl overflow-hidden rounded-[28px] border-border/70 bg-background/95 p-0 shadow-2xl shadow-black/40">
        <div className="flex max-h-[92vh] min-h-0 flex-col">
          <DialogHeader className="border-b border-border/70 bg-card/60 px-5 py-5 text-left sm:px-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-2xl tracking-tight">
                  Set up your workspace
                </DialogTitle>
                <DialogDescription className="mt-2 max-w-2xl text-sm leading-6">
                  Choose a starting point, then Zenquanta will create user-owned
                  prompts and preferences without running any AI calls.
                </DialogDescription>
              </div>
              <span className="shrink-0 rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground">
                {progress}
              </span>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
            {currentStep === 0 ? (
              <div className="space-y-5">
                <div>
                  <h3 className="text-lg font-semibold">
                    What are you mainly using Zenquanta for?
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This sets the initial assistant and starter pack.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {ONBOARDING_USE_CASES.map((item) => {
                    const Icon = USE_CASE_ICONS[item.id]
                    const active = item.id === useCase

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => updateUseCase(item.id)}
                        className={cn(
                          'min-h-[128px] rounded-2xl border p-4 text-left transition-colors',
                          active
                            ? 'border-primary bg-primary/10 text-foreground'
                            : 'border-border/70 bg-card/50 hover:border-border hover:bg-card/80'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex size-10 items-center justify-center rounded-xl border border-border/70 bg-background/70">
                            <Icon className="size-4" />
                          </span>
                          <span className="font-semibold">{item.label}</span>
                        </div>
                        <p className="mt-3 text-xs leading-5 text-muted-foreground">
                          {item.description}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {currentStep === 1 ? (
              <div className="space-y-5">
                <div>
                  <h3 className="text-lg font-semibold">
                    Preferred default assistant
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Recommended: {MODE_CONFIGS[selectedRecommendation.defaultMode].name}.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {ONBOARDING_ASSISTANT_MODES.map((mode) => {
                    const config = MODE_CONFIGS[mode]
                    const active = defaultMode === mode

                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setDefaultMode(mode)}
                        className={cn(
                          'min-h-[136px] rounded-2xl border p-4 text-left transition-colors',
                          active
                            ? 'border-primary bg-primary/10'
                            : 'border-border/70 bg-card/50 hover:border-border hover:bg-card/80'
                        )}
