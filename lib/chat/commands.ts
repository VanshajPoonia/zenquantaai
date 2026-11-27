import type { AIMode, CustomAssistant, PromptLibraryItem, PromptWorkflow } from '@/types'
import type { WorkspaceTool } from '@/lib/chat-context'
import { MODE_CONFIGS, MODE_ORDER } from '@/lib/config'

// Tools both the command palette and the composer's slash menu can open.
export interface WorkspaceToolCommand {
  tool: WorkspaceTool
  label: string
  keywords: string
  slash?: string
  hint?: string
}

export const WORKSPACE_TOOL_COMMANDS: readonly WorkspaceToolCommand[] = [
  { tool: 'prompt-library', label: 'prompt library', keywords: 'prompt library prompts' },
  { tool: 'playbooks', label: 'AI Playbooks', keywords: 'ai playbooks workflows reusable runs' },
  {
    tool: 'artifacts',
    label: 'Artifact Studio',
    keywords: 'artifact studio artifacts saved outputs',
    slash: 'artifacts',
    hint: 'Saved outputs from your chats',
  },
  {
    tool: 'memory-vault',
    label: 'Memory Vault',
    keywords: 'memory vault conversation summaries preferences',
    slash: 'memory',
    hint: 'What Zenquanta remembers',
  },
  {
    tool: 'pulse-research-room',
    label: 'Pulse Research Room',
    keywords: 'pulse research room sources web search citations',
    slash: 'research',
    hint: 'Research and sources',
  },
  {
    tool: 'ask-files',
    label: 'Ask Files',
    keywords: 'ask files uploaded file rag knowledge retrieval',
    slash: 'files',
    hint: 'Ask about your uploaded files',
  },
  {
    tool: 'github-integration',
    label: 'GitHub repo context',
    keywords: 'github repo context forge code integration',
  },
  {
    tool: 'model-comparison',
    label: 'Model Duel',
    keywords: 'model duel compare assistants models',
    slash: 'compare',
    hint: 'Compare answers side by side',
  },
  { tool: 'custom-assistants', label: 'custom assistants', keywords: 'custom assistants builder' },
  { tool: 'prism-studio', label: 'Prism Studio', keywords: 'prism image history recent generations' },
]

export type ComposerTrigger = { type: 'slash' | 'mention'; query: string }

// A menu opens while the whole draft is one "/word" or "@word" token.
export function parseComposerTrigger(draft: string): ComposerTrigger | null {
  const match = /^([/@])(\S*)$/.exec(draft)
  if (!match) return null
  return { type: match[1] === '/' ? 'slash' : 'mention', query: match[2] }
}

export type SlashAction =
  | { type: 'prompt'; content: string }
  | { type: 'playbook'; workflowId: string }
  | { type: 'tool'; tool: WorkspaceTool }
  | { type: 'compare' }
  | { type: 'image' }
  | { type: 'new-chat' }
  | { type: 'export' }

export type SlashGroup = 'prompts' | 'playbooks' | 'tools' | 'chat'

export interface SlashItem {
  id: string
  group: SlashGroup
  name?: string
  label: string
  hint?: string
  action: SlashAction
}

export const SLASH_GROUP_LABELS: Record<SlashGroup, string> = {
  prompts: 'Your prompts',
  playbooks: 'Playbooks',
  tools: 'Tools',
  chat: 'Chat',
}

const SLASH_GROUP_ORDER: SlashGroup[] = ['prompts', 'playbooks', 'tools', 'chat']
const MAX_ITEMS_PER_GROUP = 20

export function buildSlashItems(input: {
  prompts: PromptLibraryItem[]
  playbooks: PromptWorkflow[]
  canExport: boolean
}): SlashItem[] {
  const items: SlashItem[] = []

  for (const prompt of input.prompts) {
    items.push({
      id: `prompt:${prompt.id}`,
      group: 'prompts',
      label: prompt.title,
      hint: oneLine(prompt.content, 60),
      action: { type: 'prompt', content: prompt.content },
    })
  }

  for (const playbook of input.playbooks) {
    items.push({
      id: `playbook:${playbook.id}`,
      group: 'playbooks',
      label: playbook.title,
      hint: `${playbook.steps.length} step${playbook.steps.length === 1 ? '' : 's'}`,
      action: { type: 'playbook', workflowId: playbook.id },
    })
  }

  items.push({
    id: 'tool:image',
    group: 'tools',
    name: 'image',
    label: 'Create an image',
    hint: 'Switch this message to Prism',
    action: { type: 'image' },
  })

  for (const command of WORKSPACE_TOOL_COMMANDS) {
    if (!command.slash) continue
    items.push({
      id: `tool:${command.slash}`,
      group: 'tools',
      name: command.slash,
      label: command.label,
      hint:
        command.tool === 'model-comparison'
          ? 'Type a prompt after /compare'
          : command.hint,
      action:
        command.tool === 'model-comparison'
          ? { type: 'compare' }
          : { type: 'tool', tool: command.tool },
    })
  }

  items.push({
    id: 'chat:new',
    group: 'chat',
    name: 'new',
    label: 'New chat',
    action: { type: 'new-chat' },
  })

  if (input.canExport) {
    items.push({
      id: 'chat:export',
      group: 'chat',
      name: 'export',
      label: 'Export chat',
      hint: 'Download as Markdown',
      action: { type: 'export' },
    })
  }

  return items
}

