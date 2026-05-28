import 'server-only'

import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import {
  GitHubImportedItem,
  GitHubIntegrationAccount,
  ProjectHomeGitHubSummary,
} from '@/types'
import { getDatabaseClient } from '../client'
import {
  zenIntegrationAccounts,
  zenIntegrationItems,
  zenProjects,
} from '../schema'
import { compactObject, toIsoString, toNullableIsoString } from './helpers'
import { neonUsersRepository } from './users'

type AccountRow = typeof zenIntegrationAccounts.$inferSelect
type AccountInsert = typeof zenIntegrationAccounts.$inferInsert
type ItemRow = typeof zenIntegrationItems.$inferSelect
type ItemInsert = typeof zenIntegrationItems.$inferInsert

export interface UpsertGitHubAccountInput {
  externalAccountId: string
  externalAccountLogin?: string | null
  externalAccountName?: string | null
  installationId: string
  scopes: string[]
  syncState?: Record<string, unknown>
}

export interface UpsertGitHubItemInput {
  accountId: string
  externalId: string
  projectId: string
  fileId?: string | null
  title: string
  sourceUrl?: string | null
  repoFullName: string
  branch: string
  path: string
  sha?: string | null
  contentHash?: string | null
  byteSize?: number | null
  mimeType?: string | null
  status: 'available' | 'imported' | 'skipped' | 'failed'
  lastSeenAt?: Date | null
  lastImportedAt?: Date | null
  metadata?: Record<string, unknown>
}

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function rowToAccount(row: AccountRow): GitHubIntegrationAccount {
  return {
    id: row.id,
    provider: 'github',
    externalAccountId: row.externalAccountId,
    externalAccountLogin: row.externalAccountLogin,
    externalAccountName: row.externalAccountName,
    installationId: row.installationId,
    scopes: row.scopes,
    status: row.status as GitHubIntegrationAccount['status'],
    connectedAt: toIsoString(row.connectedAt),
    revokedAt: toNullableIsoString(row.revokedAt),
    syncState: jsonObject(row.syncState),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  }
}

function rowToItem(row: ItemRow): GitHubImportedItem {
  return {
    id: row.id,
    accountId: row.accountId,
    projectId: row.projectId,
    fileId: row.fileId,
    repoFullName: row.repoFullName,
    branch: row.branch,
    path: row.path,
    title: row.title,
    status: row.status as GitHubImportedItem['status'],
    contentHash: row.contentHash,
    byteSize: row.byteSize,
    mimeType: row.mimeType,
    lastImportedAt: toNullableIsoString(row.lastImportedAt),
    metadata: jsonObject(row.metadata),
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  }
}

