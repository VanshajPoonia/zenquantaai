import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import { createSessionSettings, resolveModelConfig } from '@/lib/config'
import {
  completeConversationWithAssistant,
  generateImageFromPrompt,
  prepareConversationForChat,
  resolveSessionSettings,
} from '@/lib/ai/chat'
import { calculateImageUsageEstimate } from '@/lib/billing/costs'
import { enforceImageUsage } from '@/lib/billing/enforce'
import { logImageUsage } from '@/lib/billing/log-usage'
import { settingsStore, subscriptionsStore, usageLimitOverridesStore, conversationStore } from '@/lib/storage'
import { createMessage } from '@/lib/utils/chat'
import { ImageGenerateRequest, ImageGenerateResponse, ChatRequest } from '@/types'

export const runtime = 'nodejs'

const IMAGE_ACTIONS = new Set([
  'send',
  'regenerate',
  'retry',
  'edit-last-user',
  'ask-another-mode',
])

function debugImageRoute(stage: string, details?: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'production') return
  console.debug(`[zenquanta/images] ${stage}`, details ?? {})
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  const body = (await request.json().catch(() => null)) as Partial<ImageGenerateRequest> | null
  const action = body?.action ?? 'send'

  if (!IMAGE_ACTIONS.has(action)) {
    return NextResponse.json({ error: 'Unsupported image action.' }, { status: 400 })
  }

  const storedConversation = body?.conversationId
    ? await conversationStore.get(auth.user.id, body.conversationId)
    : null

  const appSettings = await settingsStore.get(auth.user.id)
  const requestMode = body?.targetMode === 'image' ? 'image' : body?.mode ?? 'image'
  const settings = resolveSessionSettings(
    requestMode,
    body?.settings,
    createSessionSettings(requestMode, appSettings.sessionDefaults)
  )

  const payload: ChatRequest = {
    action,
    conversationId: storedConversation?.id ?? body?.conversationId,
    conversation: storedConversation ?? body?.conversation,
    mode: body?.mode ?? 'image',
    targetMode: body?.targetMode,
    content: body?.prompt ?? body?.content,
    settings,
    targetMessageId: body?.targetMessageId,
    attachments: body?.attachments,
    attachmentContext: undefined,
  }

  const prepared = await prepareConversationForChat(payload)

  if (prepared.assistantMode !== 'image') {
    return NextResponse.json(
      { error: 'This request does not resolve to Prism image generation.' },
      { status: 400 }
    )
  }

  if ((action === 'send' || action === 'edit-last-user') && !prepared.userMessage.content.trim()) {
    return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 })
  }

  const subscription = await subscriptionsStore.ensureForUser(auth.user)
  const override = await usageLimitOverridesStore.getByUserId(auth.user.id)
  const imageCount = Math.max(1, Math.min(body?.imageCount ?? 1, 1))
  const routeConfig = resolveModelConfig('image', settings.modelOverride, subscription.tier)
  const usage = calculateImageUsageEstimate({
    tier: subscription.tier,
    modelConfig: {
      family: 'prism',
      tier: subscription.tier,
      displayName: routeConfig.label,
      model: routeConfig.model,
      rawCostPerImageUsd: routeConfig.imageCostPerUnit ?? 0.035,
      defaultImageCreditsPerImage: 10,
    },
    imageCount,
  })

  enforceImageUsage({
    subscription,
    override,
    imageCount,
    imageCreditsRequired: usage.creditsConsumed ?? 0,
  })

  debugImageRoute('request-start', {
    action,
    conversationId: payload.conversationId,
    assistantMode: prepared.assistantMode,
    model: routeConfig.model,
  })

  const persistedConversation = await conversationStore.save(
    auth.user.id,
    prepared.conversation
  )

  const placeholder = {
    ...prepared.assistantPlaceholder,
    mode: 'image' as const,
    model: routeConfig.model,
  }

  const generated = await generateImageFromPrompt({
    prompt: prepared.userMessage.content,
    mode: 'image',
    settings,
    model: routeConfig.model,
  })

  const clientUsage = {
    ...usage,
    rawCostUsd: 0,
    marginUsd: 0,
  }

  const completedConversation = await completeConversationWithAssistant(
    persistedConversation,
    placeholder,
    generated.content || 'Created a visual concept based on your prompt.',
    prepared.generationConversation,
    'image',
    {
      action: 'generate-image',
      userMessage: prepared.userMessage,
      tier: subscription.tier,
      usageOverride: clientUsage,
      modelOverride: routeConfig.model,
      generatedImageResultOverride: generated,
    }
  )

  const savedConversation = await conversationStore.save(
    auth.user.id,
    completedConversation
  )

  await logImageUsage({
    subscription,
    event: {
      userId: auth.user.id,
      conversationId: savedConversation.id,
      messageId: savedConversation.messages.at(-1)?.id ?? null,
      assistantFamily: 'prism',
      model: routeConfig.model,
      prompt: prepared.userMessage.content,
      negativePrompt: body?.negativePrompt ?? null,
      size: body?.size ?? null,
      aspectRatio: body?.aspectRatio ?? null,
      imageCount,
      imageCreditsConsumed: usage.creditsConsumed ?? 0,
      rawCostUsd: usage.rawCostUsd,
      displayedCostUsd: usage.displayedCostUsd,
      displayMultiplier: usage.displayMultiplier,
      marginUsd: usage.marginUsd,
      outputUrls:
        savedConversation.messages
          .at(-1)
          ?.attachments?.map((attachment) => attachment.previewUrl)
          .filter((value): value is string => Boolean(value)) ?? [],
    },
  })

  debugImageRoute('request-success', {
    conversationId: savedConversation.id,
    messageId: savedConversation.messages.at(-1)?.id,
  })

  const headers = new Headers()
  if (auth.session.refreshed) {
    appendAuthCookies(headers, auth.session)
  }

  const response: ImageGenerateResponse = {
    conversation: savedConversation,
    message:
      savedConversation.messages.at(-1) ??
      createMessage({
        role: 'assistant',
        content: generated.content || 'Created a visual concept based on your prompt.',
        mode: 'image',
      }),
    usage: savedConversation.messages.at(-1)?.usage,
    displayedUsageMessage: `Used ${usage.creditsConsumed ?? 0} image credits.`,
  }

  return NextResponse.json(response, { headers })
}
