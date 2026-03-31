import { NextRequest, NextResponse } from 'next/server'
import { appendAuthCookies, requireAuthenticatedUser } from '@/lib/auth/session'
import { DEFAULT_PROJECT_ID } from '@/lib/config'
import {
  conversationStore,
  projectStore,
  promptStore,
  settingsStore,
} from '@/lib/storage'
import { uploadImportedAttachment } from '@/lib/storage/attachments'
import { updateConversationSnapshot } from '@/lib/utils/chat'
import { AppSettings, Conversation, Project, PromptLibraryItem } from '@/types'

export const runtime = 'nodejs'

async function uploadConversationAttachments(
  userId: string,
  conversation: Conversation
): Promise<Conversation> {
  const messages = await Promise.all(
    conversation.messages.map(async (message) => ({
      ...message,
      attachments: await Promise.all(
        (message.attachments ?? []).map((attachment) =>
          uploadImportedAttachment(userId, attachment)
        )
      ),
    }))
  )

  return updateConversationSnapshot({
    ...conversation,
    attachments: messages.flatMap((message) => message.attachments ?? []),
    messages,
    projectId: conversation.projectId ?? DEFAULT_PROJECT_ID,
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('response' in auth) return auth.response

  const body = (await request.json().catch(() => null)) as
    | {
        conversations?: Conversation[]
        projects?: Project[]
        prompts?: PromptLibraryItem[]
        settings?: AppSettings | null
      }
    | null

  const projects = body?.projects ?? []
  const prompts = body?.prompts ?? []
  const conversations = body?.conversations ?? []

  await projectStore.list(auth.user.id)

  for (const project of projects) {
    await projectStore.create(auth.user.id, {
      id: project.id,
      name: project.name,
      description: project.description,
      color: project.color,
    })
  }

  for (const prompt of prompts) {
    await promptStore.create(auth.user.id, {
      id: prompt.id,
      title: prompt.title,
      content: prompt.content,
      mode: prompt.mode,
    })
  }

  if (body?.settings) {
    await settingsStore.save(auth.user.id, body.settings)
  }

  for (const conversation of conversations) {
    const uploadedConversation = await uploadConversationAttachments(
      auth.user.id,
      conversation
    )
    await conversationStore.save(auth.user.id, uploadedConversation)
  }

  const response = NextResponse.json({
    ok: true,
    imported: {
      projects: projects.length,
      prompts: prompts.length,
      conversations: conversations.length,
    },
  })

  if (auth.session.refreshed) {
    appendAuthCookies(response.headers, auth.session)
  }

  return response
}
