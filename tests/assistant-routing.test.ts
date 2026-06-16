import { describe, expect, it } from 'vitest'
import { AssistantRecommendationResult } from '@/types'
import { FAMILY_TO_MODE, MODE_TO_FAMILY } from '@/lib/config/assistants'
import { getAssistantRecommendation } from '@/lib/router/assistantRecommendation'
import {
  buildAssistantRecommendationPersonalizationSummary,
  personalizeAssistantRecommendation,
} from '@/lib/router/personalization'

describe('assistant routing and config helpers', () => {
  it('keeps assistant family and mode mappings in sync', () => {
    expect(MODE_TO_FAMILY.general).toBe('nova')
    expect(MODE_TO_FAMILY.creative).toBe('velora')
    expect(MODE_TO_FAMILY.logic).toBe('axiom')
    expect(MODE_TO_FAMILY.code).toBe('forge')
    expect(MODE_TO_FAMILY.live).toBe('pulse')
    expect(MODE_TO_FAMILY.image).toBe('prism')

    for (const [mode, family] of Object.entries(MODE_TO_FAMILY)) {
      expect(FAMILY_TO_MODE[family]).toBe(mode)
    }
  })

  it('recommends Forge for debugging and implementation prompts', () => {
    const result = getAssistantRecommendation({
      prompt: 'Debug this TypeScript stack trace in app/page.tsx and fix the React hook bug.',
      currentMode: 'general',
    })

    expect(result.predictedAssistant).toBe('forge')
    expect(result.recommendedMode).toBe('code')
    expect(result.shouldRecommendSwitch).toBe(true)
    expect(result.matchedSignals).toContain('file-extension')
  })

  it('recommends Pulse for current source-backed research prompts', () => {
    const result = getAssistantRecommendation({
      prompt: 'Look up current official sources and verify the latest market update today.',
      currentMode: 'general',
    })

    expect(result.predictedAssistant).toBe('pulse')
    expect(result.recommendedMode).toBe('live')
    expect(result.shouldRecommendSwitch).toBe(true)
  })

  it('recommends Prism for image generation prompts', () => {
    const result = getAssistantRecommendation({
      prompt: 'Create a cinematic poster image for a premium AI research workspace.',
      currentMode: 'general',
      kind: 'chat',
    })

    expect(result.predictedAssistant).toBe('prism')
    expect(result.recommendedMode).toBe('image')
    expect(result.shouldRecommendSwitch).toBe(true)
  })

  it('keeps broad general prompts in Nova without a switch recommendation', () => {
    const result = getAssistantRecommendation({
      prompt: 'Explain how project planning works in simple terms.',
      currentMode: 'general',
    })

    expect(result.predictedAssistant).toBe('nova')
    expect(result.recommendedMode).toBe('general')
    expect(result.shouldRecommendSwitch).toBe(false)
  })

  it('respects explicit current-assistant lock wording', () => {
    const result = getAssistantRecommendation({
      prompt: 'Do not switch assistants. Debug this TypeScript error in app/page.tsx.',
      currentMode: 'general',
    })

    expect(result.lockedToCurrentAssistant).toBe(true)
    expect(result.shouldRecommendSwitch).toBe(false)
  })

  it('keeps the base recommendation unchanged when personalization is off', () => {
    const input = {
      prompt: 'Debug this TypeScript error in components/chat/composer.tsx.',
      currentMode: 'general' as const,
    }
    const base = getAssistantRecommendation(input)
    const personalizedOff = getAssistantRecommendation({
      ...input,
      personalization: {
        enabled: false,
        summary: buildAssistantRecommendationPersonalizationSummary({
          recommendationEvents: [
            {
              recommendedAssistant: 'forge',
              matchedSignals: ['code-intent'],
              outcome: 'accepted',
            },
          ],
        }),
      },
    })

    expect(personalizedOff).toEqual(base)
  })

  it('adds a Forge personal explanation for coding prompts when accepted history agrees', () => {
    const result = getAssistantRecommendation({
      prompt: 'Fix this failing Next.js API route and TypeScript stack trace.',
      currentMode: 'general',
      personalization: {
        enabled: true,
        summary: buildAssistantRecommendationPersonalizationSummary({
          recommendationEvents: [
            {
              recommendedAssistant: 'forge',
              matchedSignals: ['code-intent'],
              outcome: 'accepted',
            },
            {
              recommendedAssistant: 'forge',
              matchedSignals: ['file-extension'],
              outcome: 'autoswitched',
            },
          ],
        }),
      },
    })

    expect(result.predictedAssistant).toBe('forge')
    expect(result.personalized).toBe(true)
    expect(result.personalizedReason).toContain('forge')
    expect(result.matchedPersonalizationSignals).toContain('forge:code')
  })

  it('suppresses weak Pulse confidence when the user rejects Pulse for general tasks', () => {
    const base: AssistantRecommendationResult = {
      currentAssistant: 'nova',
      predictedAssistant: 'pulse',
      recommendedMode: 'live',
      confidence: 0.8,
      reason: 'it has a weak live-context hint',
      matchedSignals: ['general-help'],
      shouldRecommendSwitch: true,
    }
    const summary = buildAssistantRecommendationPersonalizationSummary({
      recommendationEvents: [
        {
          recommendedAssistant: 'pulse',
          matchedSignals: ['general-help'],
          outcome: 'continued',
        },
        {
          recommendedAssistant: 'pulse',
          matchedSignals: ['general-help'],
          outcome: 'cancelled',
        },
      ],
    })
    const result = personalizeAssistantRecommendation({
      result: base,
      enabled: true,
      summary,
    })

    expect(result.predictedAssistant).toBe('pulse')
    expect(result.confidence).toBeLessThan(base.confidence)
    expect(result.personalizedReason).toContain('skip pulse')
  })

  it('uses Velora feedback for creative and copy prompts', () => {
    const result = getAssistantRecommendation({
      prompt: 'Rewrite this landing page copy with a warmer brand voice.',
      currentMode: 'general',
      personalization: {
        enabled: true,
        summary: buildAssistantRecommendationPersonalizationSummary({
          feedbackEvents: [
            {
              entityType: 'message',
              rating: 'up',
              metadata: {
                assistantFamily: 'velora',
                mode: 'creative',
              },
            },
          ],
        }),
      },
    })

    expect(result.predictedAssistant).toBe('velora')
    expect(result.personalizedReason).toContain('velora')
    expect(result.personalizedReason).toContain('copy and creative work')
  })

  it('does not let unrelated Model Duel winners override strong base rules', () => {
    const result = getAssistantRecommendation({
      prompt: 'Debug this React hook error in app/page.tsx.',
      currentMode: 'general',
      personalization: {
        enabled: true,
        summary: buildAssistantRecommendationPersonalizationSummary({
          modelDuelWinners: [
            {
              assistantFamily: 'axiom',
              mode: 'logic',
            },
          ],
        }),
      },
    })

    expect(result.predictedAssistant).toBe('forge')
    expect(result.personalizedReason).toBeUndefined()
  })
})
