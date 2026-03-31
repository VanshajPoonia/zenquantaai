import { SystemPresetConfig, SystemPresetId } from '@/types'

export const SYSTEM_PRESET_CONFIGS: Record<SystemPresetId, SystemPresetConfig> = {
  default: {
    id: 'default',
    label: 'Balanced',
    description: 'Keeps the base mode behavior without extra tone constraints.',
    promptSuffix: '',
  },
  concise: {
    id: 'concise',
    label: 'Concise',
    description: 'Shorter, tighter answers with less filler.',
    promptSuffix:
      'Adjust the response style to be concise. Prefer tight structure, minimal filler, and short practical answers unless the user explicitly asks for depth.',
  },
  detailed: {
    id: 'detailed',
    label: 'Detailed',
    description: 'Adds more depth, context, and explanation.',
    promptSuffix:
      'Adjust the response style to be detailed. Add helpful context, step-by-step structure, and practical nuance when it improves the answer.',
  },
  startup: {
    id: 'startup',
    label: 'Startup Tone',
    description: 'Sharper product language and founder-friendly framing.',
    promptSuffix:
      'Adjust the tone to feel startup-native: crisp, modern, commercially aware, and useful for product, growth, and founder-style communication without sounding hype-driven.',
  },
  academic: {
    id: 'academic',
    label: 'Academic Tone',
    description: 'More formal, evidence-aware, and structured.',
    promptSuffix:
      'Adjust the tone to feel academic: precise, measured, structured, and explicit about assumptions or uncertainty. Favor careful terminology over casual phrasing.',
  },
}
