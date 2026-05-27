import { AIMode, AssistantFamily, Message } from '@/types'
import { ASSISTANT_FAMILY_COPY, FAMILY_TO_MODE, MODE_TO_FAMILY } from './assistants'

const QUALITY_EXCERPT_LIMIT = 5_000
const QUALITY_SOURCE_LIMIT = 4

export type AssistantQualityActionGroup =
  | 'general'
  | 'axiom'
  | 'pulse'
  | 'forge'
  | 'velora'
  | 'prism'

export type AssistantQualityActionId =
  | 'make_shorter'
  | 'make_more_detailed'
  | 'action_plan'
  | 'explain_new'
  | 'format_table'
  | 'challenge_answer'
  | 'hidden_assumptions'
  | 'decision_matrix'
  | 'compare_alternatives'
  | 'verify_sources'
  | 'newer_sources'
  | 'opposing_views'
  | 'research_brief'
  | 'find_bugs'
  | 'add_tests'
  | 'explain_architecture'
  | 'refactor_plan'
  | 'improve_tone'
  | 'more_persuasive'
  | 'social_rewrite'
  | 'headline_options'
  | 'image_prompt'
  | 'visual_directions'
  | 'matching_caption'

export interface AssistantQualityAction {
  id: AssistantQualityActionId
  group: AssistantQualityActionGroup
  label: string
  description: string
  targetMode: AIMode | 'source_text'
  kind: 'chat' | 'image'
  instruction: string
}

export interface AssistantQualityActionGroupConfig {
  id: AssistantQualityActionGroup
  label: string
  family?: AssistantFamily
  actions: AssistantQualityAction[]
}

const action = (
  input: Omit<AssistantQualityAction, 'kind'> & { kind?: 'chat' | 'image' }
): AssistantQualityAction => ({
  kind: input.targetMode === 'image' ? 'image' : input.kind ?? 'chat',
  ...input,
})

