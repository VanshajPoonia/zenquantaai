import { describe, expect, it } from 'vitest'
import {
  parseModelJson,
  renderStructuredSummary,
} from '@/lib/ai/memory-summary'

describe('context engine — rolling summary parsing', () => {
  it('parses clean minified JSON', () => {
    const result = parseModelJson(
      '{"objective":"Build context engine","decisions":["Use Neon"],"facts":[],"constraints":[],"openLoops":[],"preferences":[]}'
    )
    expect(result?.objective).toBe('Build context engine')
    expect(result?.decisions).toEqual(['Use Neon'])
  })

  it('recovers JSON wrapped in code fences and surrounding prose', () => {
    const result = parseModelJson(
      'Here is the summary:\n```json\n{"objective":"Ship Phase 1","facts":["Route: /api/chat"]}\n```\nDone.'
    )
    expect(result?.objective).toBe('Ship Phase 1')
    expect(result?.facts).toEqual(['Route: /api/chat'])
  })

  it('returns null for unparseable output', () => {
    expect(parseModelJson('the model refused to answer')).toBeNull()
  })

  it('returns null when the object has no usable content', () => {
    expect(
      parseModelJson('{"objective":"","decisions":[],"facts":[]}')
    ).toBeNull()
  })

  it('deduplicates bullets case-insensitively and drops non-strings', () => {
    const result = parseModelJson(
      '{"objective":"x","facts":["Use Neon","use neon",42,"Use Postgres"]}'
    )
    expect(result?.facts).toEqual(['Use Neon', 'Use Postgres'])
  })

  it('preserves an exact identifier verbatim through parse + render', () => {
    const guid = '153d0f3d-fe97-43a2-806e-825b0e29551e'
    const result = parseModelJson(
      `{"objective":"x","facts":["Restaurant GUID: ${guid}"]}`
    )
    const rendered = renderStructuredSummary(result!)
    expect(rendered).toContain(guid)
  })

  it('renders constraints and facts under one section and preserves order', () => {
    const rendered = renderStructuredSummary({
      objective: 'Migrate database',
      decisions: ['Adopt Neon'],
      constraints: ['Do not add Supabase'],
      facts: ['Table: connected_accounts'],
      openLoops: ['Wire cross-chat recall'],
      preferences: ['Terse replies'],
    })
    expect(rendered).toContain('Conversation goal:\n- Migrate database')
    expect(rendered).toContain('Known preferences:\n- Terse replies')
    expect(rendered).toContain('Table: connected_accounts')
    expect(rendered).toContain('Do not add Supabase')
    expect(rendered).toContain('Decisions made:\n- Adopt Neon')
    expect(rendered).toContain('Open threads:\n- Wire cross-chat recall')
  })
})
