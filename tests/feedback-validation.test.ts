import { describe, expect, it } from 'vitest'
import {
  isFeedbackEntityType,
  isFeedbackRating,
  normalizeFeedbackReason,
  parseFeedbackSubmitRequest,
  sanitizeFeedbackMetadata,
} from '@/lib/feedback/validation'

describe('feedback validation helpers', () => {
  it('accepts supported entity types and ratings', () => {
    expect(isFeedbackEntityType('message')).toBe(true)
    expect(isFeedbackEntityType('model_candidate')).toBe(true)
    expect(isFeedbackEntityType('unknown')).toBe(false)
    expect(isFeedbackRating('up')).toBe(true)
    expect(isFeedbackRating('down')).toBe(true)
    expect(isFeedbackRating('five-stars')).toBe(false)
  })

  it('normalizes optional reasons', () => {
    expect(normalizeFeedbackReason('  too vague\n\nfor my use case  ')).toBe(
      'too vague for my use case'
    )
    expect(normalizeFeedbackReason('   ')).toBeNull()
    expect(normalizeFeedbackReason('x'.repeat(600))).toHaveLength(500)
  })

  it('strips unsafe, large, and private metadata fields', () => {
    const metadata = sanitizeFeedbackMetadata({
      assistantFamily: 'nova',
      sourceCount: 2,
      sourceUrl: 'https://private.example/file',
      storagePath: 'users/u1/private.txt',
      rawCostUsd: 1.23,
      snippet: 'private content',
      nested: {
        model: 'safe-model',
        apiKey: 'secret',
      },
      longText: 'x'.repeat(500),
      invalidNumber: Number.NaN,
    })

    expect(metadata).toMatchObject({
      assistantFamily: 'nova',
      sourceCount: 2,
      nested: { model: 'safe-model' },
    })
    expect(metadata.longText).toHaveLength(240)
    expect(metadata).not.toHaveProperty('sourceUrl')
    expect(metadata).not.toHaveProperty('storagePath')
    expect(metadata).not.toHaveProperty('rawCostUsd')
    expect(metadata).not.toHaveProperty('snippet')
    expect(metadata).not.toHaveProperty('invalidNumber')
  })

  it('parses safe submit payloads and rejects unsupported values', () => {
    expect(
      parseFeedbackSubmitRequest({
        entityType: 'playbook_run',
        entityId: ' run_1 ',
        rating: 'neutral',
        reason: ' fine ',
        metadata: { status: 'complete', content: 'do not store this' },
      })
    ).toEqual({
      ok: true,
      value: {
        entityType: 'playbook_run',
        entityId: 'run_1',
        rating: 'neutral',
        reason: 'fine',
        metadata: { status: 'complete' },
      },
    })

    expect(
      parseFeedbackSubmitRequest({
        entityType: 'message',
        entityId: '',
        rating: 'up',
      })
    ).toMatchObject({ ok: false })
    expect(
      parseFeedbackSubmitRequest({
        entityType: 'message',
        entityId: 'msg_1',
        rating: 'bad',
      })
    ).toMatchObject({ ok: false })
  })
})
