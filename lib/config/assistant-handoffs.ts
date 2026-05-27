import { AIMode, AssistantFamily, Message } from '@/types'
import { ASSISTANT_FAMILY_COPY, FAMILY_TO_MODE, MODE_TO_FAMILY } from './assistants'

const HANDOFF_EXCERPT_LIMIT = 5_000
const HANDOFF_SOURCE_LIMIT = 4

export interface AssistantHandoffTarget {
  family: AssistantFamily
  mode: AIMode
  label: string
  actionLabel: string
  description: string
  instruction: string
}

export const ASSISTANT_HANDOFF_TARGETS: AssistantHandoffTarget[] = [
  {
    family: 'nova',
    mode: FAMILY_TO_MODE.nova,
    label: ASSISTANT_FAMILY_COPY.nova.shortName,
    actionLabel: 'Practical next steps',
    description: 'Turn this into a clear, useful next action plan.',
    instruction:
      'Continue this work as Nova. Extract the most practical next steps, organize them by priority, and keep the answer useful for immediate execution.',
  },
  {
    family: 'velora',
    mode: FAMILY_TO_MODE.velora,
    label: ASSISTANT_FAMILY_COPY.velora.shortName,
    actionLabel: 'Tone and copy polish',
    description: 'Improve voice, flow, copy, and creative direction.',
    instruction:
      'Continue this work as Velora. Polish the language, improve tone and flow, and make the output more compelling without losing the original intent.',
  },
  {
    family: 'axiom',
    mode: FAMILY_TO_MODE.axiom,
    label: ASSISTANT_FAMILY_COPY.axiom.shortName,
    actionLabel: 'Critique or decision matrix',
    description: 'Stress-test the answer with structure and tradeoffs.',
    instruction:
      'Continue this work as Axiom. Critique the answer, identify assumptions and weaknesses, then provide a structured decision matrix or tradeoff analysis where useful.',
  },
  {
    family: 'forge',
    mode: FAMILY_TO_MODE.forge,
    label: ASSISTANT_FAMILY_COPY.forge.shortName,
    actionLabel: 'Implementation plan or code review',
    description: 'Translate the answer into technical execution.',
    instruction:
      'Continue this work as Forge. Convert the answer into an implementation plan, architecture notes, code review checklist, or concrete technical next steps.',
  },
  {
    family: 'pulse',
    mode: FAMILY_TO_MODE.pulse,
    label: ASSISTANT_FAMILY_COPY.pulse.shortName,
    actionLabel: 'Source-backed research',
    description: 'Research, verify, and update the answer with current context.',
    instruction:
      'Continue this work as Pulse. Check what needs current or source-backed context, verify the important claims where possible, and summarize the latest useful research direction.',
  },
  {
    family: 'prism',
    mode: FAMILY_TO_MODE.prism,
    label: ASSISTANT_FAMILY_COPY.prism.shortName,
    actionLabel: 'Image prompt or visual concept',
    description: 'Turn the answer into a visual direction for image generation.',
    instruction:
      'Continue this work as Prism. Turn the answer into a polished image-generation prompt or visual concept with subject, composition, style, lighting, color, and mood.',
  },
]

function truncateExcerpt(content: string): string {
  const trimmed = content.trim()
  if (trimmed.length <= HANDOFF_EXCERPT_LIMIT) return trimmed

  return `${trimmed.slice(0, HANDOFF_EXCERPT_LIMIT).trimEnd()}\n\n[Response excerpt truncated for handoff.]`
}

function formatSourceHints(message: Message): string {
  const sources = message.sources?.slice(0, HANDOFF_SOURCE_LIMIT) ?? []
  if (sources.length === 0) return 'No source metadata was attached to this response.'

  return sources
    .map((source) =>
      [
        `- ${source.id}: ${source.title}`,
        source.domain ? `  Domain: ${source.domain}` : '',
        source.url ? `  URL: ${source.url}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    )
    .join('\n')
}

export function buildAssistantHandoffPrompt(input: {
  message: Message
  target: AssistantHandoffTarget
}): string {
  const { message, target } = input
  const sourceFamily = message.assistantFamily ?? MODE_TO_FAMILY[message.mode]
  const sourceAssistant =
    message.customAssistant?.name ??
    ASSISTANT_FAMILY_COPY[sourceFamily].shortName
  const metadataLines = [
    `Source assistant: ${sourceAssistant}`,
    `Source mode: ${message.mode}`,
    message.model ? `Source model: ${message.model}` : null,
  ].filter((line): line is string => Boolean(line))

  return [
    target.instruction,
    '',
    'Use the assistant response below as the source material. Keep continuity with the current conversation, but do not simply repeat the response. Produce the next useful output for the target assistant role.',
    '',
    '[Source response metadata]',
    ...metadataLines,
    '',
    '[Source hints]',
    formatSourceHints(message),
    '',
    '[Assistant response to hand off]',
    truncateExcerpt(message.content),
  ].join('\n')
}
