'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AIMode,
  Attachment,
  AssistantRecommendationResult,
  PendingAttachment,
  RecommendationOutcome,
} from '@/types'
import { useChatContext } from '@/lib/chat-context'
import { getAssistantRecommendation } from '@/lib/router/assistantRecommendation'
import { debugSendPipeline } from '@/lib/chat/sendMessage'

type SubmissionInput = {
  content: string
  attachments?: Array<Attachment | PendingAttachment>
  kind?: 'chat' | 'image'
  modeOverride?: AIMode
}

type DraftRecommendation = {
  recommendation: AssistantRecommendationResult
  submissionKey: string
}

function getSubmissionKey(input: SubmissionInput, currentMode: AIMode): string {
  return JSON.stringify({
    content: input.content.trim(),
    kind: input.kind ?? 'chat',
    currentMode,
    attachments: (input.attachments ?? []).map((attachment) => ({
      name: attachment.name,
      kind: attachment.kind,
    })),
  })
}

export function usePromptPrecheck(input: {
  draft?: SubmissionInput
  onContinue: (submission: SubmissionInput) => Promise<void>
  onSubmitted?: (submission: SubmissionInput) => void
}) {
  const {
    currentMode,
    currentChat,
    appSettings,
    setCurrentMode,
    beginPromptPrecheck,
    awaitRecommendationDecision,
    clearPromptPrecheck,
  } = useChatContext()
  const [pendingRecommendation, setPendingRecommendation] = useState<{
    submission: SubmissionInput
    recommendation: AssistantRecommendationResult
    submissionKey: string
  } | null>(null)
  const [draftRecommendation, setDraftRecommendation] =
    useState<DraftRecommendation | null>(null)
  const [suppressForMessage, setSuppressForMessage] = useState(false)
  const [suppressedSubmissionKey, setSuppressedSubmissionKey] = useState<string | null>(
    null
  )
  const shownDraftRecommendationKeysRef = useRef<Set<string>>(new Set())

  const logRecommendationEvent = useCallback(
    async (
      recommendation: AssistantRecommendationResult,
      outcome: RecommendationOutcome,
      conversationId?: string
    ) => {
      try {
        await fetch('/api/assistant-recommendations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conversationId: conversationId ?? null,
            currentAssistant: recommendation.currentAssistant,
            recommendedAssistant: recommendation.predictedAssistant,
            confidence: recommendation.confidence,
            matchedSignals: recommendation.matchedSignals,
            reason: recommendation.reason,
            outcome,
          }),
          cache: 'no-store',
        })
      } catch (error) {
        console.error('Failed to log assistant recommendation event.', error)
      }
    },
    []
  )

  const clearPendingRecommendation = useCallback(() => {
    setPendingRecommendation(null)
    setSuppressForMessage(false)
  }, [])

  useEffect(() => {
    const draft = input.draft
    const content = draft?.content.trim() ?? ''
    const attachments = draft?.attachments ?? []

    if (
      pendingRecommendation ||
      !appSettings.assistantRecommendations.enabled ||
      (!content && attachments.length === 0)
    ) {
      setDraftRecommendation(null)
      return
    }

    const timeout = window.setTimeout(() => {
      const submission: SubmissionInput = {
        content,
        attachments,
        kind: draft?.kind ?? 'chat',
      }
      const submissionKey = getSubmissionKey(submission, currentMode)

      if (suppressedSubmissionKey === submissionKey) {
        setDraftRecommendation(null)
        return
      }

      const recommendation = getAssistantRecommendation({
        prompt: content,
        currentMode,
        kind: draft?.kind,
        attachments: attachments.map((attachment) => ({
          name: attachment.name,
          kind: attachment.kind,
          previewUrl: attachment.previewUrl,
        })),
      })

      if (!recommendation.shouldRecommendSwitch) {
        setDraftRecommendation(null)
        return
      }

      setDraftRecommendation((previous) =>
        previous?.submissionKey === submissionKey
          ? previous
          : {
              recommendation,
              submissionKey,
            }
      )
    }, 350)

    return () => window.clearTimeout(timeout)
  }, [
    appSettings.assistantRecommendations.enabled,
    currentMode,
    input.draft,
    pendingRecommendation,
    suppressedSubmissionKey,
  ])

  useEffect(() => {
    if (!draftRecommendation) return
    if (shownDraftRecommendationKeysRef.current.has(draftRecommendation.submissionKey)) {
      return
    }

    shownDraftRecommendationKeysRef.current.add(draftRecommendation.submissionKey)
    void logRecommendationEvent(
      draftRecommendation.recommendation,
      'shown',
      currentChat?.id
    )
  }, [currentChat?.id, draftRecommendation, logRecommendationEvent])

  const continueWithSubmission = useCallback(
    async (submission: SubmissionInput) => {
      clearPromptPrecheck()
      debugSendPipeline('submission-approved', {
        kind: submission.kind ?? 'chat',
        modeOverride: submission.modeOverride ?? null,
      })

      try {
        await input.onContinue(submission)
        debugSendPipeline('submission-dispatched', {
          kind: submission.kind ?? 'chat',
          modeOverride: submission.modeOverride ?? null,
        })
        setSuppressedSubmissionKey(null)
        input.onSubmitted?.(submission)
      } catch (error) {
        debugSendPipeline('submission-dispatch-failed', {
          kind: submission.kind ?? 'chat',
          modeOverride: submission.modeOverride ?? null,
          error: error instanceof Error ? error.message : 'Unknown submission error',
        })
        throw error
      }
    },
    [clearPromptPrecheck, input]
  )

  const precheckAndSend = useCallback(
    async (submission: SubmissionInput) => {
      beginPromptPrecheck()

      try {
        const submissionKey = getSubmissionKey(submission, currentMode)
        const recommendation = getAssistantRecommendation({
          prompt: submission.content,
          currentMode,
          kind: submission.kind,
          attachments: (submission.attachments ?? []).map((attachment) => ({
            name: attachment.name,
            kind: attachment.kind,
            previewUrl: attachment.previewUrl,
          })),
        })

        debugSendPipeline('precheck-result', {
          currentMode,
          predictedAssistant: recommendation.predictedAssistant,
          confidence: recommendation.confidence,
          shouldRecommendSwitch: recommendation.shouldRecommendSwitch,
          matchedSignals: recommendation.matchedSignals,
        })

        const shouldBypassPrompt =
          suppressedSubmissionKey === submissionKey ||
          !appSettings.assistantRecommendations.enabled

        if (!recommendation.shouldRecommendSwitch || shouldBypassPrompt) {
          await logRecommendationEvent(
            recommendation,
            'not_shown',
            currentChat?.id
          )
          await continueWithSubmission(submission)
          return true
        }

        if (appSettings.assistantRecommendations.autoSwitchOnHighConfidence) {
          setCurrentMode(recommendation.recommendedMode)
          debugSendPipeline('precheck-autoswitch', {
            from: currentMode,
            to: recommendation.recommendedMode,
          })
          await logRecommendationEvent(
            recommendation,
            'autoswitched',
            currentChat?.id
          )
          await continueWithSubmission({
            ...submission,
            kind: recommendation.recommendedMode === 'image' ? 'image' : 'chat',
            modeOverride: recommendation.recommendedMode,
          })
          return true
        }

        if (draftRecommendation?.submissionKey === submissionKey) {
          await logRecommendationEvent(
            recommendation,
            'continued',
            currentChat?.id
          )
          setDraftRecommendation(null)
          await continueWithSubmission(submission)
          return true
        }

        await logRecommendationEvent(recommendation, 'shown', currentChat?.id)
        awaitRecommendationDecision()
        debugSendPipeline('precheck-modal-opened', {
          from: currentMode,
          to: recommendation.recommendedMode,
        })
        setPendingRecommendation({
          submission,
          recommendation,
          submissionKey,
        })
        setSuppressForMessage(false)
        return false
      } catch (error) {
        clearPromptPrecheck()
        throw error
      }
    },
    [
      appSettings.assistantRecommendations.autoSwitchOnHighConfidence,
      appSettings.assistantRecommendations.enabled,
      awaitRecommendationDecision,
      beginPromptPrecheck,
      clearPromptPrecheck,
      continueWithSubmission,
      currentChat?.id,
      currentMode,
      draftRecommendation,
      logRecommendationEvent,
      setCurrentMode,
      suppressedSubmissionKey,
    ]
  )

  const handleSwitchAndContinue = useCallback(async () => {
    if (!pendingRecommendation) return

    if (suppressForMessage) {
      setSuppressedSubmissionKey(pendingRecommendation.submissionKey)
    }

    setCurrentMode(pendingRecommendation.recommendation.recommendedMode)
    debugSendPipeline('precheck-switch-accepted', {
      from: pendingRecommendation.recommendation.currentAssistant,
      to: pendingRecommendation.recommendation.predictedAssistant,
    })
    await logRecommendationEvent(
      pendingRecommendation.recommendation,
      'accepted',
      currentChat?.id
    )

    const submission = {
      ...pendingRecommendation.submission,
      kind:
        pendingRecommendation.recommendation.recommendedMode === 'image'
          ? 'image'
          : 'chat',
      modeOverride: pendingRecommendation.recommendation.recommendedMode,
    } satisfies SubmissionInput

    clearPendingRecommendation()
    await continueWithSubmission(submission)
  }, [
    clearPendingRecommendation,
    continueWithSubmission,
    currentChat?.id,
    logRecommendationEvent,
    pendingRecommendation,
    setCurrentMode,
    suppressForMessage,
  ])

  const handleContinueAnyway = useCallback(async () => {
    if (!pendingRecommendation) return

    if (suppressForMessage) {
      setSuppressedSubmissionKey(pendingRecommendation.submissionKey)
    }

    await logRecommendationEvent(
      pendingRecommendation.recommendation,
      'continued',
      currentChat?.id
    )
    debugSendPipeline('precheck-continued-current', {
      current: pendingRecommendation.recommendation.currentAssistant,
      recommended: pendingRecommendation.recommendation.predictedAssistant,
    })
    const submission = pendingRecommendation.submission
    clearPendingRecommendation()
    await continueWithSubmission(submission)
  }, [
    clearPendingRecommendation,
    continueWithSubmission,
    currentChat?.id,
    logRecommendationEvent,
    pendingRecommendation,
    suppressForMessage,
  ])

  const handleCancel = useCallback(async () => {
    if (!pendingRecommendation) return

    if (suppressForMessage) {
      setSuppressedSubmissionKey(pendingRecommendation.submissionKey)
    }

    await logRecommendationEvent(
      pendingRecommendation.recommendation,
      'cancelled',
      currentChat?.id
    )
    debugSendPipeline('precheck-cancelled', {
      current: pendingRecommendation.recommendation.currentAssistant,
      recommended: pendingRecommendation.recommendation.predictedAssistant,
    })
    clearPromptPrecheck()
    clearPendingRecommendation()
  }, [
    clearPromptPrecheck,
    clearPendingRecommendation,
    currentChat?.id,
    logRecommendationEvent,
    pendingRecommendation,
    suppressForMessage,
  ])

  const handleUseDraftRecommendation = useCallback(async () => {
    if (!draftRecommendation) return null

    setSuppressedSubmissionKey(draftRecommendation.submissionKey)
    setCurrentMode(draftRecommendation.recommendation.recommendedMode)
    debugSendPipeline('draft-recommendation-accepted', {
      from: draftRecommendation.recommendation.currentAssistant,
      to: draftRecommendation.recommendation.predictedAssistant,
    })
    await logRecommendationEvent(
      draftRecommendation.recommendation,
      'accepted',
      currentChat?.id
    )
    const recommendedMode = draftRecommendation.recommendation.recommendedMode
    setDraftRecommendation(null)
    return recommendedMode
  }, [currentChat?.id, draftRecommendation, logRecommendationEvent, setCurrentMode])

  const handleIgnoreDraftRecommendation = useCallback(async () => {
    if (!draftRecommendation) return

    setSuppressedSubmissionKey(draftRecommendation.submissionKey)
    debugSendPipeline('draft-recommendation-ignored', {
      current: draftRecommendation.recommendation.currentAssistant,
      recommended: draftRecommendation.recommendation.predictedAssistant,
    })
    await logRecommendationEvent(
      draftRecommendation.recommendation,
      'continued',
      currentChat?.id
    )
    setDraftRecommendation(null)
  }, [currentChat?.id, draftRecommendation, logRecommendationEvent])

  return useMemo(
    () => ({
      draftRecommendation: draftRecommendation?.recommendation ?? null,
      pendingRecommendation: pendingRecommendation?.recommendation ?? null,
      recommendationOpen: Boolean(pendingRecommendation),
      suppressForMessage,
      setSuppressForMessage,
      precheckAndSend,
      handleUseDraftRecommendation,
      handleIgnoreDraftRecommendation,
      handleSwitchAndContinue,
      handleContinueAnyway,
      handleCancel,
    }),
    [
      draftRecommendation,
      handleCancel,
      handleContinueAnyway,
      handleIgnoreDraftRecommendation,
      handleSwitchAndContinue,
      handleUseDraftRecommendation,
      pendingRecommendation,
      precheckAndSend,
      suppressForMessage,
    ]
  )
}
