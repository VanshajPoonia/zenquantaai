import { Conversation, ConversationFork, Message, SessionSettings } from '@/types'
import { DEFAULT_PROJECT_ID } from '@/lib/config'
import { compareMessagesChronologically, createConversation, createId } from '@/lib/utils/chat'
import { withTitleSuffix } from '@/lib/share/copy'

export const MAX_BRANCH_MESSAGES = 1_000

/** Reads `forkedFrom` out of stored session settings, or null when it is missing or malformed. */
export function readConversationFork(sessionSettings: unknown): ConversationFork | null {
  if (!sessionSettings || typeof sessionSettings !== 'object') return null
  const fork = (sessionSettings as { forkedFrom?: unknown }).forkedFrom
  if (!fork || typeof fork !== 'object') return null

  const { conversationId, messageId, title } = fork as Record<string, unknown>
  if (typeof conversationId !== 'string' || typeof messageId !== 'string') return null
  return {
    conversationId,
    messageId,
    title: typeof title === 'string' ? title : 'Untitled chat',
  }
}

export type BranchSelection =
  | { ok: true; messages: Message[] }
  | { ok: false; reason: 'not_found' | 'streaming' }

/** Messages up to and including `messageId`, or only the ones before it when `before` is set. */
export function selectBranchMessages(
  messages: Message[],
  messageId: string,
  options: { before?: boolean } = {}
): BranchSelection {
  const ordered = [...messages].sort(compareMessagesChronologically)
  const index = ordered.findIndex((message) => message.id === messageId)
  if (index === -1) return { ok: false, reason: 'not_found' }
  if (ordered[index].status === 'streaming') return { ok: false, reason: 'streaming' }

  const end = options.before ? index : index + 1
  return {
    ok: true,
    messages: ordered.slice(0, end).filter((message) => message.status !== 'streaming'),
  }
}

export function getBranchTitle(title: string): string {
  return withTitleSuffix(title.replace(/ \(branch\)$/, ''), ' (branch)')
}

/** A new web chat with copies of the chosen messages. The source chat is not touched. */
export function buildBranchConversation(
  source: Conversation,
  input: { messages: Message[]; messageId: string }
): Conversation {
  const forkedFrom: ConversationFork = {
    conversationId: source.id,
    messageId: input.messageId,
    title: (source.title || 'Untitled chat').slice(0, 200),
  }
  const newIds = new Map(input.messages.map((message) => [message.id, createId('msg')]))
  const messages = input.messages.map((message): Message => {
    const { usage: _usage, ...rest } = message
    return {
      ...rest,
      id: newIds.get(message.id)!,
      parentUserMessageId: message.parentUserMessageId
        ? newIds.get(message.parentUserMessageId)
        : undefined,
      attachments: message.attachments?.map(({ previewUrl: _previewUrl, ...attachment }) => attachment),
    }
  })
  // forkedFrom rides along in session_settings, so the branch needs no migration.
  const sessionSettings: SessionSettings & { forkedFrom: ConversationFork } = {
    ...source.sessionSettings,
    forkedFrom,
  }

  const conversation = createConversation({
    mode: source.mode,
    projectId: source.surface === 'cli' ? DEFAULT_PROJECT_ID : source.projectId,
    sessionSettings,
    title: getBranchTitle(source.title || 'Untitled chat'),
    messages,
    customAssistantId: source.customAssistantId ?? null,
    customAssistant: source.customAssistant ?? null,
  })

  return { ...conversation, forkedFrom }
}
