import 'server-only'

import { and, desc, eq, gte, ilike, lte, or } from 'drizzle-orm'
import { getDatabaseClient } from '../client'
import { zenGeneratedImages } from '../schema'
import { compactObject, toIsoString } from './helpers'
import { neonUsersRepository } from './users'

type GeneratedImageRow = typeof zenGeneratedImages.$inferSelect
type GeneratedImageInsert = typeof zenGeneratedImages.$inferInsert

export type NeonGeneratedImageProvider = 'openrouter' | 'external' | 'local'
export type NeonGeneratedImageStorageProvider = 'external' | 'local'
export type NeonGeneratedImageStatus = 'created' | 'stored' | 'failed' | 'deleted'

export interface NeonGeneratedImageMetadata {
  id: string
  userId: string
  projectId: string | null
  conversationId: string | null
  messageId: string | null
  imageGenerationEventId: string | null
  provider: NeonGeneratedImageProvider
  model: string
  prompt: string
  negativePrompt: string | null
  storageProvider: NeonGeneratedImageStorageProvider | null
  storageBucket: string | null
  storagePath: string | null
  sourceUrl: string | null
  width: number | null
  height: number | null
  status: NeonGeneratedImageStatus
  isFavorite: boolean
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

type CreateGeneratedImageInput = Omit<
  NeonGeneratedImageMetadata,
  'id' | 'createdAt' | 'updatedAt'
> & {
  id?: string
}

type PatchGeneratedImageInput = Partial<
  Omit<NeonGeneratedImageMetadata, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
>

export interface GeneratedImageListFilters {
  q?: string | null
  projectId?: string | null
  favorite?: boolean | null
  from?: Date | null
  to?: Date | null
}

function rowToGeneratedImage(row: GeneratedImageRow): NeonGeneratedImageMetadata {
  return {
    id: row.id,
    userId: row.userId,
    projectId: row.projectId,
    conversationId: row.conversationId,
    messageId: row.messageId,
    imageGenerationEventId: row.imageGenerationEventId,
    provider: row.provider as NeonGeneratedImageProvider,
    model: row.model,
    prompt: row.prompt,
    negativePrompt: row.negativePrompt,
    storageProvider: row.storageProvider as NeonGeneratedImageStorageProvider | null,
    storageBucket: row.storageBucket,
    storagePath: row.storagePath,
    sourceUrl: row.sourceUrl,
    width: row.width,
    height: row.height,
    status: row.status as NeonGeneratedImageStatus,
    isFavorite: row.isFavorite,
    metadata:
      row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  }
}

class NeonGeneratedImagesRepository {
  async listByUser(
    userId: string,
    filters: GeneratedImageListFilters = {}
  ): Promise<NeonGeneratedImageMetadata[]> {
    const conditions = [eq(zenGeneratedImages.userId, userId)]
    const query = filters.q?.trim()

    if (query) {
      const pattern = `%${query.replace(/[\\%_]/g, (match) => `\\${match}`)}%`
      const searchCondition = or(
        ilike(zenGeneratedImages.prompt, pattern),
        ilike(zenGeneratedImages.model, pattern),
        ilike(zenGeneratedImages.negativePrompt, pattern)
      )

      if (searchCondition) conditions.push(searchCondition)
    }

    if (filters.projectId) {
      conditions.push(eq(zenGeneratedImages.projectId, filters.projectId))
    }

    if (typeof filters.favorite === 'boolean') {
      conditions.push(eq(zenGeneratedImages.isFavorite, filters.favorite))
    }

    if (filters.from) {
      conditions.push(gte(zenGeneratedImages.createdAt, filters.from))
    }

    if (filters.to) {
      conditions.push(lte(zenGeneratedImages.createdAt, filters.to))
    }

    const rows = await getDatabaseClient()
      .select()
      .from(zenGeneratedImages)
      .where(and(...conditions))
      .orderBy(desc(zenGeneratedImages.createdAt))

    return rows.map(rowToGeneratedImage)
  }

  async listByConversation(
    userId: string,
    conversationId: string
  ): Promise<NeonGeneratedImageMetadata[]> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenGeneratedImages)
      .where(
        and(
          eq(zenGeneratedImages.userId, userId),
          eq(zenGeneratedImages.conversationId, conversationId)
        )
      )
      .orderBy(desc(zenGeneratedImages.createdAt))

    return rows.map(rowToGeneratedImage)
  }

  async get(
    userId: string,
    id: string
  ): Promise<NeonGeneratedImageMetadata | null> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenGeneratedImages)
      .where(and(eq(zenGeneratedImages.userId, userId), eq(zenGeneratedImages.id, id)))
      .limit(1)

    return rows[0] ? rowToGeneratedImage(rows[0]) : null
  }

  async create(
    input: CreateGeneratedImageInput
  ): Promise<NeonGeneratedImageMetadata> {
    await neonUsersRepository.ensureUserReference(input.userId)

    const values = compactObject<GeneratedImageInsert>({
      id: input.id,
      userId: input.userId,
      projectId: input.projectId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      imageGenerationEventId: input.imageGenerationEventId,
      provider: input.provider,
      model: input.model,
      prompt: input.prompt,
      negativePrompt: input.negativePrompt,
      storageProvider: input.storageProvider,
      storageBucket: input.storageBucket,
      storagePath: input.storagePath,
      sourceUrl: input.sourceUrl,
      width: input.width,
      height: input.height,
      status: input.status,
      isFavorite: input.isFavorite,
      metadata: input.metadata,
    }) as GeneratedImageInsert

    const rows = await getDatabaseClient()
      .insert(zenGeneratedImages)
      .values(values)
      .returning()

    return rowToGeneratedImage(rows[0])
  }

  async patch(
    userId: string,
    id: string,
    patch: PatchGeneratedImageInput
  ): Promise<NeonGeneratedImageMetadata | null> {
    const values = compactObject<Partial<GeneratedImageInsert>>({
      projectId: patch.projectId,
      conversationId: patch.conversationId,
      messageId: patch.messageId,
      imageGenerationEventId: patch.imageGenerationEventId,
      provider: patch.provider,
      model: patch.model,
      prompt: patch.prompt,
      negativePrompt: patch.negativePrompt,
      storageProvider: patch.storageProvider,
      storageBucket: patch.storageBucket,
      storagePath: patch.storagePath,
      sourceUrl: patch.sourceUrl,
      width: patch.width,
      height: patch.height,
      status: patch.status,
      isFavorite: patch.isFavorite,
      metadata: patch.metadata,
      updatedAt: new Date(),
    })

    const rows = await getDatabaseClient()
      .update(zenGeneratedImages)
      .set(values)
      .where(and(eq(zenGeneratedImages.userId, userId), eq(zenGeneratedImages.id, id)))
      .returning()

    return rows[0] ? rowToGeneratedImage(rows[0]) : null
  }

  async updateStatus(
    userId: string,
    id: string,
    status: NeonGeneratedImageStatus,
    patch: Omit<PatchGeneratedImageInput, 'status'> = {}
  ): Promise<NeonGeneratedImageMetadata | null> {
    return await this.patch(userId, id, {
      ...patch,
      status,
    })
  }

  async delete(userId: string, id: string): Promise<void> {
    await getDatabaseClient()
      .delete(zenGeneratedImages)
      .where(and(eq(zenGeneratedImages.userId, userId), eq(zenGeneratedImages.id, id)))
  }
}

export const neonGeneratedImagesRepository = new NeonGeneratedImagesRepository()
