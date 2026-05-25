import { NextRequest, NextResponse } from 'next/server'
import {
  appendAuthCookies,
  requireAuthenticatedUser,
} from '@/lib/auth/session'
import {
  createSessionSettings,
  getAllowedModelsForTier,
  resolveModelConfig,
} from '@/lib/config'
import { getAssistantFamilyFromMode } from '@/lib/config/assistants'
import {
  neonConversationRepository,
  neonModelComparisonsRepository,
  neonProfilesRepository,
  neonSettingsRepository,
  neonSubscriptionsRepository,
  neonUsageLimitOverridesRepository,
} from '@/lib/db/repositories'
import {
  buildPromptTextForUsage,
  clampSessionSettingsMaxTokens,
  generateAssistantStream,
  prepareConversationForChat,
  resolveSessionSettings,
} from '@/lib/ai/chat'
import { calculateTextUsageEstimate } from '@/lib/billing/costs'
import { enforceTextUsage, getEffectiveSubscription } from '@/lib/billing/enforce'
import { logTextUsage } from '@/lib/billing/log-usage'
import {
  buildWebSearchQuery,
  searchWebForContext,
  shouldUseWebSearch,
} from '@/lib/search/web-search'
import { retrieveFileKnowledgeContext } from '@/lib/rag/retrieval'
import { estimatePromptTokens } from '@/lib/utils/cost'
import {
  AIMode,
  MessageSource,
  ModelComparisonCandidate,
  ModelComparisonRequest,
  UsageEstimate,
} from '@/types'

export const runtime = 'nodejs'

const TEXT_COMPARISON_MODES: AIMode[] = [
  'general',
  'creative',
  'logic',
  'code',
  'live',
]
const MAX_COMPARISON_CANDIDATES = 4

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'An unknown model comparison error occurred.'
}

function normalizeTargetModes(input: unknown): AIMode[] {
  const modes = Array.isArray(input) ? input : []
  const unique = new Set<AIMode>()

  for (const mode of modes) {
    if (TEXT_COMPARISON_MODES.includes(mode)) {
      unique.add(mode)
    }
  }

  return [...unique].slice(0, MAX_COMPARISON_CANDIDATES)
}

