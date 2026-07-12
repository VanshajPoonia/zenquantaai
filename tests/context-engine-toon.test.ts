import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TOON_SAVINGS_RATIO,
  encodeToon,
  isToonWorthwhile,
} from '@/lib/context/toon'

describe('context engine — TOON encoding', () => {
  it('emits a header with row count and columns, then one indented row each', () => {
    const text = encodeToon('sources', ['id', 'name'], [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ])

    expect(text).toBe(['sources[2]{id,name}:', '  1,Alice', '  2,Bob'].join('\n'))
  })

  it('coerces numbers and booleans and leaves nullish cells empty', () => {
    const text = encodeToon('rows', ['a', 'b', 'c'], [
      { a: 3, b: true, c: null },
      { a: 0, b: false },
    ])

    expect(text).toBe(['rows[2]{a,b,c}:', '  3,true,', '  0,false,'].join('\n'))
  })

  it('quotes and escapes values that would corrupt a comma-delimited row', () => {
    const text = encodeToon('items', ['note'], [
      { note: 'a, b' }, // embedded comma
      { note: 'say "hi"' }, // embedded quote → doubled
      { note: 'line1\nline2' }, // newline
      { note: ' padded ' }, // edge whitespace would be trimmed by a reader
      { note: 'plain' }, // no quoting
    ])

    expect(text).toBe(
      [
        'items[5]{note}:',
        '  "a, b"',
        '  "say ""hi"""',
        '  "line1\nline2"',
        '  " padded "',
        '  plain',
      ].join('\n')
    )
  })

  it('returns empty string for an empty array or no columns', () => {
    expect(encodeToon('x', ['id'], [])).toBe('')
    expect(encodeToon('x', [], [{ id: 1 }])).toBe('')
  })
})

describe('context engine — TOON worthwhile gate', () => {
  it('chooses TOON when it is a real token win on short, multi-column rows', () => {
    const rows = Array.from({ length: 8 }, (_, index) => ({
      id: index + 1,
      kind: 'preference',
      status: 'active',
      importance: 2,
    }))
    const columns = ['id', 'kind', 'status', 'importance']

    // The realistic "before" for a uniform array is minified JSON, which repeats
    // every key on every row. TOON declares the keys once.
    const jsonBaseline = JSON.stringify(rows)
    const toon = encodeToon('memory', columns, rows)

    expect(toon.length).toBeLessThan(jsonBaseline.length)
    expect(isToonWorthwhile(jsonBaseline, toon)).toBe(true)
  })

  it('keeps the current rendering when rows are dominated by free text', () => {
    // A couple of long-snippet sources: the per-row key labels are a tiny share
    // of the tokens, so TOON cannot clear the savings threshold (AI_CONTEXT_ENGINE §8).
    const readable = [
      '[1] Some Article Title',
      'URL: https://example.com/a',
      `Snippet: ${'lorem ipsum dolor sit amet '.repeat(12)}`,
      '',
      '[2] Another Article Title',
      'URL: https://example.com/b',
      `Snippet: ${'consectetur adipiscing elit '.repeat(12)}`,
    ].join('\n')

    const toon = encodeToon('sources', ['id', 'title', 'url', 'snippet'], [
      {
        id: 1,
        title: 'Some Article Title',
        url: 'https://example.com/a',
        snippet: 'lorem ipsum dolor sit amet '.repeat(12),
      },
      {
        id: 2,
        title: 'Another Article Title',
        url: 'https://example.com/b',
        snippet: 'consectetur adipiscing elit '.repeat(12),
      },
    ])

    expect(isToonWorthwhile(readable, toon)).toBe(false)
  })

  it('returns false when the baseline is empty and respects a custom ratio', () => {
    expect(isToonWorthwhile('', 'anything')).toBe(false)

    // A ~15% win clears the default 10% gate but fails a demanded 50% gate.
    const baseline = 'x'.repeat(1000)
    const candidate = 'x'.repeat(850)
    expect(isToonWorthwhile(baseline, candidate, DEFAULT_TOON_SAVINGS_RATIO)).toBe(true)
    expect(isToonWorthwhile(baseline, candidate, 0.5)).toBe(false)
  })
})
