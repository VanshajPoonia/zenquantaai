import { PromptLibraryItem } from '@/types'
import { createId, nowIso } from '@/lib/utils/chat'
import { supabaseRequest } from './supabase'

const PROMPTS_TABLE = 'zen_prompt_library'

type PromptRow = {
  id: string
  user_id: string
  title: string
  content: string
  mode: PromptLibraryItem['mode']
  created_at: string
  updated_at: string
}

export interface PromptStore {
  list(userId: string): Promise<PromptLibraryItem[]>
  create(
    userId: string,
    input: Pick<PromptLibraryItem, 'title' | 'content' | 'mode'> & { id?: string }
  ): Promise<PromptLibraryItem>
  update(
    userId: string,
    promptId: string,
    input: Partial<Pick<PromptLibraryItem, 'title' | 'content' | 'mode'>>
  ): Promise<PromptLibraryItem | null>
  delete(userId: string, promptId: string): Promise<void>
}

function rowToPrompt(row: PromptRow): PromptLibraryItem {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    mode: row.mode,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function promptToRow(userId: string, prompt: PromptLibraryItem): PromptRow {
  return {
    id: prompt.id,
    user_id: userId,
    title: prompt.title,
    content: prompt.content,
    mode: prompt.mode,
    created_at: prompt.createdAt,
    updated_at: prompt.updatedAt,
  }
}

class SupabasePromptStore implements PromptStore {
  async list(userId: string): Promise<PromptLibraryItem[]> {
    const rows = await supabaseRequest<PromptRow[]>(PROMPTS_TABLE, {
      query: {
        user_id: `eq.${userId}`,
        order: 'updated_at.desc',
      },
    })

    return rows.map(rowToPrompt)
  }

  async create(
    userId: string,
    input: Pick<PromptLibraryItem, 'title' | 'content' | 'mode'> & { id?: string }
  ): Promise<PromptLibraryItem> {
    const now = nowIso()
    const prompt: PromptLibraryItem = {
      id: input.id ?? createId('prompt'),
      title: input.title,
      content: input.content,
      mode: input.mode,
      createdAt: now,
      updatedAt: now,
    }

    const rows = await supabaseRequest<PromptRow[]>(PROMPTS_TABLE, {
      method: 'POST',
      body: promptToRow(userId, prompt),
      prefer: 'resolution=merge-duplicates,return=representation',
    })

    return rowToPrompt(rows[0] ?? promptToRow(userId, prompt))
  }

  async update(
    userId: string,
    promptId: string,
    input: Partial<Pick<PromptLibraryItem, 'title' | 'content' | 'mode'>>
  ): Promise<PromptLibraryItem | null> {
    const rows = await supabaseRequest<PromptRow[]>(PROMPTS_TABLE, {
      method: 'PATCH',
      query: {
        user_id: `eq.${userId}`,
        id: `eq.${promptId}`,
      },
      body: {
        ...input,
        updated_at: nowIso(),
      },
    })

    return rows[0] ? rowToPrompt(rows[0]) : null
  }

  async delete(userId: string, promptId: string): Promise<void> {
    await supabaseRequest(PROMPTS_TABLE, {
      method: 'DELETE',
      query: {
        user_id: `eq.${userId}`,
        id: `eq.${promptId}`,
      },
      prefer: 'return=minimal',
    })
  }
}

export const promptStore: PromptStore = new SupabasePromptStore()
