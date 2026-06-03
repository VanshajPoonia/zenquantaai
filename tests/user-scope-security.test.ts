import { describe, expect, it } from 'vitest'
import {
  conversationBelongsToProject,
  normalizeConversationProjectId,
  normalizeOptionalProjectId,
  toSafeDashboardRecentImage,
} from '@/lib/security/user-scope'
import { DEFAULT_PROJECT_ID } from '@/lib/config'
import { ImageGenerationEvent } from '@/types'

function imageEvent(
  overrides: Partial<ImageGenerationEvent> = {}
): ImageGenerationEvent {
  return {
    id: 'img_evt_1',
    userId: 'user_1',
    subscriptionId: 'sub_1',
    conversationId: 'conv_1',
    messageId: 'msg_1',
    assistantFamily: 'prism',
    model: 'google/gemini-2.5-flash-image',
    prompt: 'Create a product concept',
    negativePrompt: null,
    size: null,
    aspectRatio: null,
    imageCount: 1,
    imageCreditsConsumed: 10,
    rawCostUsd: 0.035,
    displayedCostUsd: 0.07,
    displayMultiplier: 2,
    marginUsd: 0.035,
    outputUrls: ['https://private.example/generated.png'],
    createdAt: '2026-06-03T00:00:00.000Z',
    ...overrides,
  }
}

describe('user-scope security helpers', () => {
  it('normalizes optional project ids without inventing a project', () => {
    expect(normalizeOptionalProjectId(undefined)).toBeNull()
    expect(normalizeOptionalProjectId(null)).toBeNull()
    expect(normalizeOptionalProjectId('   ')).toBeNull()
    expect(normalizeOptionalProjectId('  proj_1  ')).toBe('proj_1')
  })

  it('treats missing conversation project ids as the default project', () => {
    expect(normalizeConversationProjectId(null)).toBe(DEFAULT_PROJECT_ID)
    expect(conversationBelongsToProject(null, DEFAULT_PROJECT_ID)).toBe(true)
    expect(conversationBelongsToProject(undefined, DEFAULT_PROJECT_ID)).toBe(true)
  })

  it('detects incompatible owned project and conversation scopes', () => {
    expect(conversationBelongsToProject('proj_a', 'proj_a')).toBe(true)
    expect(conversationBelongsToProject('proj_a', null)).toBe(true)
    expect(conversationBelongsToProject('proj_a', 'proj_b')).toBe(false)
  })

  it('scrubs raw image cost and private output urls from dashboard summaries', () => {
    const safe = toSafeDashboardRecentImage(imageEvent())

    expect(safe).toEqual({
      id: 'img_evt_1',
      conversationId: 'conv_1',
      messageId: 'msg_1',
      model: 'google/gemini-2.5-flash-image',
      prompt: 'Create a product concept',
      imageCount: 1,
      imageCreditsConsumed: 10,
      displayedCostUsd: 0.07,
      outputCount: 1,
      createdAt: '2026-06-03T00:00:00.000Z',
    })
    expect('rawCostUsd' in safe).toBe(false)
    expect('marginUsd' in safe).toBe(false)
    expect('outputUrls' in safe).toBe(false)
  })
})
