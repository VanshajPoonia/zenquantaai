import {
  AssistantFamily,
  AIMode,
  PromptWorkflowCategory,
  PromptWorkflowExpectedOutputType,
  PromptWorkflowMetadata,
  PromptWorkflowStep,
  PromptWorkflowStepMetadata,
  PromptWorkflowStepType,
  PromptWorkflowVariable,
} from '@/types'

export const WORKFLOW_VARIABLE_PATTERN = /\{\{\s*([a-zA-Z][a-zA-Z0-9_-]*)\s*\}\}/g

export const WORKFLOW_FAMILY_TO_MODE: Record<AssistantFamily, AIMode> = {
  nova: 'general',
  velora: 'creative',
  axiom: 'logic',
  forge: 'code',
  pulse: 'live',
  prism: 'image',
}

export const PLAYBOOK_CATEGORIES: Array<{
  value: PromptWorkflowCategory
  label: string
}> = [
  { value: 'custom', label: 'Custom' },
  { value: 'research', label: 'Research' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'business', label: 'Business' },
  { value: 'content', label: 'Content' },
  { value: 'developer', label: 'Developer' },
  { value: 'operations', label: 'Operations' },
  { value: 'image', label: 'Image' },
  { value: 'education', label: 'Education' },
  { value: 'agency', label: 'Agency' },
]

export const PLAYBOOK_OUTPUT_TYPES: Array<{
  value: PromptWorkflowExpectedOutputType
  label: string
}> = [
  { value: 'document', label: 'Document' },
  { value: 'checklist', label: 'Checklist' },
  { value: 'email', label: 'Email' },
  { value: 'code', label: 'Code' },
  { value: 'table', label: 'Table' },
  { value: 'image_prompt', label: 'Image prompt' },
  { value: 'research_brief', label: 'Research brief' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'campaign', label: 'Campaign' },
  { value: 'summary', label: 'Summary' },
]

export const PLAYBOOK_STEP_TYPES: Array<{
  value: PromptWorkflowStepType
  label: string
}> = [
  { value: 'text', label: 'Text' },
  { value: 'analysis', label: 'Analysis' },
  { value: 'research', label: 'Research' },
  { value: 'code', label: 'Code' },
  { value: 'image', label: 'Image' },
]

export const DEFAULT_PROMPT_WORKFLOW_METADATA: PromptWorkflowMetadata = {
  category: 'custom',
  expectedOutputType: 'document',
  suggestedAssistant: null,
  visibility: 'private',
}

export function getDefaultStepType(
  assistantFamily: AssistantFamily
): PromptWorkflowStepType {
  if (assistantFamily === 'prism') return 'image'
  if (assistantFamily === 'pulse') return 'research'
  if (assistantFamily === 'forge') return 'code'
  if (assistantFamily === 'axiom') return 'analysis'
  return 'text'
}

export function normalizePromptWorkflowMetadata(
  value: unknown
): PromptWorkflowMetadata {
  const input =
    value && typeof value === 'object'
      ? (value as Partial<PromptWorkflowMetadata>)
      : {}
  const categoryCandidate = input.category
  const category: PromptWorkflowCategory =
    categoryCandidate &&
    PLAYBOOK_CATEGORIES.some((option) => option.value === categoryCandidate)
      ? categoryCandidate
      : DEFAULT_PROMPT_WORKFLOW_METADATA.category
  const expectedOutputTypeCandidate = input.expectedOutputType
  const expectedOutputType: PromptWorkflowExpectedOutputType =
    expectedOutputTypeCandidate &&
    PLAYBOOK_OUTPUT_TYPES.some(
      (option) => option.value === expectedOutputTypeCandidate
    )
      ? expectedOutputTypeCandidate
      : DEFAULT_PROMPT_WORKFLOW_METADATA.expectedOutputType
  const suggestedAssistant =
    input.suggestedAssistant &&
    Object.prototype.hasOwnProperty.call(
      WORKFLOW_FAMILY_TO_MODE,
      input.suggestedAssistant
    )
      ? input.suggestedAssistant
      : null

  return {
    category,
    expectedOutputType,
    suggestedAssistant,
    visibility: 'private',
  }
}

export function normalizePromptWorkflowStepMetadata(
  value: unknown,
  assistantFamily: AssistantFamily
): PromptWorkflowStepMetadata {
  const input =
    value && typeof value === 'object'
      ? (value as Partial<PromptWorkflowStepMetadata>)
      : {}
  const stepTypeCandidate = input.stepType
  const stepType: PromptWorkflowStepType =
    stepTypeCandidate &&
    PLAYBOOK_STEP_TYPES.some((option) => option.value === stepTypeCandidate)
      ? stepTypeCandidate
      : getDefaultStepType(assistantFamily)
  const outputLabel = input.outputLabel?.trim() || null

  return {
    stepType,
    outputLabel,
    includePreviousOutput: input.includePreviousOutput === true,
  }
}

export function extractWorkflowVariableNames(template: string): string[] {
  const names = new Set<string>()
  for (const match of template.matchAll(WORKFLOW_VARIABLE_PATTERN)) {
    const name = match[1]?.trim()
    if (name) {
      names.add(name)
    }
  }

  return [...names].sort((a, b) => a.localeCompare(b))
}

export function mergeWorkflowVariables(
  existing: PromptWorkflowVariable[] | undefined,
  names: string[]
): PromptWorkflowVariable[] {
  const existingByName = new Map(
    (existing ?? [])
      .filter((variable) => variable.name.trim())
      .map((variable) => [variable.name.trim(), variable])
  )

  return [...new Set(names)]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({
      name,
      label: existingByName.get(name)?.label ?? name,
      defaultValue: existingByName.get(name)?.defaultValue ?? '',
      required: existingByName.get(name)?.required ?? true,
    }))
}

export function expandWorkflowTemplate(
  template: string,
  values: Record<string, string>
): string {
  return template.replace(WORKFLOW_VARIABLE_PATTERN, (_, name: string) => {
    return values[name]?.trim() ?? ''
  })
}

export function buildWorkflowStepPrompt(input: {
  step: Pick<PromptWorkflowStep, 'template' | 'metadata'>
  values: Record<string, string>
  previousOutput?: string | null
  preview?: boolean
}): string {
  const expanded = expandWorkflowTemplate(input.step.template, input.values).trim()
  if (!input.step.metadata.includePreviousOutput) return expanded

  const previousOutput = input.previousOutput?.trim()
  const previousBlock =
    previousOutput || input.preview
      ? [
          '',
          'Previous step output:',
          previousOutput || '[The previous completed step output will be inserted here when this playbook runs.]',
        ].join('\n')
      : ''

  return `${expanded}${previousBlock}`.trim()
}

export function getWorkflowUsageLevel(input: {
  steps: Array<Pick<PromptWorkflowStep, 'mode' | 'template' | 'metadata'>>
  values: Record<string, string>
}): 'low' | 'medium' | 'high' {
  const expandedCharacters = input.steps.reduce((total, step) => {
    return (
      total +
      buildWorkflowStepPrompt({
        step,
        values: input.values,
        preview: true,
      }).length
    )
  }, 0)
  const imageSteps = input.steps.filter((step) => step.mode === 'image').length

  if (imageSteps > 0 || input.steps.length >= 5 || expandedCharacters >= 8000) {
    return 'high'
  }

  if (input.steps.length >= 3 || expandedCharacters >= 3000) {
    return 'medium'
  }

  return 'low'
}
