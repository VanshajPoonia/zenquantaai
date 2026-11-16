import { NextRequest, NextResponse } from 'next/server'
import {
  appendAuthCookies,
  requireAuthenticatedUser,
} from '@/lib/auth/session'
import {
  AGENT_PLAN_LIMITS,
  createSessionSettings,
  getAllowedModelsForTier,
  isModelOverrideOption,
  resolveModelConfig,
  WEB_AGENT_MAX_STEPS,
} from '@/lib/config'
import {
  neonAgentRunsRepository,
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
import { ChatRequest, CustomAssistant, MessageSource, SessionSettings } from '@/types'
import {
  buildAgentPromptParts,
  buildPromptTextForUsage,
  clampSessionSettingsMaxTokens,
  completeConversationWithAssistant,
  generateAssistantStream,
  prepareConversationForChat,
  resolveSessionSettings,
} from '@/lib/ai/chat'
import { maybeUpdateRollingSummary } from '@/lib/ai/memory-summary'
import { maybeExtractDurableMemories } from '@/lib/ai/memory-extraction'
import { retrieveDurableMemoryContext } from '@/lib/ai/memory-retrieval'
import { retrieveCrossChatContext } from '@/lib/ai/cross-chat-recall'
import { calculateTextUsageEstimate } from '@/lib/billing/costs'
import { enforceTextUsage, getEffectiveSubscription } from '@/lib/billing/enforce'
import { recordTextUsageEvent } from '@/lib/billing/log-usage'
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
import { hasOpenRouterConfig } from '@/lib/ai/openrouter'
import { isAgentLoopEnabledFor } from '@/lib/agent/flags'
import { AgentMeter, buildStepUsageEstimate } from '@/lib/agent/metering'
import { runAgentTurn } from '@/lib/agent/runtime'
import { createServerTools, getToolNamesForMode } from '@/lib/agent/tools'

export const runtime = 'nodejs'
export const maxDuration = 300

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

  if (typeof body.responseModelOverride !== 'undefined') {
    if (body.action !== 'regenerate') {
      return NextResponse.json(
        {
          error:
            'A response intelligence override is only supported when regenerating a response.',
        },
        { status: 400 }
      )
    }

    if (!isModelOverrideOption(body.responseModelOverride)) {
      return NextResponse.json(
        { error: 'Invalid intelligence level.' },
        { status: 400 }
      )
    }
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
    ? await neonConversationRepository.get(auth.user.id, body.conversationId, {
        messageLimit: 80,
      })
    : null

  if (body.conversationId && !storedConversation && !body.conversation) {
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
    responseModelOverride: body.responseModelOverride,
    targetMessageId: body.targetMessageId,
    attachments: body.attachments,
    attachmentContext: body.attachmentContext,
    customAssistantId: customAssistant?.id ?? null,
    timeZone: body.timeZone,
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
    let accumulated = ''
    let persistedMessageSources: MessageSource[] = []
    let textUsageReservation: {
      walletType: 'core_tokens' | 'tier_tokens'
      reservedTokens: number
    } | null = null
    let agentRunId: string | null = null

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
        prepared.responseSettings.modelOverride,
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
      // A new chat is not saved until saveTurnStart, so its files are linked
      // to the conversation only after that (the conversation id is a foreign key).
      const conversationSaved = Boolean(storedConversation)
      const attachmentFileIds = await linkAttachmentKnowledgeScope({
        userId: auth.user.id,
        attachments: prepared.userMessage.attachments,
        projectId: prepared.conversation.projectId,
        conversationId: conversationSaved ? prepared.conversation.id : null,
        messageId: conversationSaved ? prepared.userMessage.id : null,
      })
      const linkFilesToSavedConversation = async (savedConversationId: string) => {
        if (conversationSaved || attachmentFileIds.length === 0) return
        await linkAttachmentKnowledgeScope({
          userId: auth.user.id,
          attachments: prepared.userMessage.attachments,
          projectId: prepared.conversation.projectId,
          conversationId: savedConversationId,
          messageId: prepared.userMessage.id,
        })
      }
      const fileKnowledgeContext = payload.settings.fileContext
        ? await retrieveFileKnowledgeContext({
            userId: auth.user.id,
            query: prepared.userMessage.content,
            projectId: prepared.conversation.projectId,
            conversationId: prepared.conversation.id,
            fileIds: attachmentFileIds,
          })
        : undefined
      // Context Engine Phase 3 read path: pull durable cross-chat memory for
      // this turn. No-ops (returns undefined) unless MEMORY_EXTRACTION is on and
      // the conversation has memory enabled; never throws.
      const durableMemoryContext = payload.settings.memory
        ? await retrieveDurableMemoryContext({
            userId: auth.user.id,
            query: prepared.userMessage.content,
            projectId: prepared.conversation.projectId,
          })
        : undefined
      // Context Engine Phase 4 read path: recall the user's other conversations
      // relevant to this turn. No-ops (undefined) unless CROSS_CHAT_RECALL is on,
      // embeddings are configured, and this conversation has memory enabled.
      const crossChatContext = payload.settings.memory
        ? await retrieveCrossChatContext({
            userId: auth.user.id,
            query: prepared.userMessage.content,
            currentConversationId: prepared.conversation.id,
          })
        : undefined
      const messageSources: MessageSource[] = [
        ...(webSearchContext?.sources ?? []),
        ...(fileKnowledgeContext?.sources ?? []),
      ]
      persistedMessageSources = messageSources
      const promptText = buildPromptTextForUsage(
        prepared.generationConversation,
        prepared.responseSettings,
        billingMode,
        webSearchContext,
        fileKnowledgeContext,
        customAssistantContext,
        durableMemoryContext,
        crossChatContext,
        payload.timeZone
      )

      const estimatedPromptTokens = estimatePromptTokens(promptText)

      const useAgentLoop =
        isAgentLoopEnabledFor(auth.user) &&
        hasOpenRouterConfig() &&
        getToolNamesForMode(prepared.assistantMode).length > 0

      if (useAgentLoop) {
        const agentLimits = AGENT_PLAN_LIMITS[subscription.tier]
        const agentMaxSteps = Math.min(WEB_AGENT_MAX_STEPS, agentLimits.maxStepsPerRun)
        const agentWallet: 'core_tokens' | 'tier_tokens' =
          routeConfig.walletType === 'tier_tokens' ? 'tier_tokens' : 'core_tokens'
        const placeholder = {
          ...prepared.assistantPlaceholder,
          mode: billingMode,
          model: routeConfig.model,
          assistantFamily: getAssistantFamilyFromMode(billingMode),
          customAssistantId: customAssistant?.id ?? null,
          customAssistant: customAssistantSnapshot,
        }
        const persistedConversation = await neonConversationRepository.saveTurnStart(
          auth.user.id,
          {
            conversation: prepared.conversation,
            userMessage: prepared.userMessage,
            assistantPlaceholder: placeholder,
            action: payload.action,
          }
        )
        conversationId = persistedConversation.id
        messageId = placeholder.id
        await linkFilesToSavedConversation(persistedConversation.id)

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
            notes: webSearchRequested && webSearchContext?.sources.length
              ? buildWorkingNotes('searching')
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

        const agentRun = await neonAgentRunsRepository.create({
          userId: auth.user.id,
          conversationId: persistedConversation.id,
          surface: 'web',
        })
        agentRunId = agentRun.id
        const meter = new AgentMeter({
          userId: auth.user.id,
          tier: subscription.tier,
          walletType: agentWallet,
          effectiveIncluded:
            agentWallet === 'tier_tokens'
              ? effectiveSubscription.tierTokensIncluded
              : effectiveSubscription.coreTokensIncluded,
          limits: agentLimits,
          maxSteps: agentMaxSteps,
          maxOutputTokens: agentLimits.maxAgentOutputTokens,
          surface: 'web',
          runId: agentRun.id,
          dailyMessageLimit: effectiveSubscription.dailyMessageLimit,
          event: {
            conversationId: persistedConversation.id,
            messageId: placeholder.id,
            assistantFamily: getAssistantFamilyFromMode(billingMode),
            mode: billingMode,
            model: routeConfig.model,
          },
        })
        const promptParts = buildAgentPromptParts(
          prepared.generationConversation,
          prepared.responseSettings,
          prepared.assistantMode,
          webSearchContext,
          fileKnowledgeContext,
          customAssistantContext,
          durableMemoryContext,
          crossChatContext,
          payload.timeZone
        )
        let nextSourceId = messageSources.length
        const tools = createServerTools({
          userId: auth.user.id,
          conversationId: persistedConversation.id,
          messageId: placeholder.id,
          projectId: persistedConversation.projectId,
          mode: prepared.assistantMode,
          nextSourceId: () => String(++nextSourceId),
        })

        const attachedNames = (prepared.userMessage.attachments ?? [])
          .map((attachment) => attachment.name)
          .filter(Boolean)
        const canSearchFiles = tools.some((tool) => tool.name === 'files_search')
        const turn = runAgentTurn({
          ...promptParts,
          userContent:
            attachedNames.length && canSearchFiles && !prepared.responseSettings.fileContext
              ? `${promptParts.userContent}\n\n[Attached files: ${attachedNames.join(', ')}. Use files_search to read them.]`
              : promptParts.userContent,
          modelId: routeConfig.model,
          temperature: prepared.responseSettings.temperature,
          maxOutputTokens: agentLimits.maxAgentOutputTokens,
          maxSteps: agentMaxSteps,
          tools,
          sessionId: persistedConversation.id,
          meter,
          signal: request.signal,
        })

        let turnResult: Awaited<ReturnType<typeof turn.next>>['value'] | undefined
        while (true) {
          const next = await turn.next()
          if (next.done) {
            turnResult = next.value
            break
          }
          const event = next.value
          if (event.type === 'text') {
            accumulated += event.delta
            await writer.write(
              encodeStreamEvent({
                type: 'delta',
                conversationId: persistedConversation.id,
                messageId: placeholder.id,
                delta: event.delta,
              })
            )
          } else if (event.type === 'step') {
            await writer.write(
              encodeStreamEvent({
                type: 'step',
                conversationId: persistedConversation.id,
                messageId: placeholder.id,
                step: event.step,
                maxSteps: event.maxSteps,
              })
            )
          } else if (event.type === 'tool_call') {
            await writer.write(
              encodeStreamEvent({
                type: 'tool_call',
                conversationId: persistedConversation.id,
                messageId: placeholder.id,
                callId: event.callId,
                name: event.name,
                label: event.label,
                args: event.args,
              })
            )
          } else {
            if (event.sources?.length) {
              messageSources.push(...event.sources)
              persistedMessageSources = messageSources
            }
            await writer.write(
              encodeStreamEvent({
                type: 'tool_result',
                conversationId: persistedConversation.id,
                messageId: placeholder.id,
                callId: event.callId,
                name: event.name,
                ok: event.ok,
                summary: event.summary,
                sources: event.sources,
                data: event.data,
              })
            )
          }
        }

        const agentUsage =
          meter.totalUsage ??
          buildStepUsageEstimate({
            tier: subscription.tier,
            walletType: agentWallet,
            usage: {
              inputTokens: 0,
              outputTokens: 0,
              cacheReadTokens: 0,
              cacheWriteTokens: 0,
              rawCostUsd: 0,
              costFromProvider: false,
            },
          })
        const finalText = turnResult?.text || accumulated || 'No response returned.'
        const completedConversation = await completeConversationWithAssistant(
          persistedConversation,
          placeholder,
          finalText,
          prepared.generationConversation,
          billingMode,
          {
            action: payload.action,
            userMessage: prepared.userMessage,
            tier: subscription.tier,
            usageOverride: { ...agentUsage, rawCostUsd: 0, marginUsd: 0 },
            modelOverride: routeConfig.model,
            webSearchContext,
            fileKnowledgeContext,
            customAssistantContext,
            durableMemoryContext,
            crossChatContext,
            timeZone: payload.timeZone,
            sources: messageSources,
            responseSettings: prepared.responseSettings,
          }
        )
        const assistantMessage =
          completedConversation.messages.find((message) => message.id === placeholder.id) ??
          placeholder
        assistantMessage.parts = turnResult?.parts ?? []
        const savedConversation = await neonConversationRepository.saveAssistantCompletion(
          auth.user.id,
          completedConversation,
          assistantMessage
        )
        await neonAgentRunsRepository.finish({
          userId: auth.user.id,
          runId: agentRun.id,
          status: 'completed',
        })
        agentRunId = null

        const savedMessage = savedConversation.messages.at(-1)
        await writer.write(
          encodeStreamEvent({
            type: 'done',
            conversation: savedConversation,
            message: {
              ...placeholder,
              content: finalText,
              status: 'complete',
              usage: savedMessage?.usage,
              sources: savedMessage?.sources,
              parts: savedMessage?.parts ?? assistantMessage.parts,
            },
            usage: savedMessage?.usage,
          })
        )

        await maybeUpdateRollingSummary({
          userId: auth.user.id,
          conversation: savedConversation,
          settings: payload.settings,
        })
        await maybeExtractDurableMemories({
          userId: auth.user.id,
          conversation: savedConversation,
          settings: payload.settings,
        })
        return
      }

      // Fast, specific error messages for the common case (checked against a
      // point-in-time snapshot). The atomic reservation below is the real
      // gate: it re-checks the live row so concurrent requests from the same
      // user can't all pass a stale check and blow past their limit.
      enforceTextUsage({
        subscription,
        override,
        estimatedPromptTokens,
        requestedMaxOutputTokens: prepared.responseSettings.maxTokens,
        walletType: routeConfig.walletType,
      })

      const reservationWalletType: 'core_tokens' | 'tier_tokens' =
        routeConfig.walletType === 'tier_tokens' ? 'tier_tokens' : 'core_tokens'
      const reservedTokens =
        estimatedPromptTokens + prepared.responseSettings.maxTokens

      const reservedSubscription = await neonSubscriptionsRepository.reserveTextUsage({
        userId: auth.user.id,
        walletType: reservationWalletType,
        estimatedTokens: reservedTokens,
        effectiveIncluded:
          reservationWalletType === 'tier_tokens'
            ? effectiveSubscription.tierTokensIncluded
            : effectiveSubscription.coreTokensIncluded,
        effectiveDailyMessageLimit: effectiveSubscription.dailyMessageLimit,
      })

      if (!reservedSubscription) {
        throw new Error('You have reached your usage limit for this plan. Please try again shortly.')
      }

      textUsageReservation = {
        walletType: reservationWalletType,
        reservedTokens,
      }

      const placeholder = {
        ...prepared.assistantPlaceholder,
        mode: billingMode,
        model: routeConfig.model,
        assistantFamily: getAssistantFamilyFromMode(billingMode),
        customAssistantId: customAssistant?.id ?? null,
        customAssistant: customAssistantSnapshot,
      }
      const persistedConversation = await neonConversationRepository.saveTurnStart(
        auth.user.id,
        {
          conversation: prepared.conversation,
          userMessage: prepared.userMessage,
          assistantPlaceholder: placeholder,
          action: payload.action,
        }
      )

      debugChatRoute('request-start', {
        action: payload.action,
        conversationId: persistedConversation.id,
        assistantMode: prepared.assistantMode,
        model: routeConfig.model,
      })

      conversationId = persistedConversation.id
      messageId = placeholder.id
      await linkFilesToSavedConversation(persistedConversation.id)

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
        settings: prepared.responseSettings,
        mode: prepared.assistantMode,
        action: payload.action,
        tier: subscription.tier,
        webSearchContext,
        fileKnowledgeContext,
        customAssistantContext,
        durableMemoryContext,
        crossChatContext,
        timeZone: payload.timeZone,
        signal: request.signal,
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
          durableMemoryContext,
          crossChatContext,
          timeZone: payload.timeZone,
          sources: messageSources,
          responseSettings: prepared.responseSettings,
        }
      )

      const savedConversation = await neonConversationRepository.saveAssistantCompletion(
        auth.user.id,
        completedConversation,
        completedConversation.messages.find((message) => message.id === placeholder.id) ??
          placeholder
      )

      const finalizedSubscription = await neonSubscriptionsRepository.finalizeTextUsage({
        userId: auth.user.id,
        walletType: textUsageReservation.walletType,
        reservedTokens: textUsageReservation.reservedTokens,
        actualTokens: usage.totalTokens,
      })
      textUsageReservation = null

      await recordTextUsageEvent({
        subscriptionId: finalizedSubscription.id,
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

      // Context Engine Phases 1 & 3: refresh the rolling summary and run the
      // durable-memory write gate off the critical path — the response has
      // already fully streamed. Both never throw and no-op unless their flag and
      // the conversation's memory setting are enabled.
      await maybeUpdateRollingSummary({
        userId: auth.user.id,
        conversation: savedConversation,
        settings: payload.settings,
      })
      await maybeExtractDurableMemories({
        userId: auth.user.id,
        conversation: savedConversation,
        settings: payload.settings,
      })
    } catch (error) {
      if (agentRunId) {
        await neonAgentRunsRepository
          .finish({
            userId: auth.user.id,
            runId: agentRunId,
            status: request.signal.aborted ? 'stopped' : 'failed',
          })
          .catch((finishError) => {
            console.error('Failed to close the agent run.', finishError)
          })
      }
      if (textUsageReservation) {
        await neonSubscriptionsRepository
          .releaseTextUsage({
            userId: auth.user.id,
            walletType: textUsageReservation.walletType,
            reservedTokens: textUsageReservation.reservedTokens,
          })
          .catch((releaseError) => {
            console.error('Failed to release text usage reservation.', releaseError)
          })
        textUsageReservation = null
      }

      const errorMessage = request.signal.aborted
        ? 'Generation stopped.'
        : toErrorMessage(error)
      if (conversationId && messageId) {
        await neonConversationRepository.markAssistantMessageError(auth.user.id, {
          conversationId,
          messageId,
          content: accumulated,
          error: errorMessage,
          sources: persistedMessageSources,
        })
      }
      debugChatRoute('request-failure', {
        action: payload.action,
        conversationId,
        messageId,
        error: errorMessage,
      })
      await writer.write(
        encodeStreamEvent({
          type: 'error',
          conversationId,
          messageId,
          error: errorMessage,
          recoverable: true,
        })
      )
      debugChatRoute('error-event-emitted', {
        action: payload.action,
        conversationId,
        messageId,
        error: errorMessage,
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
