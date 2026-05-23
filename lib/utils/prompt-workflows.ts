import { AssistantFamily, AIMode, PromptWorkflowVariable } from '@/types'

export const WORKFLOW_VARIABLE_PATTERN = /\{\{\s*([a-zA-Z][a-zA-Z0-9_-]*)\s*\}\}/g

export const WORKFLOW_FAMILY_TO_MODE: Record<AssistantFamily, AIMode> = {
  nova: 'general',
  velora: 'creative',
  axiom: 'logic',
  forge: 'code',
  pulse: 'live',
  prism: 'image',
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
