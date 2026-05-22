import { PromptLibraryItem } from '@/types'
import { createId, nowIso } from '@/lib/utils/chat'
import { neonQuery } from './neon'

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

class NeonPromptStore implements PromptStore {
  async list(userId: string): Promise<PromptLibraryItem[]> {
    const rows = await neonQuery<PromptRow>(
      `
        select *
        from public.zen_prompt_library
        where user_id = $1
        order by updated_at desc
      `,
      [userId]
    )

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

    const row = promptToRow(userId, prompt)
    const rows = await neonQuery<PromptRow>(
      `
        insert into public.zen_prompt_library (
          id,
          user_id,
          title,
          content,
          mode,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7)
        on conflict (user_id, id) do update
        set title = excluded.title,
            content = excluded.content,
            mode = excluded.mode,
            updated_at = excluded.updated_at
        returning *
      `,
      [
        row.id,
        row.user_id,
        row.title,
        row.content,
        row.mode,
        row.created_at,
        row.updated_at,
      ]
    )

    return rowToPrompt(rows[0] ?? promptToRow(userId, prompt))
  }

  async update(
    userId: string,
    promptId: string,
    input: Partial<Pick<PromptLibraryItem, 'title' | 'content' | 'mode'>>
  ): Promise<PromptLibraryItem | null> {
    const rows = await neonQuery<PromptRow>(
      `
        update public.zen_prompt_library
        set title = coalesce($3, title),
            content = coalesce($4, content),
            mode = coalesce($5, mode),
            updated_at = $6
        where user_id = $1 and id = $2
        returning *
      `,
      [
        userId,
        promptId,
        typeof input.title === 'string' ? input.title : null,
        typeof input.content === 'string' ? input.content : null,
        typeof input.mode !== 'undefined' ? input.mode : null,
        nowIso(),
      ]
    )

    return rows[0] ? rowToPrompt(rows[0]) : null
  }

  async delete(userId: string, promptId: string): Promise<void> {
    await neonQuery(
      'delete from public.zen_prompt_library where user_id = $1 and id = $2',
      [userId, promptId]
    )
  }
}

export const promptStore: PromptStore = new NeonPromptStore()
