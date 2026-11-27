import type { WorkspaceTool } from '@/lib/chat-context'

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
