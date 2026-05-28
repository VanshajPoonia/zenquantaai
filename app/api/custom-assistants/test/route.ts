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
import { getAssistantFamilyFromMode } from '@/lib/config/assistants'
import {
  buildCustomAssistantSnapshot,
  normalizeCustomAssistantInput,
} from '@/lib/custom-assistants/validation'
import {
  neonProfilesRepository,
  neonSettingsRepository,
  neonSubscriptionsRepository,
  neonUsageLimitOverridesRepository,
} from '@/lib/db/repositories'
import { estimatePromptTokens } from '@/lib/utils/cost'
import {
  CustomAssistantInput,
  CustomAssistantTestRequest,
  CustomAssistantTestResponse,
  SessionSettings,
  UsageEstimate,
} from '@/types'

export const runtime = 'nodejs'

const TEST_PROMPT_LIMIT = 4_000

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Custom assistant test failed.'
}

function statusForError(message: string): number {
  const lower = message.toLowerCase()

  if (
    lower.includes('plan') ||
    lower.includes('limit') ||
    lower.includes('wallet') ||
    lower.includes('too large') ||
    lower.includes('available for this account') ||
    lower.includes('exhausted') ||
    lower.includes('required') ||
    lower.includes('invalid') ||
    lower.includes('text modes only')
  ) {
    return 400
  }

  return 500
}

function scrubUsageForClient(usage: UsageEstimate): UsageEstimate {
  return {
    ...usage,
    rawCostUsd: 0,
    marginUsd: 0,
  }
}

function buildRequestedSettings(
  assistant: CustomAssistantInput
): Partial<SessionSettings> {
  const defaults = assistant.defaultSettings ?? {}
  const modelOverride =
    assistant.defaultModelOverride ?? defaults.modelOverride ?? 'auto'

  return {
    temperature: defaults.temperature,
    maxTokens: defaults.maxTokens,
    topP: defaults.topP,
    modelOverride,
    webSearch: false,
    memory: false,
    fileContext: false,
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)

  const body = (await request.json().catch(() => null)) as
    | Partial<CustomAssistantTestRequest>
    | null
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''
  const normalized = normalizeCustomAssistantInput(body?.assistant)

  if (!normalized.ok) {
    return NextResponse.json({ error: normalized.error }, { status: 400 })
  }

  if (!prompt) {
    return NextResponse.json(
      { error: 'A test prompt is required.' },
      { status: 400 }
    )
  }

  if (prompt.length > TEST_PROMPT_LIMIT) {
    return NextResponse.json(
      { error: `Test prompt must be ${TEST_PROMPT_LIMIT} characters or less.` },
      { status: 400 }
    )
  }

  const headers = new Headers()
  if (auth.session.refreshed) {
    appendAuthCookies(headers, auth.session)
  }

  try {
    const assistant = normalized.input
    const mode = assistant.baseMode ?? 'general'
    const appSettings = await neonSettingsRepository.get(auth.user.id)
    const subscription = await neonSubscriptionsRepository.ensureForUser(auth.user)
    const override = await neonUsageLimitOverridesRepository.getByUserId(
      auth.user.id
    )
    const effectiveSubscription = getEffectiveSubscription(subscription, override)
    const resolvedSettings = resolveSessionSettings(
      mode,
      buildRequestedSettings(assistant),
      createSessionSettings(mode, appSettings.sessionDefaults)
    )
    const settings = clampSessionSettingsMaxTokens(
      resolvedSettings,
      effectiveSubscription.maxOutputTokensPerRequest
    )
    const routeConfig = resolveModelConfig(
      mode,
      settings.modelOverride,
      subscription.tier
    )
    const allowedModels = getAllowedModelsForTier(subscription.tier)
    const overrideAllowsModel =
      override?.allowedModelOverrides?.includes(routeConfig.model) ?? false

    if (!allowedModels.includes(routeConfig.model) && !overrideAllowsModel) {
      return NextResponse.json(
        { error: 'That assistant profile is not available on your current plan.' },
        { status: 400, headers }
      )
    }

    const customAssistantContext = {
      assistant: buildCustomAssistantSnapshot({
        id: 'draft',
        name: assistant.name,
        description: assistant.description,
        iconEmoji: assistant.iconEmoji ?? '✨',
        color: assistant.color ?? 'general',
        baseMode: mode,
      }),
      systemInstructions: assistant.systemInstructions,
    }
    const prepared = await prepareConversationForChat({
      action: 'send',
      mode,
      content: prompt,
      settings,
    })
    const promptText = buildPromptTextForUsage(
      prepared.generationConversation,
      settings,
      mode,
      undefined,
      undefined,
      customAssistantContext
    )

    enforceTextUsage({
      subscription,
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
      customAssistantContext,
    })) {
      accumulated += chunk
    }

    const content = accumulated.trim() || 'No response returned.'
    const usage = calculateTextUsageEstimate({
      tier: subscription.tier,
      walletType: routeConfig.walletType,
      model: routeConfig.model,
      promptText,
      completionText: content,
    })

    await logTextUsage({
      subscription,
      event: {
        userId: auth.user.id,
        conversationId: null,
        messageId: null,
        assistantFamily: getAssistantFamilyFromMode(mode),
        mode,
        model: routeConfig.model,
        walletType: routeConfig.walletType,
        usage,
      },
    })

    const responseBody: CustomAssistantTestResponse = {
      content,
      mode,
      assistantFamily: getAssistantFamilyFromMode(mode) as Exclude<
        ReturnType<typeof getAssistantFamilyFromMode>,
        'prism'
      >,
      model: routeConfig.model,
      usage: scrubUsageForClient(usage),
    }

    return NextResponse.json(responseBody, { headers })
  } catch (error) {
    const message = toErrorMessage(error)

    return NextResponse.json(
      { error: message },
      { status: statusForError(message), headers }
    )
  }
}
