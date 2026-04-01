import { SYSTEM_PRESET_CONFIGS } from '@/lib/config'
import { AIMode, SystemPresetId } from '@/types'
import { generalSystemPrompt } from './general'
import { creativeSystemPrompt } from './creative'
import { logicSystemPrompt } from './logic'
import { codeSystemPrompt } from './code'
import { liveSystemPrompt } from './live'
import { imageSystemPrompt } from './image'

export const SYSTEM_PROMPTS: Record<AIMode, string> = {
  general: generalSystemPrompt,
  creative: creativeSystemPrompt,
  logic: logicSystemPrompt,
  code: codeSystemPrompt,
  live: liveSystemPrompt,
  image: imageSystemPrompt,
}

export function buildSystemPrompt(
  mode: AIMode,
  preset: SystemPresetId = 'default'
): string {
  const basePrompt = SYSTEM_PROMPTS[mode]
  const presetPrompt = SYSTEM_PRESET_CONFIGS[preset].promptSuffix

  return presetPrompt ? `${basePrompt}\n\n${presetPrompt}` : basePrompt
}
