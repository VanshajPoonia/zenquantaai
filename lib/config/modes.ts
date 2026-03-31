import { AIMode, ModeConfig } from '@/types'
import { MODEL_ROUTE_CONFIGS } from './models'

const MODE_DISPLAY_CONFIGS: Record<
  AIMode,
  Omit<ModeConfig, keyof typeof MODEL_ROUTE_CONFIGS.creative | 'description'>
> = {
  creative: {
    id: 'creative',
    name: 'Creative Writer',
    placeholder: 'Draft a story, campaign, script, or idea...',
    helperText:
      'Imaginative, expressive, elegant writing for storytelling, copy, and rewording.',
    emptyStateTitle: 'Create With A Specialist Story Engine',
    emptyStateDescription:
      'Shape campaigns, stories, scripts, and brand language with a mode tuned for originality, rhythm, and tone.',
    suggestedPrompts: [
      'Write launch copy for a premium productivity app aimed at solo founders',
      'Turn this product blurb into a sharper, more luxurious landing page hero',
      'Outline a short film about memory, ambition, and second chances',
      'Brainstorm distinctive names for an AI studio focused on creative strategy',
    ],
    accentColor: 'creative',
    icon: 'sparkles',
  },
  logic: {
    id: 'logic',
    name: 'Logic Focused',
    placeholder: 'Ask for precise reasoning, analysis, or breakdown...',
    helperText:
      'Precise, structured analysis for breakdowns, comparisons, and decision support.',
    emptyStateTitle: 'Reason Through The Hard Parts',
    emptyStateDescription:
      'Work through tradeoffs, assumptions, and decisions with a mode optimized for correctness and clarity.',
    suggestedPrompts: [
      'Compare usage-based pricing vs seat-based pricing for a B2B SaaS product',
      'Explain event sourcing in plain English with pros, cons, and tradeoffs',
      'Break down whether we should hire engineering first or sales first',
      'Create a decision framework for choosing between three go-to-market channels',
    ],
    accentColor: 'logic',
    icon: 'brain',
  },
  code: {
    id: 'code',
    name: 'Code Assistant',
    placeholder: 'Describe the feature, bug, or code you need...',
    helperText:
      'Developer-first implementation help for debugging, architecture, and backend tasks.',
    emptyStateTitle: 'Ship With A Technical Co-Pilot',
    emptyStateDescription:
      'Debug issues, scaffold features, and turn product ideas into implementation-ready code with a specialist coding model.',
    suggestedPrompts: [
      'Build a reusable settings drawer component in Next.js and Tailwind',
      'Debug why this React effect causes duplicate requests',
      'Explain the architecture of a streaming chat API in practical terms',
      'Write a typed route handler for a server action with Zod validation',
    ],
    accentColor: 'code',
    icon: 'code',
  },
}

export const MODE_CONFIGS: Record<AIMode, ModeConfig> = {
  creative: {
    ...MODEL_ROUTE_CONFIGS.creative,
    ...MODE_DISPLAY_CONFIGS.creative,
  },
  logic: {
    ...MODEL_ROUTE_CONFIGS.logic,
    ...MODE_DISPLAY_CONFIGS.logic,
  },
  code: {
    ...MODEL_ROUTE_CONFIGS.code,
    ...MODE_DISPLAY_CONFIGS.code,
  },
}

export const MODE_ORDER: AIMode[] = ['creative', 'logic', 'code']