class NeonIntegrationsRepository {
  async getGitHubAccount(userId: string): Promise<GitHubIntegrationAccount | null> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenIntegrationAccounts)
      .where(
        and(
          eq(zenIntegrationAccounts.userId, userId),
          eq(zenIntegrationAccounts.provider, 'github')
        )
      )
      .limit(1)

    return rows[0] ? rowToAccount(rows[0]) : null
  }

  async upsertGitHubAccount(
    userId: string,
    input: UpsertGitHubAccountInput
  ): Promise<GitHubIntegrationAccount> {
    await neonUsersRepository.ensureUserReference(userId)

    const existing = await this.getGitHubAccount(userId)
    const values: Partial<AccountInsert> = {
      userId,
      provider: 'github',
      externalAccountId: input.externalAccountId,
      externalAccountLogin: input.externalAccountLogin ?? null,
      externalAccountName: input.externalAccountName ?? null,
      installationId: input.installationId,
      scopes: input.scopes,
      status: 'connected',
      encryptedTokenPayload: null,
      syncState: {
        ...(existing?.syncState ?? {}),
        ...(input.syncState ?? {}),
        connectedAt: new Date().toISOString(),
      },
      connectedAt: new Date(),
      revokedAt: null,
      updatedAt: new Date(),
    }

    const db = getDatabaseClient()
    const rows = existing
      ? await db
          .update(zenIntegrationAccounts)
          .set(values)
          .where(
            and(
              eq(zenIntegrationAccounts.userId, userId),
              eq(zenIntegrationAccounts.id, existing.id)
            )
          )
          .returning()
      : await db
          .insert(zenIntegrationAccounts)
          .values(values as AccountInsert)
          .returning()

    return rowToAccount(rows[0])
  }

  async disconnectGitHub(userId: string): Promise<GitHubIntegrationAccount | null> {
    const rows = await getDatabaseClient()
      .update(zenIntegrationAccounts)
      .set({
        status: 'revoked',
        encryptedTokenPayload: null,
        revokedAt: new Date(),
        syncState: sql`coalesce(${zenIntegrationAccounts.syncState}, '{}'::jsonb) || jsonb_build_object('revokedAt', ${new Date().toISOString()})`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(zenIntegrationAccounts.userId, userId),
          eq(zenIntegrationAccounts.provider, 'github')
        )
      )
      .returning()

    return rows[0] ? rowToAccount(rows[0]) : null
  }

  async upsertGitHubItem(
    userId: string,
    input: UpsertGitHubItemInput
  ): Promise<GitHubImportedItem> {
    await neonUsersRepository.ensureUserReference(userId)

    const db = getDatabaseClient()
    const existingRows = await db
      .select()
      .from(zenIntegrationItems)
      .where(
        and(
          eq(zenIntegrationItems.userId, userId),
          eq(zenIntegrationItems.provider, 'github'),
          eq(zenIntegrationItems.externalId, input.externalId),
          eq(zenIntegrationItems.projectId, input.projectId)
        )
      )
      .limit(1)

    const values = compactObject<ItemInsert>({
      userId,
      accountId: input.accountId,
      provider: 'github',
      externalId: input.externalId,
      projectId: input.projectId,
      fileId: input.fileId ?? null,
      title: input.title,
      itemType: 'file',
      sourceUrl: input.sourceUrl ?? null,
      repoFullName: input.repoFullName,
      branch: input.branch,
      path: input.path,
      sha: input.sha ?? null,
      contentHash: input.contentHash ?? null,
      byteSize: input.byteSize ?? null,
      mimeType: input.mimeType ?? null,
      status: input.status,
      lastSeenAt: input.lastSeenAt ?? new Date(),
      lastImportedAt: input.lastImportedAt ?? null,
      metadata: input.metadata ?? {},
      updatedAt: new Date(),
    }) as ItemInsert

    const rows = existingRows[0]
      ? await db
          .update(zenIntegrationItems)
          .set(values)
          .where(
            and(
              eq(zenIntegrationItems.userId, userId),
              eq(zenIntegrationItems.id, existingRows[0].id)
            )
          )
          .returning()
      : await db.insert(zenIntegrationItems).values(values).returning()

    return rowToItem(rows[0])
  }

  async listGitHubItemsForProject(
    userId: string,
    projectId: string
  ): Promise<GitHubImportedItem[]> {
    const rows = await getDatabaseClient()
      .select()
      .from(zenIntegrationItems)
      .where(
        and(
          eq(zenIntegrationItems.userId, userId),
          eq(zenIntegrationItems.provider, 'github'),
          eq(zenIntegrationItems.projectId, projectId)
        )
      )
      .orderBy(desc(zenIntegrationItems.updatedAt))

    return rows.map(rowToItem)
  }

  async listGitHubItemsByIds(
    userId: string,
    ids: string[]
  ): Promise<GitHubImportedItem[]> {
    if (ids.length === 0) return []

    const rows = await getDatabaseClient()
      .select()
      .from(zenIntegrationItems)
      .where(
        and(
          eq(zenIntegrationItems.userId, userId),
          eq(zenIntegrationItems.provider, 'github'),
          inArray(zenIntegrationItems.id, ids)
        )
      )
      .orderBy(desc(zenIntegrationItems.updatedAt))

    return rows.map(rowToItem)
  }

  async getProjectGitHubSummary(
    userId: string,
    projectId: string
  ): Promise<ProjectHomeGitHubSummary> {
    const [account, projectRows] = await Promise.all([
      this.getGitHubAccount(userId),
      getDatabaseClient()
        .select({ id: zenProjects.id })
        .from(zenProjects)
        .where(and(eq(zenProjects.userId, userId), eq(zenProjects.id, projectId)))
        .limit(1),
    ])

    if (!projectRows[0]) {
      return {
        connected: account?.status === 'connected',
        accountLogin: account?.externalAccountLogin ?? null,
        importedCount: 0,
        lastImportedAt: null,
        repositories: [],
      }
    }

    const rows = await getDatabaseClient()
      .select({
        fullName: zenIntegrationItems.repoFullName,
        branch: zenIntegrationItems.branch,
        importedCount: sql<number>`count(*)::int`,
        lastImportedAt: sql<Date | null>`max(${zenIntegrationItems.lastImportedAt})`,
      })
      .from(zenIntegrationItems)
      .where(
        and(
          eq(zenIntegrationItems.userId, userId),
          eq(zenIntegrationItems.provider, 'github'),
          eq(zenIntegrationItems.projectId, projectId),
          eq(zenIntegrationItems.status, 'imported')
        )
      )
      .groupBy(zenIntegrationItems.repoFullName, zenIntegrationItems.branch)
      .orderBy(sql`max(${zenIntegrationItems.lastImportedAt}) desc nulls last`)

    const repositories = rows
      .filter((row) => row.fullName)
      .map((row) => ({
        fullName: row.fullName ?? '',
        branch: row.branch,
        importedCount: Number(row.importedCount) || 0,
        lastImportedAt: toNullableIsoString(row.lastImportedAt),
      }))

    return {
      connected: account?.status === 'connected',
      accountLogin: account?.externalAccountLogin ?? null,
      importedCount: repositories.reduce(
        (total, item) => total + item.importedCount,
        0
      ),
      lastImportedAt:
        repositories
          .map((item) => item.lastImportedAt)
          .filter(Boolean)
          .sort()
          .at(-1) ?? null,
      repositories,
    }
  }
}

export const neonIntegrationsRepository = new NeonIntegrationsRepository()
