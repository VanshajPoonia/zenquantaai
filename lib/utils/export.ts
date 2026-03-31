import { Conversation } from '@/types'

function formatAttachments(conversation: Conversation): string {
  const attachments = conversation.attachments ?? []
  if (attachments.length === 0) return ''

  return [
    '## Attachments',
    '',
    ...attachments.map(
      (attachment) =>
        `- ${attachment.name} (${attachment.kind}, ${Math.round(attachment.size / 1024)} KB)`
    ),
    '',
  ].join('\n')
}

export function conversationToMarkdown(conversation: Conversation): string {
  const header = [
    `# ${conversation.title}`,
    '',
    `- Mode: ${conversation.mode}`,
    `- Updated: ${conversation.updatedAt}`,
    '',
  ].join('\n')

  const messages = conversation.messages
    .map((message) => {
      const attachmentBlock =
        message.attachments && message.attachments.length > 0
          ? [
              '',
              'Attachments:',
              ...message.attachments.map((attachment) => `- ${attachment.name}`),
            ].join('\n')
          : ''

      return `## ${message.role === 'user' ? 'User' : 'Assistant'}\n\n${message.content}${attachmentBlock}\n`
    })
    .join('\n')

  return `${header}${formatAttachments(conversation)}${messages}`.trim()
}

export function conversationToJson(conversation: Conversation): string {
  return JSON.stringify(conversation, null, 2)
}

export function downloadTextFile(
  filename: string,
  content: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
