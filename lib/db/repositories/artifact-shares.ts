import 'server-only'

import { createHash, randomBytes } from 'crypto'
import { and, desc, eq, isNull } from 'drizzle-orm'
import {
  ArtifactShareCreated,
  ArtifactShareInfo,
  ArtifactShareInput,
  ArtifactShareVisibility,
  ArtifactType,
  PublicArtifactShare,
} from '@/types'
import { getDatabaseClient } from '../client'
import { zenArtifactShares, zenArtifacts } from '../schema'
import { toNullableIsoString, toIsoString } from './helpers'

type ShareRow = typeof zenArtifactShares.$inferSelect

function createShareToken(): string {
  return randomBytes(32).toString('base64url')
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function rowToShareInfo(row: ShareRow): ArtifactShareInfo {
  return {
    id: row.id,
    artifactId: row.artifactId,
    visibility: row.visibility as ArtifactShareVisibility,
    expiresAt: toNullableIsoString(row.expiresAt),
    revokedAt: toNullableIsoString(row.revokedAt),
    createdAt: toIsoString(row.createdAt),
  }
}

class NeonArtifactSharesRepository {
  async create(
    userId: string,
    artifactId: string,
    input: ArtifactShareInput
  ): Promise<ArtifactShareCreated> {
    const token = createShareToken()
    const tokenHash = hashToken(token)

    const visibility: ArtifactShareVisibility = input.visibility ?? 'public_link'
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null

    const rows = await getDatabaseClient()
      .insert(zenArtifactShares)
      .values({
        artifactId,
        userId,
        tokenHash,
        visibility,
        expiresAt,
      })
      .returning()

    const row = rows[0]
    if (!row) throw new Error('Unable to create artifact share.')

    return {
      ...rowToShareInfo(row),
      token,
    }
  }

  async list(userId: string, artifactId: string): Promise<ArtifactShareInfo[]> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenArtifactShares)
      .where(
        and(
          eq(zenArtifactShares.userId, userId),
          eq(zenArtifactShares.artifactId, artifactId),
          isNull(zenArtifactShares.revokedAt)
        )
      )
      .orderBy(desc(zenArtifactShares.createdAt))

    return rows.map(rowToShareInfo)
  }

  async revoke(
    userId: string,
    shareId: string
  ): Promise<boolean> {
    const rows = await getDatabaseClient()
      .update(zenArtifactShares)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(zenArtifactShares.userId, userId),
          eq(zenArtifactShares.id, shareId),
          isNull(zenArtifactShares.revokedAt)
        )
      )
      .returning({ id: zenArtifactShares.id })

    return rows.length > 0
  }

  async getPublicByToken(token: string): Promise<PublicArtifactShare | null> {
    const tokenHash = hashToken(token)

    const rows = await getDatabaseClient()
      .select({
        shareId: zenArtifactShares.id,
        shareVisibility: zenArtifactShares.visibility,
        shareExpiresAt: zenArtifactShares.expiresAt,
        shareRevokedAt: zenArtifactShares.revokedAt,
        shareCreatedAt: zenArtifactShares.createdAt,
        artifactTitle: zenArtifacts.title,
        artifactType: zenArtifacts.artifactType,
        artifactContent: zenArtifacts.content,
      })
      .from(zenArtifactShares)
      .innerJoin(zenArtifacts, eq(zenArtifactShares.artifactId, zenArtifacts.id))
      .where(eq(zenArtifactShares.tokenHash, tokenHash))
      .limit(1)

    const row = rows[0]
    if (!row) return null

    if (row.shareRevokedAt) return null

    if (row.shareExpiresAt && row.shareExpiresAt < new Date()) return null

    return {
      share: {
        id: row.shareId,
        visibility: row.shareVisibility as ArtifactShareVisibility,
        expiresAt: toNullableIsoString(row.shareExpiresAt),
        createdAt: toIsoString(row.shareCreatedAt),
      },
      artifact: {
        title: row.artifactTitle,
        artifactType: row.artifactType as ArtifactType,
        content: row.artifactContent,
      },
    }
  }
}

export const neonArtifactSharesRepository = new NeonArtifactSharesRepository()
