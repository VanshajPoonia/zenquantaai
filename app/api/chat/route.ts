import { NextRequest, NextResponse } from 'next/server'
import {
  appendAuthCookies,
  requireAuthenticatedUser,
} from '@/lib/auth/session'
import { createSessionSettings, getAllowedModelsForTier, resolveModelConfig } from '@/lib/config'
import {
  conversationStore,
  settingsStore,
  subscriptionsStore,
  usageLimitOverridesStore,
} from '@/lib/storage'
import { encodeStreamEvent } from '@/lib/utils/stream'
import { ChatRequest } from '@/types'
import {
  buildPromptTextForUsage,
  clampSessionSettingsMaxTokens,
  completeConversationWithAssistant,
  generateAssistantStream,
  prepareConversationForChat,
  resolveSessionSettings,
} from '@/lib/ai/chat'
import { calculateTextUsageEstimate } from '@/lib/billing/costs'
import { enforceTextUsage, getEffectiveSubscription } from '@/lib/billing/enforce'
import { logTextUsage } from '@/lib/billing/log-usage'
import { getAssistantFamilyFromMode } from '@/lib/config/assistants'
import { estimatePromptTokens } from '@/lib/utils/cost'

export const runtime = 'nodejs'

const WORKING_NOTES_TITLE = 'Working notes'

function debugChatRoute(stage: string, details?: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'production') return
  console.debug(`[zenquanta/chat] ${stage}`, details ?? {})
}

