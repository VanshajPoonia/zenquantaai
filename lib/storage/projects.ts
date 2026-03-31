import {
  DEFAULT_PROJECT_ID,
  DEFAULT_PROJECT_NAME,
  PROJECT_COLOR_OPTIONS,
} from '@/lib/config'
import { Project } from '@/types'
import { createId, nowIso } from '@/lib/utils/chat'
import { supabaseRequest } from './supabase'

const PROJECTS_TABLE = 'zen_projects'

type ProjectRow = {
  id: string
  user_id: string
  name: string
  description: string | null
  color: string
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface ProjectStore {
  list(userId: string): Promise<Project[]>
  create(
    userId: string,
    input: Pick<Project, 'name' | 'description' | 'color'> & { id?: string }
  ): Promise<Project>
  update(
    userId: string,
    projectId: string,
    input: Partial<Pick<Project, 'name' | 'description' | 'color'>>
  ): Promise<Project | null>
  delete(userId: string, projectId: string): Promise<void>
}

function createDefaultProject(): Project {
  const now = nowIso()

  return {
    id: DEFAULT_PROJECT_ID,
    name: DEFAULT_PROJECT_NAME,
    description: 'Default home for new chats',
    color: 'general',
    createdAt: now,
    updatedAt: now,
    isDefault: true,
  }
}

function normalizeProject(input: Project): Project {
  return {
    ...input,
    color: input.color || PROJECT_COLOR_OPTIONS[0],
    createdAt: input.createdAt || nowIso(),
    updatedAt: input.updatedAt || input.createdAt || nowIso(),
    isDefault: input.id === DEFAULT_PROJECT_ID || Boolean(input.isDefault),
  }
}

function rowToProject(row: ProjectRow): Project {
  return normalizeProject({
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isDefault: row.is_default,
  })
}

function projectToRow(userId: string, project: Project): ProjectRow {
  return {
    id: project.id,
    user_id: userId,
    name: project.name,
    description: project.description ?? null,
    color: project.color,
    is_default: Boolean(project.isDefault),
    created_at: project.createdAt,
    updated_at: project.updatedAt,
  }
}

class SupabaseProjectStore implements ProjectStore {
  async list(userId: string): Promise<Project[]> {
    const rows = await supabaseRequest<ProjectRow[]>(PROJECTS_TABLE, {
      query: {
        user_id: `eq.${userId}`,
        order: 'is_default.desc,updated_at.desc',
      },
    })

    const projects = rows.map(rowToProject)

    if (projects.some((project) => project.id === DEFAULT_PROJECT_ID)) {
      return projects
    }

    const defaultProject = await this.create(userId, {
      id: DEFAULT_PROJECT_ID,
      name: DEFAULT_PROJECT_NAME,
      description: 'Default home for new chats',
      color: 'general',
    })

    return [defaultProject, ...projects]
  }

  async create(
    userId: string,
    input: Pick<Project, 'name' | 'description' | 'color'> & { id?: string }
  ): Promise<Project> {
    const now = nowIso()
    const project = normalizeProject({
      id: input.id ?? createId('proj'),
      name: input.name,
      description: input.description,
      color: input.color,
      createdAt: now,
      updatedAt: now,
      isDefault: input.id === DEFAULT_PROJECT_ID,
    })

    const rows = await supabaseRequest<ProjectRow[]>(PROJECTS_TABLE, {
      method: 'POST',
      body: projectToRow(userId, project),
      prefer: 'resolution=merge-duplicates,return=representation',
    })

    return rowToProject(rows[0] ?? projectToRow(userId, project))
  }

  async update(
    userId: string,
    projectId: string,
    input: Partial<Pick<Project, 'name' | 'description' | 'color'>>
  ): Promise<Project | null> {
    if (projectId === DEFAULT_PROJECT_ID && input.name === '') {
      return null
    }

    const rows = await supabaseRequest<ProjectRow[]>(PROJECTS_TABLE, {
      method: 'PATCH',
      query: {
        user_id: `eq.${userId}`,
        id: `eq.${projectId}`,
      },
      body: {
        ...(typeof input.name === 'string' ? { name: input.name } : {}),
        ...(typeof input.description !== 'undefined'
          ? { description: input.description }
          : {}),
        ...(typeof input.color === 'string' ? { color: input.color } : {}),
        updated_at: nowIso(),
      },
    })

    return rows[0] ? rowToProject(rows[0]) : null
  }

  async delete(userId: string, projectId: string): Promise<void> {
    if (projectId === DEFAULT_PROJECT_ID) return

    await supabaseRequest(PROJECTS_TABLE, {
      method: 'DELETE',
      query: {
        user_id: `eq.${userId}`,
        id: `eq.${projectId}`,
      },
      prefer: 'return=minimal',
    })
  }
}

export const projectStore: ProjectStore = new SupabaseProjectStore()
