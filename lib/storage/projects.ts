import {
  DEFAULT_PROJECT_ID,
  DEFAULT_PROJECT_NAME,
  PROJECT_COLOR_OPTIONS,
} from '@/lib/config'
import { Project } from '@/types'
import { createId, nowIso } from '@/lib/utils/chat'
import { neonQuery } from './neon'

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

class NeonProjectStore implements ProjectStore {
  async list(userId: string): Promise<Project[]> {
    const rows = await neonQuery<ProjectRow>(
      `
        select *
        from public.zen_projects
        where user_id = $1
        order by is_default desc, updated_at desc
      `,
      [userId]
    )

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

    const row = projectToRow(userId, project)
    const rows = await neonQuery<ProjectRow>(
      `
        insert into public.zen_projects (
          id,
          user_id,
          name,
          description,
          color,
          is_default,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8)
        on conflict (user_id, id) do update
        set name = excluded.name,
            description = excluded.description,
            color = excluded.color,
            is_default = excluded.is_default,
            updated_at = excluded.updated_at
        returning *
      `,
      [
        row.id,
        row.user_id,
        row.name,
        row.description,
        row.color,
        row.is_default,
        row.created_at,
        row.updated_at,
      ]
    )

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

    const rows = await neonQuery<ProjectRow>(
      `
        update public.zen_projects
        set name = coalesce($3, name),
            description = case when $4 then $5 else description end,
            color = coalesce($6, color),
            updated_at = $7
        where user_id = $1 and id = $2
        returning *
      `,
      [
        userId,
        projectId,
        typeof input.name === 'string' ? input.name : null,
        typeof input.description !== 'undefined',
        input.description ?? null,
        typeof input.color === 'string' ? input.color : null,
        nowIso(),
      ]
    )

    return rows[0] ? rowToProject(rows[0]) : null
  }

  async delete(userId: string, projectId: string): Promise<void> {
    if (projectId === DEFAULT_PROJECT_ID) return

    await neonQuery(
      'delete from public.zen_projects where user_id = $1 and id = $2',
      [userId, projectId]
    )
  }
}

export const projectStore: ProjectStore = new NeonProjectStore()
