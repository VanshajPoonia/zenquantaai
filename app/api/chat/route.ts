import { NextRequest, NextResponse } from 'next/server'
import {
  appendAuthCookies,
  requireAuthenticatedUser,
} from '@/lib/auth/session'
import { createSessionSettings, getAllowedModelsForTier, resolveModelConfig } from '@/lib/config'
import {
  neonConversationRepository,
  neonCustomAssistantsRepository,
  neonProfilesRepository,
  neonSettingsRepository,
  neonSubscriptionsRepository,
  neonUsageLimitOverridesRepository,
} from '@/lib/db/repositories'
import { resolveOwnedProjectScope } from '@/lib/security/ownership'
import { buildCustomAssistantSnapshot } from '@/lib/custom-assistants/validation'
import { updateConversationSnapshot } from '@/lib/utils/chat'
import { encodeStreamEvent } from '@/lib/utils/stream'
import { ChatRequest, CustomAssistant, SessionSettings } from '@/types'
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
import {
  buildWebSearchQuery,
  searchWebForContext,
  shouldUseWebSearch,
} from '@/lib/search/web-search'
import {
  linkAttachmentKnowledgeScope,
  retrieveFileKnowledgeContext,
} from '@/lib/rag/retrieval'
import { estimatePromptTokens } from '@/lib/utils/cost'

export const runtime = 'nodejs'

const WORKING_NOTES_TITLE = 'Working notes'

function debugChatRoute(stage: string, details?: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'production') return
  console.debug(`[zenquanta/chat] ${stage}`, details ?? {})
}

