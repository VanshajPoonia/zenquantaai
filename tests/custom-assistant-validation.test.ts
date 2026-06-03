import { describe, expect, it } from 'vitest'
import {
  buildCustomAssistantSnapshot,
  normalizeCustomAssistantInput,
  normalizeCustomAssistantMetadata,
} from '@/lib/custom-assistants/validation'

describe('custom assistant validation', () => {
  it('accepts valid private text assistant input and normalizes metadata', () => {
    const result = normalizeCustomAssistantInput({
      name: 'Research Coach',
      description: 'Helps with careful research planning.',
      iconEmoji: 'R',
      color: 'live',
      baseMode: 'live',
      systemInstructions: 'Ask clarifying questions and cite uncertainty.',
      defaultModelOverride: 'gpt',
      defaultSettings: {
        temperature: 5,
        maxTokens: 9000,
        topP: 0.01,
        modelOverride: 'claude',
        tools: {
          webSearch: true,
          memory: false,
        },
      },
      metadata: {
        tone: ' Precise and calm ',
        responseStyle: 'detailed',
        isPinned: true,
        suggestedUseCases: ['research', 'research', 'briefing'],
        starterPromptIds: ['prompt_1'],
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.input.baseMode).toBe('live')
    expect(result.input.defaultSettings).toMatchObject({
      temperature: 2,
      maxTokens: 8000,
      topP: 0.1,
      modelOverride: 'claude',
      tools: {
        webSearch: true,
        memory: false,
      },
    })
    expect(result.input.metadata).toMatchObject({
      version: 2,
      tone: 'Precise and calm',
      responseStyle: 'detailed',
      isPinned: true,
      suggestedUseCases: ['research', 'briefing'],
      starterPromptIds: ['prompt_1'],
    })
  })

  it('rejects Prism/image mode for custom assistants', () => {
    const result = normalizeCustomAssistantInput({
      name: 'Image Bot',
      baseMode: 'image',
      systemInstructions: 'Generate images.',
    })

    expect(result).toEqual({
      ok: false,
      error: 'Custom assistants support text modes only.',
    })
  })

  it('supports partial updates without requiring name or instructions', () => {
    const result = normalizeCustomAssistantInput(
      {
        description: 'Updated description',
        metadata: {
          isPinned: true,
          responseStyle: 'concise',
        },
      },
      { partial: true }
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.input).toMatchObject({
      description: 'Updated description',
      metadata: {
        version: 2,
        isPinned: true,
        responseStyle: 'concise',
        suggestedUseCases: [],
      },
    })
  })

  it('normalizes empty metadata and builds safe assistant snapshots', () => {
    expect(normalizeCustomAssistantMetadata(null)).toEqual({
      version: 2,
      isPinned: false,
      suggestedUseCases: [],
    })

    expect(
      buildCustomAssistantSnapshot({
        id: 'assistant_1',
        name: 'Ops Helper',
        description: null,
        iconEmoji: 'O',
        color: 'general',
        baseMode: 'general',
      })
    ).toEqual({
      id: 'assistant_1',
      name: 'Ops Helper',
      description: undefined,
      iconEmoji: 'O',
      color: 'general',
      baseMode: 'general',
    })
  })
})
