import { describe, expect, it } from 'vitest'
import { FAMILY_TO_MODE, MODE_TO_FAMILY } from '@/lib/config/assistants'
import { getAssistantRecommendation } from '@/lib/router/assistantRecommendation'

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
})