function buildWorkingNotes(
  phase: 'understanding' | 'organizing' | 'drafting' | 'refining' | 'finalizing'
): string[] {
  const textNotes = {
    understanding: [
      'Reading the request and identifying the outcome you are asking for.',
      'Picking the right response shape before drafting the answer.',
    ],
    organizing: [
      'Organizing the answer so the most useful parts come first.',
      'Choosing the level of detail and structure that best fits the task.',
    ],
    drafting: [
      'Drafting the response in the selected assistant style.',
      'Turning the plan into a clear first pass for the final answer.',
    ],
    refining: [
      'Refining wording, clarity, and flow while the response streams.',
      'Tightening the answer so it stays direct and useful.',
    ],
    finalizing: [
      'Finalizing the response and wrapping up the last details.',
      'Preparing the completed answer for the conversation history.',
    ],
  } as const

  return [...textNotes[phase]]
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'An unknown chat error occurred.'
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  const body = (await request.json().catch(() => null)) as Partial<ChatRequest> | null

  if (!body?.action || !body.mode) {
    return NextResponse.json(
      { error: 'Chat action and mode are required.' },
      { status: 400 }
    )
  }

  if (
    body.action === 'generate-image' ||
    body.mode === 'image' ||
    body.targetMode === 'image'
  ) {
    return NextResponse.json(
      { error: 'Prism requests must be sent through /api/images/generate.' },
      { status: 400 }
    )
  }

  const storedConversation = body.conversationId
    ? await conversationStore.get(auth.user.id, body.conversationId)
    : null

  const appSettings = await settingsStore.get(auth.user.id)
  const subscription = await subscriptionsStore.ensureForUser(auth.user)
  const override = await usageLimitOverridesStore.getByUserId(auth.user.id)
  const effectiveSubscription = getEffectiveSubscription(subscription, override)
  const resolvedSettings = resolveSessionSettings(
    body.mode,
    body.settings,
    createSessionSettings(body.mode, appSettings.sessionDefaults)
  )
  const settings = clampSessionSettingsMaxTokens(
    resolvedSettings,
    effectiveSubscription.maxOutputTokensPerRequest
  )

  if (settings.maxTokens !== resolvedSettings.maxTokens) {
    debugChatRoute('settings-clamped', {
      requestedMaxTokens: resolvedSettings.maxTokens,
      appliedMaxTokens: settings.maxTokens,
      tier: effectiveSubscription.tier,
    })
  }

  const payload: ChatRequest = {
    action: body.action,
    conversationId: storedConversation?.id ?? body.conversationId,
    conversation: storedConversation ?? body.conversation,
    mode: body.mode,
    targetMode: body.targetMode,
    content: body.content,
    settings,
    targetMessageId: body.targetMessageId,
    attachments: body.attachments,
    attachmentContext: body.attachmentContext,
  }

  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  void (async () => {
    let conversationId = storedConversation?.id ?? payload.conversationId
    let messageId: string | undefined

    try {
      const prepared = await prepareConversationForChat(payload)
      const billingMode = prepared.assistantMode
      const routeConfig = resolveModelConfig(
        billingMode,
        payload.settings.modelOverride,
        subscription.tier
      )
      const promptText = buildPromptTextForUsage(
        prepared.generationConversation,
        payload.settings,
        billingMode
      )
      const allowedModels = getAllowedModelsForTier(subscription.tier)

      const overrideAllowsModel =
        override?.allowedModelOverrides?.includes(routeConfig.model) ?? false

      if (!allowedModels.includes(routeConfig.model) && !overrideAllowsModel) {
        throw new Error('That assistant profile is not available on your current plan.')
      }

      enforceTextUsage({
        subscription,
        override,
        estimatedPromptTokens: estimatePromptTokens(promptText),
        requestedMaxOutputTokens: payload.settings.maxTokens,
        walletType: routeConfig.walletType,
      })

      const persistedConversation = await conversationStore.save(
        auth.user.id,
        prepared.conversation
      )

      debugChatRoute('request-start', {
        action: payload.action,
        conversationId: persistedConversation.id,
        assistantMode: prepared.assistantMode,
        model: routeConfig.model,
      })

      conversationId = persistedConversation.id
      messageId = prepared.assistantPlaceholder.id
      const placeholder = {
        ...prepared.assistantPlaceholder,
        mode: billingMode,
        model: routeConfig.model,
        assistantFamily: getAssistantFamilyFromMode(billingMode),
      }

      await writer.write(
        encodeStreamEvent({
          type: 'start',
          conversation: persistedConversation,
          message: placeholder,
        })
      )

      await writer.write(
        encodeStreamEvent({
          type: 'working',
          conversationId: persistedConversation.id,
          messageId: placeholder.id,
          title: WORKING_NOTES_TITLE,
          notes: buildWorkingNotes('understanding'),
        })
      )

      await writer.write(
        encodeStreamEvent({
          type: 'working',
          conversationId: persistedConversation.id,
          messageId: placeholder.id,
          title: WORKING_NOTES_TITLE,
          notes: buildWorkingNotes('organizing'),
        })
      )

      let accumulated = ''
      let receivedChunkCount = 0
      let lastWorkingPhase: 'understanding' | 'organizing' | 'drafting' | 'refining' | 'finalizing' =
        'organizing'

      debugChatRoute('provider-stream-start', {
        action: payload.action,
        conversationId: persistedConversation.id,
        messageId: placeholder.id,
        model: routeConfig.model,
      })

      for await (const chunk of generateAssistantStream({
        conversation: prepared.generationConversation,
        settings: payload.settings,
        mode: prepared.assistantMode,
        action: payload.action,
        tier: subscription.tier,
      })) {
        accumulated += chunk
        receivedChunkCount += 1

        if (receivedChunkCount === 1) {
          debugChatRoute('provider-first-chunk', {
            action: payload.action,
            conversationId: persistedConversation.id,
            messageId: placeholder.id,
            model: routeConfig.model,
          })
        }

        await writer.write(
          encodeStreamEvent({
            type: 'delta',
            conversationId: persistedConversation.id,
          messageId: placeholder.id,
          delta: chunk,
        })
      )

        const phase =
          accumulated.length < 80
            ? 'drafting'
              : accumulated.length < 260
              ? 'refining'
              : null

        if (phase && phase !== lastWorkingPhase) {
          lastWorkingPhase = phase
          await writer.write(
            encodeStreamEvent({
              type: 'working',
              conversationId: persistedConversation.id,
              messageId: placeholder.id,
              title: WORKING_NOTES_TITLE,
              notes: buildWorkingNotes(phase),
            })
          )
        }
      }

      await writer.write(
        encodeStreamEvent({
          type: 'working',
          conversationId: persistedConversation.id,
          messageId: placeholder.id,
          title: WORKING_NOTES_TITLE,
          notes: buildWorkingNotes('finalizing'),
        })
      )

      const usage = calculateTextUsageEstimate({
        tier: subscription.tier,
        walletType: routeConfig.walletType,
        model: routeConfig.model,
        promptText,
        completionText: accumulated || 'No response returned.',
      })
      const clientUsage = {
        ...usage,
        rawCostUsd: 0,
        marginUsd: 0,
      }

      const completedConversation = await completeConversationWithAssistant(
        persistedConversation,
        placeholder,
        accumulated || 'No response returned.',
        prepared.generationConversation,
        billingMode,
        {
          action: payload.action,
          userMessage: prepared.userMessage,
          tier: subscription.tier,
          usageOverride: clientUsage,
          modelOverride: routeConfig.model,
        }
      )

      const savedConversation = await conversationStore.save(
        auth.user.id,
        completedConversation
      )

      await logTextUsage({
        subscription,
        event: {
          userId: auth.user.id,
          conversationId: savedConversation.id,
          messageId: savedConversation.messages.at(-1)?.id ?? null,
          assistantFamily: getAssistantFamilyFromMode(billingMode),
          mode: billingMode,
          model: routeConfig.model,
          walletType: routeConfig.walletType,
          usage,
        },
      })

      await writer.write(
        encodeStreamEvent({
          type: 'done',
          conversation: savedConversation,
          message: {
            ...placeholder,
            content: accumulated || 'No response returned.',
            status: 'complete',
            usage: savedConversation.messages.at(-1)?.usage,
          },
          usage: savedConversation.messages.at(-1)?.usage,
        })
      )

      debugChatRoute('done-event-emitted', {
        action: payload.action,
        conversationId: savedConversation.id,
        messageId: savedConversation.messages.at(-1)?.id,
        receivedChunks: receivedChunkCount,
      })

      debugChatRoute('request-success', {
        action: payload.action,
        conversationId: savedConversation.id,
        messageId: savedConversation.messages.at(-1)?.id,
      })
    } catch (error) {
      debugChatRoute('request-failure', {
        action: payload.action,
        conversationId,
        messageId,
        error: toErrorMessage(error),
      })
      await writer.write(
        encodeStreamEvent({
          type: 'error',
          conversationId,
          messageId,
          error: toErrorMessage(error),
          recoverable: true,
        })
      )
      debugChatRoute('error-event-emitted', {
        action: payload.action,
        conversationId,
        messageId,
        error: toErrorMessage(error),
      })
    } finally {
      await writer.close()
    }
  })()

  const headers = new Headers({
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  })

  if (auth.session.refreshed) {
    appendAuthCookies(headers, auth.session)
  }

  return new Response(stream.readable, { headers })
}
