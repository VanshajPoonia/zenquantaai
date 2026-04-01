import { AssistantFamily } from '@/types'

export interface PromptSignalContext {
  prompt: string
  normalizedPrompt: string
  attachmentNames: string[]
  normalizedAttachmentNames: string
  kind: 'chat' | 'image'
}

export interface AssistantSignal {
  assistant: AssistantFamily
  label: string
  weight: number
  reason: string
  strong?: boolean
}

type Rule = (context: PromptSignalContext) => AssistantSignal[]

const IMAGE_PATTERN =
  /\b(generate|create|make|design|render|illustrate|edit|retouch|remove background|upscale|mockup)\b[\s\S]{0,40}\b(image|photo|poster|logo|banner|illustration|icon|thumbnail|visual|picture)\b/i
const IMAGE_EDIT_PATTERN =
  /\b(edit this image|edit this photo|remove the background|retouch this|turn this into an illustration|make this look like)\b/i
const CODE_FENCE_PATTERN = /```[\s\S]*```/
const STACK_TRACE_PATTERN =
  /\b(traceback|stack trace|typeerror:|referenceerror:|syntaxerror:|exception:|npm err!|error:\s|at\s+[^\n]+\([^)]+\))\b/i
const FILE_NAME_PATTERN =
  /\b[\w./-]+\.(ts|tsx|js|jsx|mjs|cjs|py|go|java|rb|rs|php|html|css|scss|sql|json|yaml|yml)\b/i
const CODE_INTENT_PATTERN =
  /\b(debug|fix|refactor|implement|write code|api route|endpoint|function|component|hook|typescript|javascript|python|next\.?js|react|node|schema|query|class|stack trace)\b/i
const CURRENT_INFO_PATTERN =
  /\b(latest|today|current|recent|recently|news|market update|what happened|breaking|this week|right now|up to date)\b/i
const CREATIVE_PATTERN =
  /\b(story|storytelling|brand story|rewrite|rephrase|tone|voice|script|screenplay|slogan|tagline|headline|ad copy|campaign|poem|lyrics|creative)\b/i
const LOGIC_PATTERN =
  /\b(compare|comparison|pros and cons|tradeoffs?|framework|decision|analy[sz]e|analysis|evaluate|versus|vs\.?|choose between|break down|reason through)\b/i
const GENERAL_PATTERN =
  /\b(explain|summary|summarize|help me understand|what is|how does|walk me through|overview)\b/i
const CURRENT_LOCK_PATTERN =
  /\b(don't switch|do not switch|stay on (the )?current assistant|keep this assistant)\b/i
const EXPLICIT_ASSISTANT_PATTERN =
  /\b(?:use|answer as)\s+(nova|velora|axiom|forge|pulse|prism)\b/i

const RULES: Rule[] = [
  (context) => {
    const signals: AssistantSignal[] = []

    if (context.kind === 'image') {
      signals.push({
        assistant: 'prism',
        label: 'image-mode',
        weight: 10,
        reason: 'the prompt is being sent as an image-generation request',
        strong: true,
      })
    }

    if (
      IMAGE_PATTERN.test(context.prompt) ||
      IMAGE_EDIT_PATTERN.test(context.prompt)
    ) {
      signals.push({
        assistant: 'prism',
        label: 'image-request',
        weight: 10,
        reason: 'it is clearly asking to create or edit an image',
        strong: true,
      })
    }

    return signals
  },
  (context) => {
    const signals: AssistantSignal[] = []

    if (CODE_FENCE_PATTERN.test(context.prompt)) {
      signals.push({
        assistant: 'forge',
        label: 'code-fence',
        weight: 9,
        reason: 'it includes code fences',
        strong: true,
      })
    }

    if (STACK_TRACE_PATTERN.test(context.prompt)) {
      signals.push({
        assistant: 'forge',
        label: 'stack-trace',
        weight: 9,
        reason: 'it includes stack-trace or runtime error signals',
        strong: true,
      })
    }

    if (
      FILE_NAME_PATTERN.test(context.prompt) ||
      FILE_NAME_PATTERN.test(context.normalizedAttachmentNames)
    ) {
      signals.push({
        assistant: 'forge',
        label: 'file-extension',
        weight: 8,
        reason: 'it references source files or code-heavy file types',
        strong: true,
      })
    }

    if (CODE_INTENT_PATTERN.test(context.prompt)) {
      signals.push({
        assistant: 'forge',
        label: 'code-intent',
        weight: 6,
        reason: 'it is asking for debugging, implementation, or programming help',
      })
    }

    return signals
  },
  (context) =>
    CURRENT_INFO_PATTERN.test(context.prompt)
      ? [
          {
            assistant: 'pulse',
            label: 'current-info',
            weight: 8,
            reason: 'it asks for current, latest, or news-style information',
            strong: true,
          },
        ]
      : [],
  (context) =>
    CREATIVE_PATTERN.test(context.prompt)
      ? [
          {
            assistant: 'velora',
            label: 'creative-writing',
            weight: 6,
            reason: 'it asks for storytelling, rewriting, or brand-language work',
          },
        ]
      : [],
  (context) =>
    LOGIC_PATTERN.test(context.prompt)
      ? [
          {
            assistant: 'axiom',
            label: 'analysis',
            weight: 6,
            reason: 'it asks for comparison, analysis, tradeoffs, or decision support',
          },
        ]
      : [],
  (context) =>
    GENERAL_PATTERN.test(context.prompt)
      ? [
          {
            assistant: 'nova',
            label: 'general-help',
            weight: 2,
            reason: 'it looks like a broad explanation or general-assistance request',
          },
        ]
      : [],
]

export function getExplicitAssistantPreference(
  prompt: string
): AssistantFamily | 'current' | null {
  if (CURRENT_LOCK_PATTERN.test(prompt)) {
    return 'current'
  }

  const match = prompt.match(EXPLICIT_ASSISTANT_PATTERN)
  if (!match?.[1]) {
    return null
  }

  return match[1].toLowerCase() as AssistantFamily
}

export function collectAssistantSignals(
  context: PromptSignalContext
): AssistantSignal[] {
  return RULES.flatMap((rule) => rule(context))
}
