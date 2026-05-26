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
