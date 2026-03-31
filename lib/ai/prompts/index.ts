import { AIMode } from '@/types'
import { creativeSystemPrompt } from './creative'
import { logicSystemPrompt } from './logic'
import { codeSystemPrompt } from './code'

export const SYSTEM_PROMPTS: Record<AIMode, string> = {
  creative: creativeSystemPrompt,
  logic: logicSystemPrompt,
  code: codeSystemPrompt,
}