export const ASSISTANT_QUALITY_ACTION_GROUPS: AssistantQualityActionGroupConfig[] = [
  {
    id: 'general',
    label: 'General',
    actions: [
      action({
        id: 'make_shorter',
        group: 'general',
        label: 'Make shorter',
        description: 'Condense this response while preserving the key points.',
        targetMode: 'source_text',
        instruction:
          'Make the source response shorter. Preserve the key information, remove repetition, and keep the final answer easy to scan.',
      }),
      action({
        id: 'make_more_detailed',
        group: 'general',
        label: 'Make more detailed',
        description: 'Expand this with more detail and useful context.',
        targetMode: 'source_text',
        instruction:
          'Make the source response more detailed. Add useful context, examples, caveats, and clearer structure without drifting from the original task.',
      }),
      action({
        id: 'action_plan',
        group: 'general',
        label: 'Turn into action plan',
        description: 'Convert this into prioritized next steps.',
        targetMode: FAMILY_TO_MODE.nova,
        instruction:
          'Turn the source response into a practical action plan with priorities, concrete next steps, and a short checklist.',
      }),
      action({
        id: 'explain_new',
        group: 'general',
        label: "Explain like I'm new",
        description: 'Make this beginner-friendly.',
        targetMode: FAMILY_TO_MODE.nova,
        instruction:
          'Rewrite the source response for someone new to the topic. Define terms, use plain language, and include a simple example.',
      }),
      action({
        id: 'format_table',
        group: 'general',
        label: 'Format as table',
        description: 'Transform this into a clear comparison or summary table.',
        targetMode: FAMILY_TO_MODE.axiom,
        instruction:
          'Format the source response as a useful markdown table. Add concise columns that make comparison, scanning, or decision-making easier.',
      }),
    ],
  },
  {
    id: 'axiom',
    label: ASSISTANT_FAMILY_COPY.axiom.shortName,
    family: 'axiom',
    actions: [
      action({
        id: 'challenge_answer',
        group: 'axiom',
        label: 'Challenge this answer',
        description: 'Stress-test the response.',
        targetMode: FAMILY_TO_MODE.axiom,
        instruction:
          'Challenge the source response. Identify weak reasoning, unsupported claims, edge cases, and where the answer may be overconfident.',
      }),
      action({
        id: 'hidden_assumptions',
        group: 'axiom',
        label: 'Find hidden assumptions',
        description: 'Surface unstated premises.',
        targetMode: FAMILY_TO_MODE.axiom,
        instruction:
          'Find the hidden assumptions in the source response. Separate explicit facts, inferred assumptions, and risks if an assumption is wrong.',
      }),
      action({
        id: 'decision_matrix',
        group: 'axiom',
        label: 'Create decision matrix',
        description: 'Turn this into weighted criteria.',
        targetMode: FAMILY_TO_MODE.axiom,
        instruction:
          'Create a decision matrix from the source response. Include options, criteria, tradeoffs, risks, and a reasoned recommendation.',
      }),
      action({
        id: 'compare_alternatives',
        group: 'axiom',
        label: 'Compare alternatives',
        description: 'Compare paths or options.',
        targetMode: FAMILY_TO_MODE.axiom,
        instruction:
          'Compare strong alternatives to the source response. Explain where each alternative wins, loses, and what evidence would change the recommendation.',
      }),
    ],
  },
  {
    id: 'pulse',
    label: ASSISTANT_FAMILY_COPY.pulse.shortName,
    family: 'pulse',
    actions: [
      action({
        id: 'verify_sources',
        group: 'pulse',
        label: 'Verify with sources',
        description: 'Check claims with source-backed context.',
        targetMode: FAMILY_TO_MODE.pulse,
        instruction:
          'Verify the source response with source-backed research. Identify which claims need checking, cite useful sources when available, and flag anything unverified.',
      }),
      action({
        id: 'newer_sources',
        group: 'pulse',
        label: 'Find newer sources',
        description: 'Look for more current context.',
        targetMode: FAMILY_TO_MODE.pulse,
        instruction:
          'Find newer source context for the source response. Focus on recent updates, current data, official sources, and what may have changed.',
      }),
      action({
        id: 'opposing_views',
        group: 'pulse',
        label: 'Find opposing views',
        description: 'Research counterarguments.',
        targetMode: FAMILY_TO_MODE.pulse,
        instruction:
          'Find credible opposing views or counterevidence for the source response. Summarize the strongest counterarguments and how they affect confidence.',
      }),
      action({
        id: 'research_brief',
        group: 'pulse',
        label: 'Build research brief',
        description: 'Turn this into a research-ready brief.',
        targetMode: FAMILY_TO_MODE.pulse,
        instruction:
          'Build a concise research brief from the source response. Include key questions, source-backed findings, gaps, risks, and recommended next research steps.',
      }),
    ],
  },
  {
    id: 'forge',
    label: ASSISTANT_FAMILY_COPY.forge.shortName,
    family: 'forge',
    actions: [
      action({
        id: 'find_bugs',
        group: 'forge',
        label: 'Find bugs',
        description: 'Look for implementation bugs or failure modes.',
        targetMode: FAMILY_TO_MODE.forge,
        instruction:
          'Review the source response for bugs, technical gaps, edge cases, and likely failure modes. Prioritize concrete fixes.',
      }),
      action({
        id: 'add_tests',
        group: 'forge',
        label: 'Add tests',
        description: 'Create a test plan or test cases.',
        targetMode: FAMILY_TO_MODE.forge,
        instruction:
          'Create tests for the source response. Include unit, integration, and manual verification cases where relevant, with expected behavior.',
      }),
      action({
        id: 'explain_architecture',
        group: 'forge',
        label: 'Explain architecture',
        description: 'Turn this into architecture notes.',
        targetMode: FAMILY_TO_MODE.forge,
        instruction:
          'Explain the architecture implied by the source response. Cover components, data flow, boundaries, risks, and implementation order.',
      }),
      action({
        id: 'refactor_plan',
        group: 'forge',
        label: 'Refactor plan',
        description: 'Make a practical refactor plan.',
        targetMode: FAMILY_TO_MODE.forge,
        instruction:
          'Create a refactor plan from the source response. Keep it incremental, identify safe steps, risks, tests, and rollback points.',
      }),
    ],
  },
  {
    id: 'velora',
    label: ASSISTANT_FAMILY_COPY.velora.shortName,
    family: 'velora',
    actions: [
      action({
        id: 'improve_tone',
        group: 'velora',
        label: 'Improve tone',
        description: 'Polish the voice and flow.',
        targetMode: FAMILY_TO_MODE.velora,
        instruction:
          'Improve the tone of the source response. Make it smoother, more polished, and more natural while preserving meaning.',
      }),
      action({
        id: 'more_persuasive',
        group: 'velora',
        label: 'Make more persuasive',
        description: 'Strengthen the argument or pitch.',
        targetMode: FAMILY_TO_MODE.velora,
        instruction:
          'Make the source response more persuasive. Strengthen the hook, value, proof, emotional clarity, and call to action where relevant.',
      }),
      action({
        id: 'social_rewrite',
        group: 'velora',
        label: 'Rewrite for social media',
        description: 'Create social-ready versions.',
        targetMode: FAMILY_TO_MODE.velora,
        instruction:
          'Rewrite the source response for social media. Provide a concise post, a punchier variant, and a thread-style version if useful.',
      }),
      action({
        id: 'headline_options',
        group: 'velora',
        label: 'Generate headline options',
        description: 'Create sharper titles or hooks.',
        targetMode: FAMILY_TO_MODE.velora,
        instruction:
          'Generate headline options from the source response. Include a range of clear, specific, persuasive, and curiosity-driven options.',
      }),
    ],
  },
  {
    id: 'prism',
    label: ASSISTANT_FAMILY_COPY.prism.shortName,
    family: 'prism',
    actions: [
      action({
        id: 'image_prompt',
        group: 'prism',
        label: 'Turn into an image prompt',
        description: 'Generate a visual from this response.',
        targetMode: FAMILY_TO_MODE.prism,
        instruction:
          'Create a polished image based on the source response. Focus on a single strong visual concept with subject, composition, lighting, style, color, and mood.',
      }),
      action({
        id: 'visual_directions',
        group: 'prism',
        label: 'Create 4 visual directions',
        description: 'Explore multiple visual routes.',
        targetMode: FAMILY_TO_MODE.prism,
        instruction:
          'Create a visual concept sheet from the source response with four distinct art directions. Make the final image feel polished and production-ready.',
      }),
      action({
        id: 'matching_caption',
        group: 'prism',
        label: 'Generate matching caption',
        description: 'Write a caption for a visual concept.',
        targetMode: FAMILY_TO_MODE.velora,
        instruction:
          'Generate matching captions for the visual concept implied by the source response. Include concise, polished, and social-ready options.',
      }),
    ],
  },
]

