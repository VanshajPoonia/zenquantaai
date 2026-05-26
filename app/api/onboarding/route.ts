import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import {
  createSessionSettings,
  getOnboardingRecommendation,
  getStarterProjectId,
  ONBOARDING_ASSISTANT_MODES,
  ONBOARDING_USE_CASES,
  ONBOARDING_VERSION,
  STARTER_PACKS,
} from '@/lib/config'
import {
  neonProfilesRepository,
  neonProjectsRepository,
  neonPromptsRepository,
  neonSettingsRepository,
} from '@/lib/db/repositories'
import {
  AIMode,
  OnboardingRequest,
  OnboardingResponse,
  OnboardingUseCase,
  StarterPackId,
} from '@/types'

export const runtime = 'nodejs'

const ONBOARDING_USE_CASE_IDS = new Set(
  ONBOARDING_USE_CASES.map((useCase) => useCase.id)
)
const STARTER_PACK_IDS = new Set(Object.keys(STARTER_PACKS) as StarterPackId[])
const ONBOARDING_MODE_IDS = new Set(ONBOARDING_ASSISTANT_MODES)

function isOnboardingUseCase(value: unknown): value is OnboardingUseCase {
  return (
    typeof value === 'string' &&
    ONBOARDING_USE_CASE_IDS.has(value as OnboardingUseCase)
  )
}

function isStarterPackId(value: unknown): value is StarterPackId {
  return typeof value === 'string' && STARTER_PACK_IDS.has(value as StarterPackId)
}

function isOnboardingMode(value: unknown): value is AIMode {
  return typeof value === 'string' && ONBOARDING_MODE_IDS.has(value as AIMode)
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)

  const body = (await request.json().catch(() => null)) as
    | Partial<OnboardingRequest>
    | null

  if (body?.action === 'skip') {
    const now = new Date().toISOString()
    const settings = await neonSettingsRepository.patch(auth.user.id, {
      onboarding: {
        status: 'skipped',
        version: ONBOARDING_VERSION,
        skippedAt: now,
        updatedAt: now,
      },
    })
    const response = NextResponse.json({ settings } satisfies OnboardingResponse)

    if (auth.session.refreshed) {
      appendAuthCookies(response.headers, auth.session)
    }

    return response
  }

  if (body?.action !== 'complete') {
    return NextResponse.json(
      { error: 'Unsupported onboarding action.' },
      { status: 400 }
    )
  }

  if (!isOnboardingUseCase(body.useCase)) {
    return NextResponse.json(
      { error: 'A valid onboarding use case is required.' },
      { status: 400 }
    )
  }

  const recommendation = getOnboardingRecommendation(body.useCase)
  const defaultMode = isOnboardingMode(body.defaultMode)
    ? body.defaultMode
    : recommendation.defaultMode
  const starterPackId = isStarterPackId(body.starterPackId)
    ? body.starterPackId
    : recommendation.starterPackId
  const starterPack = STARTER_PACKS[starterPackId]
  const shouldCreateProject = Boolean(body.createStarterProject)
  const shouldInstallPrompts = Boolean(body.installStarterPrompts)

  const project = shouldCreateProject
    ? await neonProjectsRepository.create(auth.user.id, {
        id: getStarterProjectId(starterPack.id),
        name: starterPack.projectName,
        description: starterPack.projectDescription,
        color: starterPack.projectColor,
      })
    : null

  const prompts = shouldInstallPrompts
    ? await Promise.all(
        starterPack.prompts.map((prompt) =>
          neonPromptsRepository.create(auth.user.id, {
            id: prompt.id,
            title: prompt.title,
            content: prompt.content,
            mode: prompt.mode,
          })
        )
      )
    : []

  const now = new Date().toISOString()
  const settings = await neonSettingsRepository.patch(auth.user.id, {
    defaultMode,
    sessionDefaults: createSessionSettings(defaultMode),
    onboarding: {
      status: 'completed',
      version: ONBOARDING_VERSION,
      useCase: body.useCase,
      defaultMode,
      starterPackId: starterPack.id,
      starterProjectId: project?.id ?? null,
      installedPromptIds: prompts.map((prompt) => prompt.id),
      completedAt: now,
      updatedAt: now,
    },
  })

  const response = NextResponse.json({
    settings,
    project,
    prompts,
  } satisfies OnboardingResponse)

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
