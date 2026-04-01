'use client'

import { useCallback, useMemo, useState } from 'react'
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
  onContinue: (submission: SubmissionInput) => Promise<void>
  onSubmitted?: () => void
}) {
  const { currentMode, currentChat, appSettings, setCurrentMode } = useChatContext()
  const [pendingRecommendation, setPendingRecommendation] = useState<{
    submission: SubmissionInput
    recommendation: AssistantRecommendationResult
    submissionKey: string
  } | null>(null)
  const [suppressForMessage, setSuppressForMessage] = useState(false)
  const [suppressedSubmissionKey, setSuppressedSubmissionKey] = useState<string | null>(
    null
  )

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

  const continueWithSubmission = useCallback(
    async (submission: SubmissionInput) => {
      await input.onContinue(submission)
      setSuppressedSubmissionKey(null)
      input.onSubmitted?.()
    },
    [input]
  )

  const precheckAndSend = useCallback(
    async (submission: SubmissionInput) => {
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
        suppressedSubmissionKey === submissionKey || !appSettings.assistantRecommendations.enabled

      if (
        !recommendation.shouldRecommendSwitch ||
        shouldBypassPrompt
      ) {
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

      await logRecommendationEvent(recommendation, 'shown', currentChat?.id)
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
    },
    [
      appSettings.assistantRecommendations.autoSwitchOnHighConfidence,
      appSettings.assistantRecommendations.enabled,
      continueWithSubmission,
      currentChat?.id,
      currentMode,
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
    clearPendingRecommendation()
  }, [
    clearPendingRecommendation,
    currentChat?.id,
    logRecommendationEvent,
    pendingRecommendation,
    suppressForMessage,
  ])

  return useMemo(
    () => ({
      pendingRecommendation: pendingRecommendation?.recommendation ?? null,
      recommendationOpen: Boolean(pendingRecommendation),
      suppressForMessage,
      setSuppressForMessage,
      precheckAndSend,
      handleSwitchAndContinue,
      handleContinueAnyway,
      handleCancel,
    }),
    [
      handleCancel,
      handleContinueAnyway,
      handleSwitchAndContinue,
      pendingRecommendation,
      precheckAndSend,
      suppressForMessage,
    ]
  )
}
