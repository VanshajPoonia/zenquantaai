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
  neonArtifactsRepository,
  neonProfilesRepository,
  neonSettingsRepository,
  neonSubscriptionsRepository,
  neonUsageLimitOverridesRepository,
} from '@/lib/db/repositories'
import {
  ARTIFACT_ACTION_LABELS,
  ARTIFACT_ACTION_MODES,
  isArtifactActionType,
} from '@/lib/artifacts/actions'
import { estimatePromptTokens } from '@/lib/utils/cost'
import {
  Artifact,
  ArtifactActionRequest,
  ArtifactActionResponse,
  ArtifactActionType,
  UsageEstimate,
} from '@/types'

export const runtime = 'nodejs'

const ARTIFACT_ACTION_CONTENT_LIMIT = 24_000

const ARTIFACT_ACTION_INSTRUCTIONS: Record<ArtifactActionType, string> = {
  improve_writing:
    'Improve clarity, flow, wording, and readability while preserving the original meaning and useful structure.',
  make_shorter:
    'Condense the content substantially while preserving the most important ideas, decisions, and action items.',
  make_more_professional:
    'Rewrite the content with a polished, professional tone while keeping it direct and practical.',
  expand_detail:
    'Expand the content with useful detail, concrete examples, and clearer transitions without inventing facts not implied by the source.',
  turn_into_checklist:
    'Transform the content into a practical checklist with clear sections and actionable checkbox items.',
  turn_into_email:
    'Transform the content into a ready-to-send email with a clear subject line, concise body, and professional close.',
  create_summary:
    'Summarize the content into the essential points, preserving decisions, risks, and next actions where present.',
  find_weaknesses:
    'Analyze the content for weaknesses, gaps, unclear assumptions, missing evidence, and practical fixes.',
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Artifact action failed.'
}

function statusForError(message: string): number {
  const lower = message.toLowerCase()

  if (
    lower.includes('plan') ||
    lower.includes('limit') ||
    lower.includes('wallet') ||
    lower.includes('too large') ||
    lower.includes('available for this account') ||
    lower.includes('exhausted')
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

function buildArtifactActionPrompt(input: {
  artifact: Artifact
  actionType: ArtifactActionType
}): { prompt: string; truncated: boolean } {
  const content = input.artifact.content.trim()
  const boundedContent = content.slice(0, ARTIFACT_ACTION_CONTENT_LIMIT)
  const truncated = boundedContent.length < content.length
  const label = ARTIFACT_ACTION_LABELS[input.actionType]
  const instruction = ARTIFACT_ACTION_INSTRUCTIONS[input.actionType]

  return {
    truncated,
    prompt: [
      'You are transforming a saved Zenquanta artifact for its owner.',
      'Return only the finished artifact content. Do not include process notes, apologies, or commentary about the transformation.',
      truncated
        ? 'The artifact content is truncated for request size; work only from the included content and do not claim to have seen omitted sections.'
        : '',
      '',
      `Action: ${label}`,
      `Instruction: ${instruction}`,
      `Artifact title: ${input.artifact.title}`,
      `Artifact type: ${input.artifact.artifactType}`,
      `Source type: ${input.artifact.sourceType}`,
      '',
      'Artifact content:',
      boundedContent,
    ]
      .filter(Boolean)
      .join('\n'),
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  await neonProfilesRepository.ensureFromAuthUser(auth.user)

  const { id } = await params
  const artifact = await neonArtifactsRepository.get(auth.user.id, id)

  if (!artifact) {
    return NextResponse.json({ error: 'Artifact not found.' }, { status: 404 })
  }

  if (!artifact.content.trim()) {
    return NextResponse.json(
      { error: 'Artifact content is required.' },
      { status: 400 }
    )
  }

  const body = (await request.json().catch(() => null)) as
    | Partial<ArtifactActionRequest>
    | null
  const actionType = body?.actionType

  if (!isArtifactActionType(actionType)) {
    return NextResponse.json(
      { error: 'Artifact action type is invalid.' },
      { status: 400 }
    )
  }

  const headers = new Headers()
  if (auth.session.refreshed) {
    appendAuthCookies(headers, auth.session)
  }

  try {
    const mode = ARTIFACT_ACTION_MODES[actionType]
    const appSettings = await neonSettingsRepository.get(auth.user.id)
    const subscription = await neonSubscriptionsRepository.ensureForUser(auth.user)
    const override = await neonUsageLimitOverridesRepository.getByUserId(
      auth.user.id
    )
    const effectiveSubscription = getEffectiveSubscription(subscription, override)
    const resolvedSettings = resolveSessionSettings(
      mode,
      {
        ...appSettings.sessionDefaults,
        webSearch: false,
        memory: false,
        fileContext: false,
      },
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

    const { prompt, truncated } = buildArtifactActionPrompt({
      artifact,
      actionType,
    })
    const prepared = await prepareConversationForChat({
      action: 'send',
      mode,
      content: prompt,
      settings,
    })
    const promptText = buildPromptTextForUsage(
      prepared.generationConversation,
      settings,
      mode
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
        conversationId: artifact.conversationId ?? null,
        messageId: null,
        assistantFamily: getAssistantFamilyFromMode(mode),
        mode,
        model: routeConfig.model,
        walletType: routeConfig.walletType,
        usage,
      },
    })

    const responseBody: ArtifactActionResponse = {
      artifactId: artifact.id,
      actionType,
      content,
      mode,
      assistantFamily: getAssistantFamilyFromMode(mode),
      model: routeConfig.model,
      usage: scrubUsageForClient(usage),
      truncated,
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
