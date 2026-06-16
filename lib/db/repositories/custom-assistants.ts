import 'server-only'

import { and, desc, eq } from 'drizzle-orm'
import {
  CustomAssistant,
  CustomAssistantDefaults,
  CustomAssistantInput,
  CustomAssistantMetadata,
  ModelOverrideOption,
  TextAIMode,
} from '@/types'
import { normalizeCustomAssistantMetadata } from '@/lib/custom-assistants/validation'
import { getDatabaseClient } from '../client'
import { zenCustomAssistants } from '../schema'
import { compactObject, toIsoString, toJsonObject } from './helpers'
import { neonUsersRepository } from './users'

type CustomAssistantRow = typeof zenCustomAssistants.$inferSelect

export type CustomAssistantPatch = Partial<CustomAssistantInput>

const DEFAULT_CUSTOM_ASSISTANT_LIST_LIMIT = 100
const MAX_CUSTOM_ASSISTANT_LIST_LIMIT = 200

function normalizeLimit(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_CUSTOM_ASSISTANT_LIST_LIMIT
  }
  return Math.max(1, Math.min(MAX_CUSTOM_ASSISTANT_LIST_LIMIT, Math.floor(value)))
}

function rowToCustomAssistant(row: CustomAssistantRow): CustomAssistant {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description,
    iconEmoji: row.iconEmoji,
    color: row.color,
    baseMode: row.baseMode as TextAIMode,
    systemInstructions: row.systemInstructions,
    defaultModelOverride: row.defaultModelOverride as ModelOverrideOption,
    defaultSettings: toJsonObject<CustomAssistantDefaults>(
      row.defaultSettings,
      {}
    ),
    metadata: normalizeCustomAssistantMetadata(
      toJsonObject<CustomAssistantMetadata>(row.metadata, {})
    ),
    isEnabled: row.isEnabled,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  }
}

class NeonCustomAssistantsRepository {
  async list(
    userId: string,
    options: { limit?: number | null } = {}
  ): Promise<CustomAssistant[]> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenCustomAssistants)
      .where(eq(zenCustomAssistants.userId, userId))
      .orderBy(desc(zenCustomAssistants.updatedAt))
      .limit(normalizeLimit(options.limit))

    return rows.map(rowToCustomAssistant).sort((a, b) => {
      if (a.isEnabled !== b.isEnabled) return a.isEnabled ? -1 : 1
      if (Boolean(a.metadata.isPinned) !== Boolean(b.metadata.isPinned)) {
        return a.metadata.isPinned ? -1 : 1
      }

      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
  }

  async get(userId: string, id: string): Promise<CustomAssistant | null> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenCustomAssistants)
      .where(
        and(eq(zenCustomAssistants.userId, userId), eq(zenCustomAssistants.id, id))
      )
      .limit(1)

    return rows[0] ? rowToCustomAssistant(rows[0]) : null
  }

  async create(
    userId: string,
    input: CustomAssistantInput
  ): Promise<CustomAssistant> {
    await neonUsersRepository.ensureUserReference(userId)

    const rows = await getDatabaseClient()
      .insert(zenCustomAssistants)
      .values({
        userId,
        name: input.name,
        description: input.description ?? '',
        iconEmoji: input.iconEmoji ?? '✨',
        color: input.color ?? 'general',
        baseMode: input.baseMode ?? 'general',
        systemInstructions: input.systemInstructions,
        defaultModelOverride: input.defaultModelOverride ?? 'auto',
        defaultSettings: input.defaultSettings ?? {},
        metadata: normalizeCustomAssistantMetadata(input.metadata),
        isEnabled: input.isEnabled ?? true,
      })
      .returning()

    if (!rows[0]) {
      throw new Error('Unable to create custom assistant.')
    }

    return rowToCustomAssistant(rows[0])
  }

  async update(
    userId: string,
    id: string,
    patch: CustomAssistantPatch
  ): Promise<CustomAssistant | null> {
    const rows = await getDatabaseClient()
      .update(zenCustomAssistants)
      .set({
        ...compactObject({
          name: patch.name,
          description: patch.description,
          iconEmoji: patch.iconEmoji,
          color: patch.color,
          baseMode: patch.baseMode,
          systemInstructions: patch.systemInstructions,
          defaultModelOverride: patch.defaultModelOverride,
          defaultSettings: patch.defaultSettings,
          metadata: patch.metadata
            ? normalizeCustomAssistantMetadata(patch.metadata)
            : undefined,
          isEnabled: patch.isEnabled,
        }),
        updatedAt: new Date(),
      })
      .where(
        and(eq(zenCustomAssistants.userId, userId), eq(zenCustomAssistants.id, id))
      )
      .returning()

    return rows[0] ? rowToCustomAssistant(rows[0]) : null
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const rows = await getDatabaseClient()
      .delete(zenCustomAssistants)
      .where(
        and(eq(zenCustomAssistants.userId, userId), eq(zenCustomAssistants.id, id))
      )
      .returning({ id: zenCustomAssistants.id })

    return rows.length > 0
  }
}

export const neonCustomAssistantsRepository =
  new NeonCustomAssistantsRepository()
