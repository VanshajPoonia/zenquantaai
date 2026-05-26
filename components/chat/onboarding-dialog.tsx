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
