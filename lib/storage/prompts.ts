import { PromptLibraryItem } from '@/types'
import { createId, nowIso } from '@/lib/utils/chat'
import { fileExists, readJsonFile, resolveRuntimePath, writeJsonFile } from './files'
import { hasSupabaseConfig, supabaseRequest } from './supabase'

const PROMPTS_FILE = resolveRuntimePath('prompts.json')
const PROMPTS_TABLE = 'zen_prompt_library'

export interface PromptStore {
  list(workspaceId: string): Promise<PromptLibraryItem[]>
  create(
    workspaceId: string,
    input: Pick<PromptLibraryItem, 'title' | 'content' | 'mode'> & { id?: string }
  ): Promise<PromptLibraryItem>
  update(
    workspaceId: string,
    promptId: string,
    input: Partial<Pick<PromptLibraryItem, 'title' | 'content' | 'mode'>>
  ): Promise<PromptLibraryItem | null>
  delete(workspaceId: string, promptId: string): Promise<void>
}

type PromptRow = {
  id: string
  workspace_id: string
  title: string
  content: string
  mode: PromptLibraryItem['mode']
  created_at: string
  updated_at: string
}

function rowToPrompt(row: PromptRow): PromptLibraryItem {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    content: row.content,
    mode: row.mode,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function promptToRow(prompt: PromptLibraryItem): PromptRow {
  return {
    id: prompt.id,
    workspace_id: prompt.workspaceId,
    title: prompt.title,
    content: prompt.content,
    mode: prompt.mode,
    created_at: prompt.createdAt,
    updated_at: prompt.updatedAt,
  }
}

async function readJsonPrompts(): Promise<PromptLibraryItem[]> {
  const exists = await fileExists(PROMPTS_FILE)
  if (!exists) return []

  return (await readJsonFile<PromptLibraryItem[]>(PROMPTS_FILE)) ?? []
}

async function writeJsonPrompts(prompts: PromptLibraryItem[]): Promise<void> {
  await writeJsonFile(PROMPTS_FILE, prompts)
}

class HybridPromptStore implements PromptStore {
  async list(workspaceId: string): Promise<PromptLibraryItem[]> {
    if (hasSupabaseConfig()) {
      const rows = await supabaseRequest<PromptRow[]>(PROMPTS_TABLE, {
        query: {
          workspace_id: `eq.${workspaceId}`,
          order: 'updated_at.desc',
        },
      }).catch(() => [])

      return rows.map(rowToPrompt)
    }

    return (await readJsonPrompts()).filter(
      (prompt) => prompt.workspaceId === workspaceId
    )
  }

  async create(
    workspaceId: string,
    input: Pick<PromptLibraryItem, 'title' | 'content' | 'mode'> & { id?: string }
  ): Promise<PromptLibraryItem> {
    const now = nowIso()
    const prompt: PromptLibraryItem = {
      id: input.id ?? createId('prompt'),
      workspaceId,
      title: input.title,
      content: input.content,
      mode: input.mode,
      createdAt: now,
      updatedAt: now,
    }

    if (hasSupabaseConfig()) {
      const rows = await supabaseRequest<PromptRow[]>(PROMPTS_TABLE, {
        method: 'POST',
        body: promptToRow(prompt),
        prefer: 'resolution=merge-duplicates,return=representation',
      })

      return rowToPrompt(rows[0] ?? promptToRow(prompt))
    }

    const prompts = await readJsonPrompts()
    await writeJsonPrompts([prompt, ...prompts.filter((item) => item.id !== prompt.id)])
    return prompt
  }

  async update(
    workspaceId: string,
    promptId: string,
    input: Partial<Pick<PromptLibraryItem, 'title' | 'content' | 'mode'>>
  ): Promise<PromptLibraryItem | null> {
    if (hasSupabaseConfig()) {
      const rows = await supabaseRequest<PromptRow[]>(PROMPTS_TABLE, {
        method: 'PATCH',
        query: {
          workspace_id: `eq.${workspaceId}`,
          id: `eq.${promptId}`,
        },
        body: {
          ...input,
          updated_at: nowIso(),
        },
      })

      return rows[0] ? rowToPrompt(rows[0]) : null
    }

    const prompts = await readJsonPrompts()
    let updated: PromptLibraryItem | null = null

    const nextPrompts = prompts.map((prompt) => {
      if (prompt.workspaceId !== workspaceId || prompt.id !== promptId) {
        return prompt
      }

      updated = {
        ...prompt,
        ...input,
        updatedAt: nowIso(),
      }

      return updated
    })

    await writeJsonPrompts(nextPrompts)
    return updated
  }

  async delete(workspaceId: string, promptId: string): Promise<void> {
    if (hasSupabaseConfig()) {
      await supabaseRequest(PROMPTS_TABLE, {
        method: 'DELETE',
        query: {
          workspace_id: `eq.${workspaceId}`,
          id: `eq.${promptId}`,
        },
        prefer: 'return=minimal',
      })
      return
    }

    const prompts = await readJsonPrompts()
    await writeJsonPrompts(
      prompts.filter(
        (prompt) => !(prompt.workspaceId === workspaceId && prompt.id === promptId)
      )
    )
  }
}

export const promptStore: PromptStore = new HybridPromptStore()