function scrubUsageForClient(usage: UsageEstimate): UsageEstimate {
  return {
    ...usage,
    rawCostUsd: 0,
    marginUsd: 0,
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response
  await neonProfilesRepository.ensureFromAuthUser(auth.user)

  const body = (await request.json().catch(() => null)) as
    | Partial<ModelComparisonRequest>
    | null
  const content = body?.content?.trim()
  const targetModes = normalizeTargetModes(body?.targetModes)

  if (!content) {
    return NextResponse.json(
      { error: 'Comparison prompt is required.' },
      { status: 400 }
    )
  }

  if (targetModes.length < 2) {
    return NextResponse.json(
      { error: 'Choose at least two text assistants to compare.' },
      { status: 400 }
    )
  }

  const baseMode = TEXT_COMPARISON_MODES.includes(body?.mode as AIMode)
    ? (body?.mode as AIMode)
    : targetModes[0]
  const storedConversation = body?.conversationId
    ? await neonConversationRepository.get(auth.user.id, body.conversationId)
    : null

  if (body?.conversationId && !storedConversation) {
    return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 })
  }

  const appSettings = await neonSettingsRepository.get(auth.user.id)
  const subscription = await neonSubscriptionsRepository.ensureForUser(auth.user)
  const override = await neonUsageLimitOverridesRepository.getByUserId(auth.user.id)
  const allowedModels = getAllowedModelsForTier(subscription.tier)
  const accessibleTargets = targetModes
    .map((mode) => {
      const routeConfig = resolveModelConfig(mode, 'auto', subscription.tier)
      const overrideAllowsModel =
        override?.allowedModelOverrides?.includes(routeConfig.model) ?? false

      return {
        mode,
        routeConfig,
        accessible:
          allowedModels.includes(routeConfig.model) || overrideAllowsModel,
      }
    })
    .filter((target) => target.accessible)

  if (accessibleTargets.length < 2) {
    return NextResponse.json(
      {
        error:
          'Choose at least two assistants available on your current plan.',
      },
      { status: 400 }
    )
  }

  const effectiveSubscription = getEffectiveSubscription(subscription, override)
  const providedSettings = body?.settings
    ? ({
        ...body.settings,
        modelOverride: 'auto',
      } as const)
    : undefined
  const resolvedSettings = resolveSessionSettings(
    baseMode,
    providedSettings,
    createSessionSettings(baseMode, appSettings.sessionDefaults)
  )
  const settings = clampSessionSettingsMaxTokens(
    resolvedSettings,
    effectiveSubscription.maxOutputTokensPerRequest
  )
  const prepared = await prepareConversationForChat({
    action: 'send',
    conversationId: storedConversation?.id ?? body?.conversationId,
    conversation: storedConversation ?? undefined,
    mode: baseMode,
    content,
    settings,
  })
  const persistedConversation = await neonConversationRepository.save(
    auth.user.id,
    prepared.conversation
  )
  const candidates: Array<
    Omit<ModelComparisonCandidate, 'comparisonId' | 'createdAt' | 'updatedAt'>
  > = []

  for (const { mode, routeConfig } of accessibleTargets) {
    const startedAt = Date.now()
    const assistantFamily = getAssistantFamilyFromMode(mode)
    const label = routeConfig.label

    try {
      const webSearchContext = shouldUseWebSearch(mode, settings)
        ? await searchWebForContext(buildWebSearchQuery(content))
        : undefined
      const fileKnowledgeContext = settings.fileContext
        ? await retrieveFileKnowledgeContext({
            userId: auth.user.id,
            query: prepared.userMessage.content,
            projectId: persistedConversation.projectId,
            conversationId: persistedConversation.id,
          })
        : undefined
      const sources: MessageSource[] = [
        ...(webSearchContext?.sources ?? []),
        ...(fileKnowledgeContext?.sources ?? []),
      ]
      const promptText = buildPromptTextForUsage(
        prepared.generationConversation,
        settings,
        mode,
        webSearchContext,
        fileKnowledgeContext
      )
      const latestSubscription = await neonSubscriptionsRepository.ensureForUser(
        auth.user
      )

      enforceTextUsage({
        subscription: latestSubscription,
        override,
        estimatedPromptTokens: estimatePromptTokens(promptText),
        requestedMaxOutputTokens: settings.maxTokens,
        walletType: routeConfig.walletType,
      })

      let accumulated = ''
      for await (const chunk of generateAssistantStream({
        conversation: prepared.generationConversation,
        settings,
        mode,
        action: 'send',
        tier: subscription.tier,
        webSearchContext,
        fileKnowledgeContext,
      })) {
        accumulated += chunk
      }

      const candidateContent = accumulated || 'No response returned.'
      const usage = calculateTextUsageEstimate({
        tier: subscription.tier,
        walletType: routeConfig.walletType,
        model: routeConfig.model,
        promptText,
        completionText: candidateContent,
      })

      await logTextUsage({
        subscription: latestSubscription,
        event: {
          userId: auth.user.id,
          conversationId: persistedConversation.id,
          messageId: null,
          assistantFamily,
          mode,
          model: routeConfig.model,
          walletType: routeConfig.walletType,
          usage,
        },
      })

      candidates.push({
        id: crypto.randomUUID(),
        mode,
        assistantFamily,
        model: routeConfig.model,
        label,
        content: candidateContent,
        status: 'complete',
        error: null,
        latencyMs: Date.now() - startedAt,
        usage: scrubUsageForClient(usage),
        sources,
      })
    } catch (error) {
      candidates.push({
        id: crypto.randomUUID(),
        mode,
        assistantFamily,
        model: routeConfig.model,
        label,
        content: '',
        status: 'error',
        error: toErrorMessage(error),
        latencyMs: Date.now() - startedAt,
        sources: [],
      })
    }
  }

  if (!candidates.some((candidate) => candidate.status === 'complete')) {
    return NextResponse.json(
      {
        error: 'Comparison failed for every selected assistant.',
        candidates,
      },
      { status: 502 }
    )
  }

  const comparison = await neonModelComparisonsRepository.create(auth.user.id, {
    conversationId: persistedConversation.id,
    promptMessageId: prepared.userMessage.id,
    projectId: persistedConversation.projectId,
    prompt: content,
    status: candidates.some((candidate) => candidate.status === 'complete')
      ? 'complete'
      : 'failed',
    settings,
    candidates,
  })
  const response = NextResponse.json({
    comparison,
    conversation: persistedConversation,
  })

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
