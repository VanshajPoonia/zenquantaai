import type { AgentTool } from '@earendil-works/pi-agent-core'
import { obj, str } from '@earendil-works/pi-schema'
import type { ToolDetails } from '../types'
import { toolResult } from './shared'

const parameters = obj({
  prompt: str({ description: 'A detailed image prompt for Prism.', minLength: 1, maxLength: 2_000 }),
})

/** Prepares a Prism prompt. The user clicks to generate, so no image credits are spent here. */
export function createMakeImageTool(): AgentTool<typeof parameters, ToolDetails> {
  return {
    name: 'make_image',
    label: 'Prepared an image prompt',
    description:
      'Prepare an image for Prism when the user wants a picture, illustration or visual. The user confirms before it is generated. Tell them they can click "Create with Prism".',
    parameters,
    execute: async (_callId, params) =>
      toolResult('The image prompt is ready. The user will see a "Create with Prism" button.', {
        summary: 'Image prompt ready for Prism',
        data: { imagePrompt: params.prompt },
      }),
  }
}
