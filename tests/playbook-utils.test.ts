import { describe, expect, it } from 'vitest'
import {
  buildWorkflowStepPrompt,
  expandWorkflowTemplate,
  extractWorkflowVariableNames,
  getDefaultStepType,
  getWorkflowUsageLevel,
  mergeWorkflowVariables,
  normalizePromptWorkflowMetadata,
  normalizePromptWorkflowStepMetadata,
} from '@/lib/utils/prompt-workflows'

describe('playbook variable and metadata helpers', () => {
  it('extracts sorted unique variable names from templates', () => {
    expect(
      extractWorkflowVariableNames(
        'Write for {{ audience }} about {{goal}}. Then mention {{audience}} again and {{project-name}}.'
      )
    ).toEqual(['audience', 'goal', 'project-name'])
  })

  it('merges variable definitions while preserving existing labels and defaults', () => {
    expect(
      mergeWorkflowVariables(
        [
          {
            name: 'audience',
            label: 'Target audience',
            defaultValue: 'founders',
            required: false,
          },
        ],
        ['goal', 'audience']
      )
    ).toEqual([
      {
        name: 'audience',
        label: 'Target audience',
        defaultValue: 'founders',
        required: false,
      },
      {
        name: 'goal',
        label: 'goal',
        defaultValue: '',
        required: true,
      },
    ])
  })

  it('expands variables and inserts previous-output preview text when requested', () => {
    expect(
      expandWorkflowTemplate('Draft for {{ audience }} about {{ missing }}.', {
        audience: 'founders',
      })
    ).toBe('Draft for founders about .')

    expect(
      buildWorkflowStepPrompt({
        step: {
          template: 'Summarize the previous work for {{audience}}.',
          metadata: {
            stepType: 'analysis',
            outputLabel: 'Summary',
            includePreviousOutput: true,
          },
        },
        values: { audience: 'operators' },
        preview: true,
      })
    ).toContain('[The previous completed step output will be inserted here when this playbook runs.]')
  })

  it('normalizes playbook metadata and step defaults', () => {
    expect(
      normalizePromptWorkflowMetadata({
        category: 'developer',
        expectedOutputType: 'code',
        suggestedAssistant: 'forge',
        visibility: 'public',
      })
    ).toEqual({
      category: 'developer',
      expectedOutputType: 'code',
      suggestedAssistant: 'forge',
      visibility: 'private',
    })

    expect(normalizePromptWorkflowMetadata({ category: 'unknown' })).toMatchObject({
      category: 'custom',
      expectedOutputType: 'document',
      suggestedAssistant: null,
    })

    expect(getDefaultStepType('prism')).toBe('image')
    expect(getDefaultStepType('pulse')).toBe('research')
    expect(
      normalizePromptWorkflowStepMetadata(
        { stepType: 'invalid', outputLabel: '  Draft ', includePreviousOutput: true },
        'forge'
      )
    ).toEqual({
      stepType: 'code',
      outputLabel: 'Draft',
      includePreviousOutput: true,
    })
  })

  it('classifies rough playbook usage level without exposing costs', () => {
    const baseStep = {
      mode: 'general' as const,
      template: 'Short prompt',
      metadata: {
        stepType: 'text' as const,
        outputLabel: null,
        includePreviousOutput: false,
      },
    }

    expect(getWorkflowUsageLevel({ steps: [baseStep], values: {} })).toBe('low')
    expect(
      getWorkflowUsageLevel({
        steps: [baseStep, baseStep, baseStep],
        values: {},
      })
    ).toBe('medium')
    expect(
      getWorkflowUsageLevel({
        steps: [{ ...baseStep, mode: 'image' }],
        values: {},
      })
    ).toBe('high')
  })
})
