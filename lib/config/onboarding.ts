import { AIMode, OnboardingUseCase, StarterPackId } from '@/types'

export const ONBOARDING_VERSION = 1

export const ONBOARDING_USE_CASES: Array<{
  id: OnboardingUseCase
  label: string
  description: string
}> = [
  {
    id: 'school_research',
    label: 'School/research',
    description: 'Study planning, research notes, source synthesis, and structured explanations.',
  },
  {
    id: 'coding',
    label: 'Coding',
    description: 'Debugging, implementation planning, architecture, and technical writing.',
  },
  {
    id: 'business',
    label: 'Business',
    description: 'Founder decisions, strategy, positioning, operations, and weekly reviews.',
  },
  {
    id: 'marketing_content',
    label: 'Marketing/content',
    description: 'Campaigns, content calendars, brand voice, and polished copy.',
  },
  {
    id: 'personal_productivity',
    label: 'Personal productivity',
    description: 'Planning, prioritization, routines, task breakdowns, and daily clarity.',
  },
  {
    id: 'image_generation',
    label: 'Image generation',
    description: 'Prism-first visual ideation, image prompts, and creative direction.',
  },
  {
    id: 'all_in_one',
    label: 'All-in-one workspace',
    description: 'A balanced workspace for projects, writing, analysis, code, and visuals.',
  },
]

export const ONBOARDING_RECOMMENDATIONS: Record<
  OnboardingUseCase,
  { defaultMode: AIMode; starterPackId: StarterPackId }
> = {
  school_research: { defaultMode: 'logic', starterPackId: 'student' },
  coding: { defaultMode: 'code', starterPackId: 'developer' },
  business: { defaultMode: 'logic', starterPackId: 'founder' },
  marketing_content: { defaultMode: 'creative', starterPackId: 'content_creator' },
  personal_productivity: { defaultMode: 'general', starterPackId: 'small_business' },
  image_generation: { defaultMode: 'image', starterPackId: 'content_creator' },
  all_in_one: { defaultMode: 'general', starterPackId: 'agency' },
}

export interface StarterPromptTemplate {
  id: string
  title: string
  content: string
  mode: AIMode | 'any'
}

export interface StarterPack {
  id: StarterPackId
  label: string
  description: string
  projectName: string
  projectDescription: string
  projectColor: AIMode
  prompts: StarterPromptTemplate[]
}

export const STARTER_PACKS: Record<StarterPackId, StarterPack> = {
  student: {
    id: 'student',
    label: 'Student Pack',
