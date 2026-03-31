import { AIMode } from '@/types'
import { generalSystemPrompt } from './general'
import { creativeSystemPrompt } from './creative'
import { logicSystemPrompt } from './logic'
import { codeSystemPrompt } from './code'

export const SYSTEM_PROMPTS: Record<AIMode, string> = {
  general: generalSystemPrompt,
  creative: creativeSystemPrompt,
  logic: logicSystemPrompt,
  code: codeSystemPrompt,
}
