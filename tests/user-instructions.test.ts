import { describe, expect, it } from 'vitest'
import {
  ABOUT_YOU_MAX_CHARS,
  buildUserInstructionsBlock,
  PROJECT_INSTRUCTIONS_MAX_CHARS,
  RESPONSE_INSTRUCTIONS_MAX_CHARS,
} from '@/lib/ai/user-instructions'

describe('user instructions block', () => {
  it('is empty when there is nothing to add', () => {
    expect(buildUserInstructionsBlock({})).toBe('')
    expect(
      buildUserInstructionsBlock({
        aboutYou: '   ',
        responseInstructions: '\n\n',
        projectName: 'Bakery',
        projectInstructions: '',
      })
    ).toBe('')
  })

  it('frames the text as preferences that never override the rules', () => {
    const block = buildUserInstructionsBlock({ aboutYou: 'I run a bakery.' })

    expect(block.startsWith('[User instructions]')).toBe(true)
    expect(block).toContain('never override safety rules, system rules, tool rules or plan limits')
    expect(block).toContain('About the user:\nI run a bakery.')
  })

  it('orders about you, then how to answer, then the project', () => {
    const block = buildUserInstructionsBlock({
      aboutYou: 'ABOUT',
      responseInstructions: 'ANSWERS',
      projectName: 'Launch',
      projectInstructions: 'PROJECT',
    })

    const about = block.indexOf('ABOUT')
    const answers = block.indexOf('ANSWERS')
    const project = block.indexOf('PROJECT')
    expect(about).toBeGreaterThan(-1)
    expect(answers).toBeGreaterThan(about)
    expect(project).toBeGreaterThan(answers)
    expect(block).toContain('Instructions for the project "Launch":')
    expect(block).toContain('follow the project instructions')
  })

  it('caps every field', () => {
    const block = buildUserInstructionsBlock({
      aboutYou: 'a'.repeat(ABOUT_YOU_MAX_CHARS + 500),
      responseInstructions: 'r'.repeat(RESPONSE_INSTRUCTIONS_MAX_CHARS + 500),
      projectName: 'n'.repeat(500),
      projectInstructions: 'p'.repeat(PROJECT_INSTRUCTIONS_MAX_CHARS + 500),
    })

    expect(block).toContain('a'.repeat(ABOUT_YOU_MAX_CHARS))
    expect(block).not.toContain('a'.repeat(ABOUT_YOU_MAX_CHARS + 1))
    expect(block).toContain('r'.repeat(RESPONSE_INSTRUCTIONS_MAX_CHARS))
    expect(block).not.toContain('r'.repeat(RESPONSE_INSTRUCTIONS_MAX_CHARS + 1))
    expect(block).toContain('p'.repeat(PROJECT_INSTRUCTIONS_MAX_CHARS))
    expect(block).not.toContain('p'.repeat(PROJECT_INSTRUCTIONS_MAX_CHARS + 1))
    expect(block).not.toContain('n'.repeat(121))
    expect(block.length).toBeLessThan(
      ABOUT_YOU_MAX_CHARS + RESPONSE_INSTRUCTIONS_MAX_CHARS + PROJECT_INSTRUCTIONS_MAX_CHARS + 1_000
    )
  })

  it('drops about you when custom instructions are off but keeps the project', () => {
    const block = buildUserInstructionsBlock({
      aboutYou: 'ABOUT',
      responseInstructions: 'ANSWERS',
      useCustomInstructions: false,
      projectInstructions: 'PROJECT',
    })

    expect(block).not.toContain('ABOUT')
    expect(block).not.toContain('ANSWERS')
    expect(block).toContain('Instructions for this project:\nPROJECT')
    expect(block).not.toContain('disagree')
  })

  it('collapses runs of blank lines', () => {
    const block = buildUserInstructionsBlock({ aboutYou: 'one\r\n\r\n\r\n\r\ntwo' })

    expect(block).toContain('one\n\ntwo')
  })
})
