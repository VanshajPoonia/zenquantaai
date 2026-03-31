import {
  DEFAULT_PROJECT_ID,
  DEFAULT_PROJECT_NAME,
  PROJECT_COLOR_OPTIONS,
} from '@/lib/config'
import { Project } from '@/types'
import { createId, nowIso } from '@/lib/utils/chat'
import { fileExists, readJsonFile, resolveRuntimePath, writeJsonFile } from './files'
import { hasSupabaseConfig, supabaseRequest } from './supabase'

const PROJECTS_FILE = resolveRuntimePath('projects.json')
const PROJECTS_TABLE = 'zen_projects'

export interface ProjectStore {
  list(workspaceId: string): Promise<Project[]>
  create(
    workspaceId: string,
    input: Pick<Project, 'name' | 'description' | 'color'> & { id?: string }
  ): Promise<Project>
  update(
    workspaceId: string,
    projectId: string,
    input: Partial<Pick<Project, 'name' | 'description' | 'color'>>
  ): Promise<Project | null>
  delete(workspaceId: string, projectId: string): Promise<void>
}

function createDefaultProject(workspaceId: string): Project {
  const now = nowIso()

  return {
    id: DEFAULT_PROJECT_ID,
    workspaceId,
    name: DEFAULT_PROJECT_NAME,
    description: 'Default home for new chats',
    color: 'general',
    createdAt: now,
    updatedAt: now,
    isDefault: true,
  }
}

function normalizeProject(workspaceId: string, input: Project): Project {
  return {
    ...input,
    workspaceId,
    color: input.color || PROJECT_COLOR_OPTIONS[0],
    createdAt: input.createdAt || nowIso(),
    updatedAt: input.updatedAt || input.createdAt || nowIso(),
    isDefault: input.id === DEFAULT_PROJECT_ID,
  }
}

async function readJsonProjects(): Promise<Project[]> {
  const exists = await fileExists(PROJECTS_FILE)
  if (!exists) return []

  return (await readJsonFile<Project[]>(PROJECTS_FILE)) ?? []
}

async function writeJsonProjects(projects: Project[]): Promise<void> {
  await writeJsonFile(PROJECTS_FILE, projects)
}

type ProjectRow = {
  id: string
  workspace_id: string
  name: string
  description: string | null
  color: string
  created_at: string
  updated_at: string
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    description: row.description ?? undefined,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isDefault: row.id === DEFAULT_PROJECT_ID,
  }
}

function projectToRow(project: Project): ProjectRow {
  return {
    id: project.id,
    workspace_id: project.workspaceId,
    name: project.name,
    description: project.description ?? null,
    color: project.color,
    created_at: project.createdAt,
    updated_at: project.updatedAt,
  }
}

class HybridProjectStore implements ProjectStore {
  async list(workspaceId: string): Promise<Project[]> {
    if (hasSupabaseConfig()) {
      const rows = await supabaseRequest<ProjectRow[]>(PROJECTS_TABLE, {
        query: {
          workspace_id: `eq.${workspaceId}`,
          order: 'updated_at.desc',
        },
      }).catch(() => [])

      const projects = rows.map(rowToProject)

      if (!projects.some((project) => project.id === DEFAULT_PROJECT_ID)) {
        const defaultProject = await this.create(workspaceId, {
          id: DEFAULT_PROJECT_ID,
          name: DEFAULT_PROJECT_NAME,
          description: 'Default home for new chats',
          color: 'general',
        })
        return [defaultProject, ...projects]
      }

      return projects
    }

    const projects = (await readJsonProjects())
      .filter((project) => project.workspaceId === workspaceId)
      .map((project) => normalizeProject(workspaceId, project))

    if (projects.some((project) => project.id === DEFAULT_PROJECT_ID)) {
      return projects
    }

    const defaultProject = createDefaultProject(workspaceId)
    await writeJsonProjects([defaultProject, ...(await readJsonProjects())])
    return [defaultProject, ...projects]
  }

  async create(
    workspaceId: string,
    input: Pick<Project, 'name' | 'description' | 'color'> & { id?: string }
  ): Promise<Project> {
    const now = nowIso()
    const project: Project = normalizeProject(workspaceId, {
      id: input.id ?? createId('proj'),
      workspaceId,
      name: input.name,
      description: input.description,
      color: input.color,
      createdAt: now,
      updatedAt: now,
      isDefault: input.id === DEFAULT_PROJECT_ID,
    })

    if (hasSupabaseConfig()) {
      const rows = await supabaseRequest<ProjectRow[]>(PROJECTS_TABLE, {
        method: 'POST',
        body: projectToRow(project),
        prefer: 'resolution=merge-duplicates,return=representation',
      })

      return rowToProject(rows[0] ?? projectToRow(project))
    }

    const projects = await readJsonProjects()
    const remaining = projects.filter(
      (item) => !(item.workspaceId === workspaceId && item.id === project.id)
    )
    await writeJsonProjects([project, ...remaining])

    return project
  }

  async update(
    workspaceId: string,
    projectId: string,
    input: Partial<Pick<Project, 'name' | 'description' | 'color'>>
  ): Promise<Project | null> {
    if (projectId === DEFAULT_PROJECT_ID && input.name === '') {
      return null
    }

    if (hasSupabaseConfig()) {
      const rows = await supabaseRequest<ProjectRow[]>(PROJECTS_TABLE, {
        method: 'PATCH',
        query: {
          workspace_id: `eq.${workspaceId}`,
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

    const projects = await readJsonProjects()
    let updated: Project | null = null

    const nextProjects = projects.map((project) => {
      if (project.workspaceId !== workspaceId || project.id !== projectId) {
        return project
      }

      updated = normalizeProject(workspaceId, {
        ...project,
        ...input,
        updatedAt: nowIso(),
      })

      return updated
    })

    await writeJsonProjects(nextProjects)
    return updated
  }

  async delete(workspaceId: string, projectId: string): Promise<void> {
    if (projectId === DEFAULT_PROJECT_ID) return

    if (hasSupabaseConfig()) {
      await supabaseRequest(PROJECTS_TABLE, {
        method: 'DELETE',
        query: {
          workspace_id: `eq.${workspaceId}`,
          id: `eq.${projectId}`,
        },
        prefer: 'return=minimal',
      })
      return
    }

    const projects = await readJsonProjects()
    await writeJsonProjects(
      projects.filter(
        (project) => !(project.workspaceId === workspaceId && project.id === projectId)
      )
    )
  }
}

export const projectStore: ProjectStore = new HybridProjectStore()
