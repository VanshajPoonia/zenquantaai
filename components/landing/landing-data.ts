import type { AIMode, AssistantFamily } from '@/types'

// The six assistants in their fixed order. Face i of the die carries i + 1
// pips. Hex values are the app's assistant accents (globals.css) for canvas.
export const ASSISTANTS: {
  family: AssistantFamily
  mode: AIMode
  name: string
  job: string
  short: string
  colorVar: string
  hex: string
}[] = [
  { family: 'nova', mode: 'general', name: 'Nova', short: 'everyday help', job: 'Plans, summaries, recommendations and straight answers.', colorVar: 'var(--general)', hex: '#00cdc5' },
  { family: 'velora', mode: 'creative', name: 'Velora', short: 'writing', job: 'Stories, names, brand voice and polished copy.', colorVar: 'var(--creative)', hex: '#da6fd3' },
  { family: 'axiom', mode: 'logic', name: 'Axiom', short: 'careful thinking', job: 'Comparisons, decisions and step-by-step reasoning.', colorVar: 'var(--logic)', hex: '#0091ff' },
  { family: 'forge', mode: 'code', name: 'Forge', short: 'code', job: 'Builds features, fixes bugs and explains how things work.', colorVar: 'var(--code)', hex: '#30bd44' },
  { family: 'pulse', mode: 'live', name: 'Pulse', short: 'live research', job: 'Searches the web and shows where answers came from.', colorVar: 'var(--live)', hex: '#00b9f8' },
  { family: 'prism', mode: 'image', name: 'Prism', short: 'pictures', job: 'Describe an image and Prism makes it.', colorVar: 'var(--image)', hex: '#ff8455' },
]
