import 'server-only'

import { and, desc, eq } from 'drizzle-orm'
import { createId, nowIso } from '@/lib/utils/chat'
import { PromptLibraryItem } from '@/types'
import { getDatabaseClient } from '../client'
import { zenPromptLibrary } from '../schema'
import { toDate, toIsoString } from './helpers'
import { neonUsersRepository } from './users'

type PromptRow = typeof zenPromptLibrary.$inferSelect

function rowToPrompt(row: PromptRow): PromptLibraryItem {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    mode: row.mode as PromptLibraryItem['mode'],
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  }
}

class NeonPromptsRepository {
  async list(userId: string): Promise<PromptLibraryItem[]> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenPromptLibrary)
      .where(eq(zenPromptLibrary.userId, userId))
      .orderBy(desc(zenPromptLibrary.updatedAt))

    return rows.map(rowToPrompt)
  }

  async create(
    userId: string,
    input: Pick<PromptLibraryItem, 'title' | 'content' | 'mode'> & { id?: string }
  ): Promise<PromptLibraryItem> {
    await neonUsersRepository.ensureUserReference(userId)

    const now = nowIso()
    const prompt: PromptLibraryItem = {
      id: input.id ?? createId('prompt'),
      title: input.title,
      content: input.content,
      mode: input.mode,
      createdAt: now,
      updatedAt: now,
    }

    const values = {
      id: prompt.id,
      userId,
      title: prompt.title,
      content: prompt.content,
      mode: prompt.mode,
      createdAt: toDate(prompt.createdAt),
      updatedAt: toDate(prompt.updatedAt),
    }

    const rows = await getDatabaseClient()
      .insert(zenPromptLibrary)
      .values(values)
      .onConflictDoUpdate({
        target: [zenPromptLibrary.userId, zenPromptLibrary.id],
        set: {
          title: values.title,
          content: values.content,
          mode: values.mode,
          updatedAt: values.updatedAt,
        },
      })
      .returning()

    return rowToPrompt(rows[0] ?? values)
  }

  async update(
    userId: string,
    promptId: string,
    input: Partial<Pick<PromptLibraryItem, 'title' | 'content' | 'mode'>>
  ): Promise<PromptLibraryItem | null> {
    const rows = await getDatabaseClient()
      .update(zenPromptLibrary)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(
        and(eq(zenPromptLibrary.userId, userId), eq(zenPromptLibrary.id, promptId))
      )
      .returning()

    return rows[0] ? rowToPrompt(rows[0]) : null
  }

  async delete(userId: string, promptId: string): Promise<void> {
    await getDatabaseClient()
      .delete(zenPromptLibrary)
      .where(
        and(eq(zenPromptLibrary.userId, userId), eq(zenPromptLibrary.id, promptId))
      )
  }
}

export const neonPromptsRepository = new NeonPromptsRepository()
