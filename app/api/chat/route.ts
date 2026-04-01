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
  completeConversationWithAssistant,
  generateAssistantStream,
  prepareConversationForChat,
  resolveSessionSettings,
} from '@/lib/ai/chat'
import { calculateImageUsageEstimate, calculateTextUsageEstimate } from '@/lib/billing/costs'
import {
  enforceImageUsage,
  enforceTextUsage,
} from '@/lib/billing/enforce'
import { logImageUsage, logTextUsage } from '@/lib/billing/log-usage'
import { getAssistantFamilyFromMode } from '@/lib/config/assistants'
import { estimatePromptTokens } from '@/lib/utils/cost'

export const runtime = 'nodejs'

const WORKING_NOTES_TITLE = 'Working notes'

function debugChatRoute(stage: string, details?: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'production') return
  console.debug(`[zenquanta/chat] ${stage}`, details ?? {})
}

function buildWorkingNotes(
  action: ChatRequest['action'],
  phase: 'understanding' | 'organizing' | 'drafting' | 'refining' | 'finalizing'
): string[] {
  const imageNotes = {
    understanding: [
      'Reading the visual request and identifying the main subject.',
      'Pulling out the style, mood, and composition cues that should shape the image.',
    ],
    organizing: [
      'Translating the prompt into an image-ready direction.',
      'Locking in the details that matter most before generating the visual.',
    ],
    drafting: [
      'Generating the image response now.',
      'Keeping the output aligned with the requested look and subject.',
    ],
    refining: [
      'Checking the generated result for clarity and prompt alignment.',
      'Preparing the image response and usage details for the chat.',
    ],
    finalizing: [
      'Finalizing the image result.',
      'Wrapping up the response so it is ready to view and download.',
    ],
  } as const

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

  const phaseMap = action === 'generate-image' ? imageNotes : textNotes
  return [...phaseMap[phase]]
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

  const appSettings = await settingsStore.get(auth.user.id)
  const settings = resolveSessionSettings(
    body.mode,
    body.settings,
    createSessionSettings(body.mode, appSettings.sessionDefaults)
  )

  const storedConversation = body.conversationId
    ? await conversationStore.get(auth.user.id, body.conversationId)
    : null

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
      const subscription = await subscriptionsStore.ensureForUser(auth.user)
      const override = await usageLimitOverridesStore.getByUserId(auth.user.id)
      const prepared = await prepareConversationForChat(payload)
      const billingMode =
        payload.action === 'generate-image' ? 'image' : prepared.assistantMode
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

      if (payload.action === 'generate-image') {
        const imageUsage = calculateImageUsageEstimate({
          tier: subscription.tier,
          modelConfig: {
            family: 'prism',
            tier: subscription.tier,
            displayName: routeConfig.label,
            model: routeConfig.model,
            rawCostPerImageUsd: routeConfig.imageCostPerUnit ?? 0.035,
            defaultImageCreditsPerImage: 10,
          },
          imageCount: 1,
        })

        enforceImageUsage({
          subscription,
          override,
          imageCount: 1,
          imageCreditsRequired: imageUsage.creditsConsumed ?? 0,
        })
      } else {
        enforceTextUsage({
          subscription,
          override,
          estimatedPromptTokens: estimatePromptTokens(promptText),
          requestedMaxOutputTokens: payload.settings.maxTokens,
          walletType: routeConfig.walletType,
        })
      }

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
          notes: buildWorkingNotes(payload.action, 'understanding'),
        })
      )

      await writer.write(
        encodeStreamEvent({
          type: 'working',
          conversationId: persistedConversation.id,
          messageId: placeholder.id,
          title: WORKING_NOTES_TITLE,
          notes: buildWorkingNotes(payload.action, 'organizing'),
        })
      )

      let accumulated = ''
      let lastWorkingPhase: 'understanding' | 'organizing' | 'drafting' | 'refining' | 'finalizing' =
        'organizing'

      for await (const chunk of generateAssistantStream({
        conversation: prepared.generationConversation,
        settings: payload.settings,
        mode: prepared.assistantMode,
        action: payload.action,
        tier: subscription.tier,
      })) {
        accumulated += chunk

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
              notes: buildWorkingNotes(payload.action, phase),
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
          notes: buildWorkingNotes(payload.action, 'finalizing'),
        })
      )

      const usage =
        payload.action === 'generate-image'
          ? calculateImageUsageEstimate({
              tier: subscription.tier,
              modelConfig: {
                family: 'prism',
                tier: subscription.tier,
                displayName: routeConfig.label,
                model: routeConfig.model,
                rawCostPerImageUsd: routeConfig.imageCostPerUnit ?? 0.035,
                defaultImageCreditsPerImage: 10,
              },
              imageCount: 1,
            })
          : calculateTextUsageEstimate({
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

      if (payload.action === 'generate-image') {
        await logImageUsage({
          subscription,
          event: {
            userId: auth.user.id,
            conversationId: savedConversation.id,
            messageId: savedConversation.messages.at(-1)?.id ?? null,
            assistantFamily: 'prism',
            model: routeConfig.model,
            prompt: prepared.userMessage.content,
            negativePrompt: null,
            size: null,
            aspectRatio: null,
            imageCount: 1,
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
      } else {
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
      }

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
          displayedUsageMessage:
            payload.action === 'generate-image'
              ? `Used ${usage.creditsConsumed ?? 0} image credits.`
              : undefined,
        })
      )

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