export const ASSISTANT_QUALITY_ACTIONS = ASSISTANT_QUALITY_ACTION_GROUPS.flatMap(
  (group) => group.actions
)

function truncateExcerpt(content: string): string {
  const trimmed = content.trim()
  if (trimmed.length <= QUALITY_EXCERPT_LIMIT) return trimmed

  return `${trimmed.slice(0, QUALITY_EXCERPT_LIMIT).trimEnd()}\n\n[Response excerpt truncated for quality action.]`
}

function formatSourceHints(message: Message): string {
  const sources = message.sources?.slice(0, QUALITY_SOURCE_LIMIT) ?? []
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

export function resolveQualityActionMode(
  action: AssistantQualityAction,
  message: Message
): AIMode {
  if (action.targetMode !== 'source_text') return action.targetMode
  return message.mode === 'image' ? FAMILY_TO_MODE.nova : message.mode
}

export function getQualityActionGroupsForMessage(
  message: Message
): AssistantQualityActionGroupConfig[] {
  const sourceFamily = message.assistantFamily ?? MODE_TO_FAMILY[message.mode]
  const general = ASSISTANT_QUALITY_ACTION_GROUPS.find(
    (group) => group.id === 'general'
  )
  const sourceGroup = ASSISTANT_QUALITY_ACTION_GROUPS.find(
    (group) => group.family === sourceFamily
  )
  const rest = ASSISTANT_QUALITY_ACTION_GROUPS.filter(
    (group) => group.id !== 'general' && group.id !== sourceGroup?.id
  )

  return [general, sourceGroup, ...rest].filter(
    (group): group is AssistantQualityActionGroupConfig => Boolean(group)
  )
}

export function buildAssistantQualityPrompt(input: {
  message: Message
  action: AssistantQualityAction
}): string {
  const { message, action } = input
  const targetMode = resolveQualityActionMode(action, message)
  const targetFamily = MODE_TO_FAMILY[targetMode]
  const sourceFamily = message.assistantFamily ?? MODE_TO_FAMILY[message.mode]
  const sourceAssistant =
    message.customAssistant?.name ??
    ASSISTANT_FAMILY_COPY[sourceFamily].shortName
  const metadataLines = [
    `Quality action: ${action.label}`,
    `Target assistant: ${ASSISTANT_FAMILY_COPY[targetFamily].shortName}`,
    `Source assistant: ${sourceAssistant}`,
    `Source mode: ${message.mode}`,
    message.model ? `Source model: ${message.model}` : null,
  ].filter((line): line is string => Boolean(line))

  return [
    action.instruction,
    '',
    'Use the assistant response below as the source material. Keep continuity with the current conversation, but produce a new improved follow-up response for this quality action.',
    '',
    '[Action metadata]',
    ...metadataLines,
    '',
    '[Source hints]',
    formatSourceHints(message),
    '',
    '[Assistant response to improve]',
    truncateExcerpt(message.content),
  ].join('\n')
}
