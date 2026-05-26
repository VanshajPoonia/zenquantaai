import 'server-only'

import { and, desc, eq } from 'drizzle-orm'
import {
  DEFAULT_PROJECT_ID,
  DEFAULT_PROJECT_NAME,
  PROJECT_COLOR_OPTIONS,
} from '@/lib/config'
import { createId, nowIso } from '@/lib/utils/chat'
import { Project } from '@/types'
import { getDatabaseClient } from '../client'
import { zenProjects } from '../schema'
import { toDate, toIsoString } from './helpers'
import { neonUsersRepository } from './users'

function normalizeProject(input: Project): Project {
  return {
    ...input,
    color: input.color || PROJECT_COLOR_OPTIONS[0],
    createdAt: input.createdAt || nowIso(),
    updatedAt: input.updatedAt || input.createdAt || nowIso(),
    isDefault: input.id === DEFAULT_PROJECT_ID || Boolean(input.isDefault),
  }
}

type ProjectRow = typeof zenProjects.$inferSelect

function rowToProject(row: ProjectRow): Project {
  return normalizeProject({
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    color: row.color,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
    isDefault: row.isDefault,
  })
}

function projectToInsert(userId: string, project: Project) {
  return {
    id: project.id,
    userId,
    name: project.name,
    description: project.description ?? null,
    color: project.color,
    isDefault: Boolean(project.isDefault),
    createdAt: toDate(project.createdAt),
    updatedAt: toDate(project.updatedAt),
  }
}

class NeonProjectsRepository {
  async get(userId: string, projectId: string): Promise<Project | null> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenProjects)
      .where(and(eq(zenProjects.userId, userId), eq(zenProjects.id, projectId)))
      .limit(1)

    return rows[0] ? rowToProject(rows[0]) : null
  }

  async list(userId: string): Promise<Project[]> {
    const db = getDatabaseClient()
    const rows = await db
      .select()
      .from(zenProjects)
      .where(eq(zenProjects.userId, userId))
      .orderBy(desc(zenProjects.isDefault), desc(zenProjects.updatedAt))

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
    await neonUsersRepository.ensureUserReference(userId)

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

    const values = projectToInsert(userId, project)
    const rows = await getDatabaseClient()
      .insert(zenProjects)
      .values(values)
      .onConflictDoUpdate({
        target: [zenProjects.userId, zenProjects.id],
        set: {
          name: values.name,
          description: values.description,
          color: values.color,
          isDefault: values.isDefault,
          updatedAt: values.updatedAt,
        },
      })
      .returning()

    return rowToProject(rows[0] ?? values)
  }

  async update(
    userId: string,
    projectId: string,
    input: Partial<Pick<Project, 'name' | 'description' | 'color'>>
  ): Promise<Project | null> {
    if (projectId === DEFAULT_PROJECT_ID && input.name === '') {
      return null
    }

    const rows = await getDatabaseClient()
      .update(zenProjects)
      .set({
        ...(typeof input.name === 'string' ? { name: input.name } : {}),
        ...(typeof input.description !== 'undefined'
          ? { description: input.description }
          : {}),
        ...(typeof input.color === 'string' ? { color: input.color } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(zenProjects.userId, userId), eq(zenProjects.id, projectId)))
      .returning()

    return rows[0] ? rowToProject(rows[0]) : null
  }

  async delete(userId: string, projectId: string): Promise<void> {
    if (projectId === DEFAULT_PROJECT_ID) return

    await getDatabaseClient()
      .delete(zenProjects)
      .where(and(eq(zenProjects.userId, userId), eq(zenProjects.id, projectId)))
  }
}

export const neonProjectsRepository = new NeonProjectsRepository()