// Lower is better: the command name, then a word in the label, then anywhere.
export function matchRank(query: string, name: string | undefined, label: string): number | null {
  const needle = query.trim().toLowerCase()
  if (!needle) return 0

  const lowerName = name?.toLowerCase() ?? ''
  const lowerLabel = label.toLowerCase()

  if (lowerName.startsWith(needle)) return 0
  if (lowerLabel.startsWith(needle)) return 1
  if (lowerLabel.split(/[^a-z0-9]+/).some((word) => word.startsWith(needle))) return 2
  if (lowerName.includes(needle) || lowerLabel.includes(needle)) return 3
  return null
}

export function filterSlashItems(items: SlashItem[], query: string): SlashItem[] {
  return SLASH_GROUP_ORDER.flatMap((group) =>
    items
      .filter((item) => item.group === group)
      .map((item, index) => ({ item, index, rank: matchRank(query, item.name, item.label) }))
      .filter((entry): entry is { item: SlashItem; index: number; rank: number } => entry.rank !== null)
      .sort((a, b) => a.rank - b.rank || a.index - b.index)
      .slice(0, MAX_ITEMS_PER_GROUP)
      .map((entry) => entry.item)
  )
}

// "/compare why is the sky blue" and "/image a red fox" carry their prompt.
export function parseSlashSubmission(
  draft: string
): { command: 'compare' | 'image'; rest: string } | null {
  const match = /^\/(compare|image)(?:\s+([\s\S]*))?$/i.exec(draft.trim())
  if (!match) return null
  return {
    command: match[1].toLowerCase() as 'compare' | 'image',
    rest: (match[2] ?? '').trim(),
  }
}

export interface MentionTarget {
  id: string
  handle: string
  label: string
  hint: string
  mode: AIMode
  customAssistantId: string | null
  iconEmoji?: string
}

export function toMentionHandle(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function buildMentionTargets(
  roles: Record<AIMode, string>,
  customAssistants: CustomAssistant[] = []
): MentionTarget[] {
  const targets: MentionTarget[] = MODE_ORDER.map((mode) => ({
    id: `mode:${mode}`,
    handle: toMentionHandle(MODE_CONFIGS[mode].name),
    label: MODE_CONFIGS[mode].name,
    hint: roles[mode],
    mode,
    customAssistantId: null,
  }))
  const taken = new Set(targets.map((target) => target.handle))

  for (const assistant of customAssistants) {
    const handle = toMentionHandle(assistant.name)
    if (!assistant.isEnabled || !handle || taken.has(handle)) continue
    taken.add(handle)
    targets.push({
      id: `custom:${assistant.id}`,
      handle,
      label: assistant.name,
      hint: `Built on ${MODE_CONFIGS[assistant.baseMode].name}`,
      mode: assistant.baseMode,
      customAssistantId: assistant.id,
      iconEmoji: assistant.iconEmoji,
    })
  }

  return targets
}

export function filterMentionTargets(targets: MentionTarget[], query: string): MentionTarget[] {
  return targets
    .map((target, index) => ({ target, index, rank: matchRank(query, target.handle, target.label) }))
    .filter((entry): entry is { target: MentionTarget; index: number; rank: number } => entry.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.target)
}

// "@forge fix this" names an assistant once a space follows the handle.
export function parseLeadingMention(
  draft: string,
  targets: MentionTarget[]
): { target: MentionTarget; rest: string } | null {
  const match = /^@(\S+)\s([\s\S]*)$/.exec(draft)
  if (!match) return null
  const handle = match[1].toLowerCase()
  const target = targets.find((item) => item.handle === handle)
  if (!target) return null
  return { target, rest: match[2].replace(/^\s+/, '') }
}

export function mentionPrefixFor(
  targets: MentionTarget[],
  mode: AIMode,
  customAssistantId: string | null | undefined
): string {
  const target = targets.find((item) =>
    customAssistantId
      ? item.customAssistantId === customAssistantId
      : item.customAssistantId === null && item.mode === mode
  )
  return target ? `@${target.handle} ` : ''
}

export function oneLine(text: string, max = 80): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 3).trimEnd()}...` : flat
}