function buildWorkingNotes(
  phase:
    | 'searching'
    | 'search-unavailable'
    | 'retrieving-files'
    | 'understanding'
    | 'organizing'
    | 'drafting'
    | 'refining'
    | 'finalizing'
): string[] {
  const textNotes = {
    searching: [
      'Searching the web for current source snippets.',
      'Preparing source context for the response.',
    ],
    'search-unavailable': [
      'Web search was requested, but no source context is available.',
      'Continuing without claiming live verification.',
    ],
    'retrieving-files': [
      'Retrieving relevant excerpts from uploaded files.',
      'Keeping raw files private and using only the most relevant chunks.',
    ],
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

function applyCustomAssistantDefaults(
  settings: Partial<SessionSettings> | undefined,
  assistant: CustomAssistant | null
): Partial<SessionSettings> | undefined {
  if (!assistant) return settings

  const defaultSettings = assistant.defaultSettings
  const toolDefaults = defaultSettings.tools ?? {}
  const fallbackSettings: Partial<SessionSettings> = {
    temperature: defaultSettings.temperature,
    maxTokens: defaultSettings.maxTokens,
    topP: defaultSettings.topP,
    modelOverride:
      assistant.defaultModelOverride ?? defaultSettings.modelOverride ?? 'auto',
    webSearch: toolDefaults.webSearch,
    memory: toolDefaults.memory,
    fileContext: toolDefaults.fileContext,
  }

  return {
    ...fallbackSettings,
    ...settings,
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response
  await neonProfilesRepository.ensureFromAuthUser(auth.user)

  const body = (await request.json().catch(() => null)) as Partial<ChatRequest> | null

  if (!body?.action || !body.mode) {
    return NextResponse.json(
      { error: 'Chat action and mode are required.' },
      { status: 400 }
    )
  }

  const customAssistant = body.customAssistantId
    ? await neonCustomAssistantsRepository.get(auth.user.id, body.customAssistantId)
    : null

  if (body.customAssistantId && (!customAssistant || !customAssistant.isEnabled)) {
    return NextResponse.json(
      { error: 'Custom assistant not found.' },
      { status: 404 }
    )
  }

  const requestMode = customAssistant?.baseMode ?? body.mode

  if (
    body.action === 'generate-image' ||
    requestMode === 'image' ||
    body.targetMode === 'image'
  ) {
    return NextResponse.json(
      { error: 'Prism requests must be sent through /api/images/generate.' },
      { status: 400 }
    )
  }

  const storedConversation = body.conversationId
    ? await neonConversationRepository.get(auth.user.id, body.conversationId)
    : null

  if (body.conversationId && !storedConversation) {
    return NextResponse.json(
      { error: 'Conversation not found.' },
      { status: 404 }
    )
  }

  const projectScope =
    !storedConversation && body.conversation
      ? await resolveOwnedProjectScope(auth.user.id, body.conversation.projectId)
      : { ok: true as const, projectId: null }

  if (!projectScope.ok) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
  }

  const scopedConversation =
    body.conversation && projectScope.projectId
      ? { ...body.conversation, projectId: projectScope.projectId }
      : body.conversation

  const appSettings = await neonSettingsRepository.get(auth.user.id)
  const subscription = await neonSubscriptionsRepository.ensureForUser(auth.user)
  const override = await neonUsageLimitOverridesRepository.getByUserId(auth.user.id)
  const effectiveSubscription = getEffectiveSubscription(subscription, override)
  const requestedSettings = applyCustomAssistantDefaults(
    body.settings,
    customAssistant
  )
  const resolvedSettings = resolveSessionSettings(
    requestMode,
    requestedSettings,
    createSessionSettings(requestMode, appSettings.sessionDefaults)
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
    conversation: storedConversation ?? scopedConversation,
    mode: requestMode,
    targetMode: body.targetMode,
    content: body.content,
    settings,
    targetMessageId: body.targetMessageId,
    attachments: body.attachments,
    attachmentContext: body.attachmentContext,
    customAssistantId: customAssistant?.id ?? null,
  }
  const customAssistantSnapshot = customAssistant
    ? buildCustomAssistantSnapshot(customAssistant)
    : null
  const customAssistantContext =
    customAssistant && customAssistantSnapshot
      ? {
          assistant: customAssistantSnapshot,
          systemInstructions: customAssistant.systemInstructions,
        }
      : undefined

  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  void (async () => {
    let conversationId = storedConversation?.id ?? payload.conversationId
    let messageId: string | undefined

    try {
      const preparedBase = await prepareConversationForChat(payload)
      const prepared =
        customAssistant && customAssistantSnapshot
          ? {
              ...preparedBase,
              conversation: updateConversationSnapshot(preparedBase.conversation, {
                customAssistantId: customAssistant.id,
                customAssistant: customAssistantSnapshot,
                messages: preparedBase.conversation.messages.map((message) =>
                  message.id === preparedBase.userMessage.id
                    ? {
                        ...message,
                        customAssistantId: customAssistant.id,
                        customAssistant: customAssistantSnapshot,
                      }
                    : message
                ),
              }),
              userMessage: {
                ...preparedBase.userMessage,
                customAssistantId: customAssistant.id,
                customAssistant: customAssistantSnapshot,
              },
              generationConversation: updateConversationSnapshot(
                preparedBase.generationConversation,
                {
                  customAssistantId: customAssistant.id,
                  customAssistant: customAssistantSnapshot,
                  messages: preparedBase.generationConversation.messages.map(
                    (message) =>
                      message.id === preparedBase.userMessage.id
                        ? {
                            ...message,
                            customAssistantId: customAssistant.id,
                            customAssistant: customAssistantSnapshot,
                          }
                        : message
                  ),
                }
              ),
              assistantPlaceholder: {
                ...preparedBase.assistantPlaceholder,
                customAssistantId: customAssistant.id,
                customAssistant: customAssistantSnapshot,
              },
            }
          : preparedBase
      const billingMode = prepared.assistantMode
      const routeConfig = resolveModelConfig(
        billingMode,
        payload.settings.modelOverride,
        subscription.tier
      )
      const allowedModels = getAllowedModelsForTier(subscription.tier)

      const overrideAllowsModel =
        override?.allowedModelOverrides?.includes(routeConfig.model) ?? false

      if (!allowedModels.includes(routeConfig.model) && !overrideAllowsModel) {
        throw new Error('That assistant profile is not available on your current plan.')
      }

      const webSearchRequested = shouldUseWebSearch(
        prepared.assistantMode,
        payload.settings
      )
      const webSearchContext = webSearchRequested
        ? await searchWebForContext(buildWebSearchQuery(prepared.userMessage.content))
        : undefined
      const attachmentFileIds = await linkAttachmentKnowledgeScope({
        userId: auth.user.id,
        attachments: prepared.userMessage.attachments,
        projectId: prepared.conversation.projectId,
        conversationId: prepared.conversation.id,
        messageId: prepared.userMessage.id,
      })
      const fileKnowledgeContext = payload.settings.fileContext
        ? await retrieveFileKnowledgeContext({
            userId: auth.user.id,
            query: prepared.userMessage.content,
            projectId: prepared.conversation.projectId,
            conversationId: prepared.conversation.id,
            fileIds: attachmentFileIds,
          })
        : undefined
      const messageSources = [
        ...(webSearchContext?.sources ?? []),
        ...(fileKnowledgeContext?.sources ?? []),
      ]
      const promptText = buildPromptTextForUsage(
        prepared.generationConversation,
        payload.settings,
        billingMode,
        webSearchContext,
        fileKnowledgeContext,
        customAssistantContext
      )

      enforceTextUsage({
        subscription,
        override,
        estimatedPromptTokens: estimatePromptTokens(promptText),
        requestedMaxOutputTokens: payload.settings.maxTokens,
        walletType: routeConfig.walletType,
      })

      const persistedConversation = await neonConversationRepository.save(
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
        customAssistantId: customAssistant?.id ?? null,
        customAssistant: customAssistantSnapshot,
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
          notes:
            fileKnowledgeContext?.sources.length
              ? buildWorkingNotes('retrieving-files')
              : webSearchRequested && webSearchContext?.sources.length
              ? buildWorkingNotes('searching')
              : webSearchRequested
                ? buildWorkingNotes('search-unavailable')
                : buildWorkingNotes('understanding'),
        })
      )

      if (messageSources.length) {
        await writer.write(
          encodeStreamEvent({
            type: 'sources',
            conversationId: persistedConversation.id,
            messageId: placeholder.id,
            sources: messageSources,
          })
        )
      }

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
        webSearchContext,
        fileKnowledgeContext,
        customAssistantContext,
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
          webSearchContext,
          fileKnowledgeContext,
          customAssistantContext,
          sources: messageSources,
        }
      )

      const savedConversation = await neonConversationRepository.save(
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
            sources: savedConversation.messages.at(-1)?.sources,
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
