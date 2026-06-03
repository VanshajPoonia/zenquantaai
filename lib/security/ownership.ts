import 'server-only'

import { neonProjectsRepository } from '@/lib/db/repositories'
import { normalizeOptionalProjectId } from '@/lib/security/user-scope'

export type OwnedProjectScope =
  | { ok: true; projectId: string | null }
  | { ok: false }

export async function resolveOwnedProjectScope(
  userId: string,
  projectId: string | null | undefined
): Promise<OwnedProjectScope> {
  const normalizedProjectId = normalizeOptionalProjectId(projectId)
  if (!normalizedProjectId) return { ok: true, projectId: null }

  const projects = await neonProjectsRepository.list(userId)
  const owned = projects.some((project) => project.id === normalizedProjectId)

  return owned ? { ok: true, projectId: normalizedProjectId } : { ok: false }
}
