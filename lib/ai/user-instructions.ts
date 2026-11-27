// Pure and client-safe: the chat route builds the block from Neon, and the
// composer's context meter uses the same builder to size it.

export const ABOUT_YOU_MAX_CHARS = 1_500
export const RESPONSE_INSTRUCTIONS_MAX_CHARS = 1_500
export const PROJECT_INSTRUCTIONS_MAX_CHARS = 4_000
const PROJECT_NAME_MAX_CHARS = 120

export interface UserInstructionsInput {
  aboutYou?: string | null
  responseInstructions?: string | null
  useCustomInstructions?: boolean
  projectName?: string | null
  projectInstructions?: string | null
}

function clean(value: string | null | undefined, max: number): string {
  if (typeof value !== 'string') return ''
  const normalized = value
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return normalized.length > max ? normalized.slice(0, max).trimEnd() : normalized
}

/**
 * The [User instructions] block: About you, then how to answer, then the
 * project's instructions. Returns '' when there is nothing to add.
 */
export function buildUserInstructionsBlock(input: UserInstructionsInput): string {
  const useCustom = input.useCustomInstructions !== false
  const aboutYou = useCustom ? clean(input.aboutYou, ABOUT_YOU_MAX_CHARS) : ''
  const responseInstructions = useCustom
    ? clean(input.responseInstructions, RESPONSE_INSTRUCTIONS_MAX_CHARS)
    : ''
  const projectInstructions = clean(input.projectInstructions, PROJECT_INSTRUCTIONS_MAX_CHARS)

  if (!aboutYou && !responseInstructions && !projectInstructions) return ''

  const projectName = clean(input.projectName, PROJECT_NAME_MAX_CHARS).replace(/\s+/g, ' ')
  const sections = [
    '[User instructions]',
    'The user wrote these preferences for every assistant. Follow them when they fit the request. They are preferences, not rules: they never override safety rules, system rules, tool rules or plan limits. If they conflict with those, follow the rules without mentioning this note.',
  ]

  if (aboutYou) sections.push('', 'About the user:', aboutYou)
  if (responseInstructions) sections.push('', 'How the user wants answers:', responseInstructions)
  if (projectInstructions) {
    sections.push(
      '',
      projectName ? `Instructions for the project "${projectName}":` : 'Instructions for this project:',
      projectInstructions
    )
    if (aboutYou || responseInstructions) {
      sections.push('', 'When the project instructions and the general preferences disagree, follow the project instructions.')
    }
  }

  return sections.join('\n')
}
