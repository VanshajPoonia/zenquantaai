import 'server-only'

import { neonProjectsRepository } from '@/lib/db/repositories'
import type { AppSettings } from '@/types'
import { buildUserInstructionsBlock } from './user-instructions'

/** Builds the instructions block from Neon only. Text sent by the client is never used. */
export async function loadUserInstructionsBlock(input: {
  userId: string
  settings: Pick<AppSettings, 'aboutYou' | 'responseInstructions' | 'useCustomInstructions'>
  projectId?: string | null
}): Promise<string> {
  const project = input.projectId
    ? await neonProjectsRepository.get(input.userId, input.projectId)
    : null

  return buildUserInstructionsBlock({
    aboutYou: input.settings.aboutYou,
    responseInstructions: input.settings.responseInstructions,
    useCustomInstructions: input.settings.useCustomInstructions,
    projectName: project?.name,
    projectInstructions: project?.instructions,
  })
}
