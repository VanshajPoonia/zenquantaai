# Notion Read-Only Integration — Implementation Plan

**Status**: Planning only. No code changes in this document.  
**Date**: 2026-06-16  
**Scope**: v1 — user-triggered import of selected Notion pages and databases into Zenquanta projects and Ask Files. No background sync. No Notion writes.

---

## 1. Overview

Notion stores content as a tree of typed blocks accessed exclusively through its REST API. Unlike Google Drive (binary file downloads) or GitHub (raw file bytes), Notion content must be assembled server-side by recursively fetching block children and rendering them to text. This makes Notion integration structurally different from the two existing integrations, though the Neon storage layer, indexing pipeline, and route/repository patterns remain identical.

Key constraints:
- **Read-only**. Do not enable insert_content or update_content capabilities.
- **No background sync in v1**. All imports are user-triggered.
- **No Supabase, Stripe, or external vector DB**.
- **Tokens are permanent** (Notion access tokens do not expire). They must be encrypted at rest and never reach the browser.

---

## 2. OAuth Authorization Strategy

### How Notion authorization differs from Google/GitHub

Notion does not use OAuth scope strings in the authorization URL. Instead:

- **Capabilities** (what the integration can do) are configured once at the Notion developer portal when the integration is created.
- **Access** (which pages the integration can see) is selected by the user during the OAuth consent flow in Notion's own UI — the user explicitly picks which pages or databases to share.

This means **no folder-browsing UX is needed**. After OAuth, the integration can see exactly the pages the user shared, listed via `/v1/search`.

### Capabilities to enable (Notion developer portal)

| Capability | Enable? |
|---|---|
| Read content | **Yes** |
| Insert content | **No** |
| Update content | **No** |
| Read user information | **Yes** (to show connected account name/email) |
| Read comments | No (not needed in v1) |

### OAuth URL

```
https://api.notion.com/v1/oauth/authorize
  ?client_id=<CLIENT_ID>
  &response_type=code
  &owner=user
  &redirect_uri=<CALLBACK_URL>
  &state=<csrf-state>
```

`owner=user` is required — it scopes the integration to the user's personal pages, not a workspace.

### Access token behavior

Notion access tokens **do not expire**. There is no `refresh_token`, no `expiry_date`, and no token refresh logic required. The token remains valid until the user revokes the integration from their Notion settings.

This simplifies the token management layer versus Google Drive, but increases the risk profile: a leaked token is permanently valid until manually revoked.

### Token exchange

`POST https://api.notion.com/v1/oauth/token`

Uses HTTP Basic auth with `client_id:client_secret` base64-encoded in the `Authorization` header (not a bearer token). Body: `{ code, grant_type: 'authorization_code', redirect_uri }`.

Response includes:
```json
{
  "access_token": "secret_...",
  "token_type": "bearer",
  "bot_id": "...",
  "workspace_id": "...",
  "workspace_name": "...",
  "workspace_icon": "...",
  "owner": { "type": "user", "user": { "id": "...", "name": "...", "avatar_url": "..." } }
}
```

The `owner.user.id` maps to `externalAccountId`, `owner.user.name` to `externalAccountName`, and the workspace name can be stored in `syncState`.

---

## 3. Token Storage and Encryption

### Column already exists

`zen_integration_accounts.encrypted_token_payload` (jsonb) is present in the schema. GitHub leaves it null; Google Drive uses it for OAuth tokens. Notion must also populate it.

### Encryption: AES-256-GCM

Same approach as planned for Google Drive — Node.js built-in `crypto`, no new packages.

**Key**: `NOTION_TOKEN_ENCRYPTION_KEY` — 64-character hex string (32 bytes). Server-only, never committed.

**Envelope stored as jsonb**:

```json
{
  "version": 1,
  "iv": "<32-char hex>",
  "tag": "<32-char hex>",
  "ciphertext": "<hex>"
}
```

**Plaintext payload** (what gets encrypted):

```json
{
  "access_token": "secret_...",
  "token_type": "bearer",
  "bot_id": "...",
  "workspace_id": "...",
  "workspace_name": "..."
}
```

### No refresh logic needed

Because Notion tokens do not expire, the token helper only needs:
- `encryptTokenPayload(payload, key)`
- `decryptTokenPayload(envelope, key)`
- `getAccessToken(userId, account, db): Promise<string>` — decrypt and return, no refresh path

If a Notion API call returns a 401, treat it as revocation: set `status: 'error'`, clear `encryptedTokenPayload`, and surface a "Reconnect Notion" CTA.

### Token implementation file

`lib/integrations/notion-tokens.ts` (server-only):
- `encryptNotionToken(payload, key): EncryptedTokenEnvelope`
- `decryptNotionToken(envelope, key): NotionTokenPayload`
- `getNotionDecryptionKey(): Buffer`
- `getNotionAccessToken(userId, account, db): Promise<string>`

---

## 4. Connection / Revocation Flow

### 4a. Connect

1. `GET /api/integrations/notion/connect`
   - Requires authenticated user session.
   - Checks `NOTION_CLIENT_ID` is configured; 400 if not.
   - Generates CSRF `state` UUID.
   - Sets `zenquanta_notion_oauth_state` httpOnly cookie (10-minute TTL, `sameSite: 'lax'`, secure in prod).
   - Redirects to:
     ```
     https://api.notion.com/v1/oauth/authorize
       ?client_id=<CLIENT_ID>
       &response_type=code
       &owner=user
       &redirect_uri=<CALLBACK_URL>
       &state=<state>
     ```
   - User selects which Notion pages/databases to share in Notion's UI, then is redirected back.

2. `GET /api/integrations/notion/callback?code=...&state=...`
   - Validate `state` vs cookie value; clear the state cookie.
   - Exchange `code` for token: `POST https://api.notion.com/v1/oauth/token` with Basic auth.
   - Extract `owner.user.id`, `owner.user.name`, `workspace_name`, `workspace_id`.
   - Encrypt token payload.
   - Upsert `zen_integration_accounts`:
     ```
     provider: 'notion'
     externalAccountId: owner.user.id
     externalAccountLogin: null            // Notion has no "login" concept
     externalAccountName: owner.user.name  // Notion display name
     installationId: null
     scopes: ['read_content', 'read_user_info']
     status: 'connected'
     encryptedTokenPayload: <encrypted envelope>
     syncState: { workspaceId, workspaceName }
     ```
   - Redirect to `/?notion=connected`.

### 4b. Revocation / Disconnect

`DELETE /api/integrations/notion`:

1. Decrypt current token.
2. **No Notion revoke endpoint exists.** The user must revoke from their Notion account settings. Best-effort: log a note, proceed to DB cleanup.
3. Set `status: 'revoked'`, `encryptedTokenPayload: null`, `revokedAt: now()`.
4. Imported `zen_integration_items` and `zen_files` are **not deleted** — imported content remains as Zenquanta knowledge.

Surface in the disconnect dialog: _"Your imported Notion content stays in your projects. To fully revoke access, also remove Zenquanta from your Notion connected apps."_

### 4c. Error handling

On any Notion API 401 or 403: update `status: 'error'`, clear `encryptedTokenPayload`, surface "Reconnect your Notion workspace" in the panel.

---

## 5. Page / Database Selection UX

### No folder browser needed

Unlike Drive, Notion's access model means the user already picked which pages to share at OAuth time. The integration only sees those shared pages. Use the Notion search endpoint to list them.

### Route: `GET /api/integrations/notion/pages`

Query params:

| Param | Default | Description |
|---|---|---|
| `type` | `all` | Filter: `'page'`, `'database'`, or `'all'` |
| `q` | — | Title search string |
| `startCursor` | — | Pagination cursor from previous response |

Notion API call:

```
POST https://api.notion.com/v1/search
Content-Type: application/json
Notion-Version: 2022-06-28

{
  "query": "<q if provided>",
  "filter": { "value": "page" },   // or "database", omit for all
  "sort": { "direction": "descending", "timestamp": "last_edited_time" },
  "page_size": 50,
  "start_cursor": "<startCursor if provided>"
}
```

Response shape returned to client:

```ts
type NotionPageSummary = {
  id: string                       // Notion page/database UUID
  objectType: 'page' | 'database'
  title: string
  icon: string | null              // emoji or null
  lastEditedTime: string
  url: string                      // Notion.so URL for the page
  parentType: 'workspace' | 'page' | 'database'
  parentId: string | null          // parent page/database ID
  importable: boolean              // false if type is unsupported
  skipReason: string | null
}

type NotionPageListResponse = {
  pages: NotionPageSummary[]
  nextCursor: string | null
  hasMore: boolean
}
```

Database pages are shown with a table icon; regular pages with a document icon. Both are importable. The user selects one or more and clicks "Import."

---

## 6. Import Format: Block-to-Text Assembly

This is the primary implementation work that distinguishes Notion from other integrations. Notion pages cannot be "downloaded" — content must be assembled by recursively fetching blocks via the API.

### 6a. Block fetching

```
GET https://www.notion.so/v1/blocks/{block_id}/children?page_size=100
```

Returns up to 100 child blocks. If `has_more: true`, follow `next_cursor` until exhausted.

Apply a **depth limit of 6** (to handle nested toggles, column lists, etc.) and a **block count limit of 500** to prevent runaway API calls on very large pages. Pages exceeding 500 blocks are truncated with a note appended to the extracted text.

### 6b. Block-to-Markdown renderer

`renderBlocksToMarkdown(blocks, depth): string` in `lib/integrations/notion.ts`.

| Block type | Rendered as |
|---|---|
| `paragraph` | `<text>\n\n` |
| `heading_1` | `# <text>\n\n` |
| `heading_2` | `## <text>\n\n` |
| `heading_3` | `### <text>\n\n` |
| `bulleted_list_item` | `- <text>\n` (recurse children indented) |
| `numbered_list_item` | `1. <text>\n` (recurse children indented) |
| `to_do` | `- [x] <text>\n` or `- [ ] <text>\n` |
| `toggle` | `<text>\n` (recurse children) |
| `quote` | `> <text>\n\n` |
| `callout` | `> <icon> <text>\n\n` |
| `code` | ` ```<language>\n<text>\n``` \n\n` |
| `divider` | `---\n\n` |
| `table` | Markdown table: `\| col \| col \|\n\|---\|---\|\n\| val \| val \|` |
| `table_row` | Rendered as part of parent table |
| `column_list` | Render each column sequentially |
| `column` | Render children with a blank line between columns |
| `child_page` | `[Child Page: <title>]\n` (not recursed in v1) |
| `child_database` | `[Database: <title>]\n` (not recursed in v1) |
| `image` | `[Image: <caption or url>]\n` |
| `file` | `[File: <name>]\n` |
| `video` | `[Video: <url>]\n` |
| `embed` | `[Embed: <url>]\n` |
| `bookmark` | `[Link: <url>] <caption>\n` |
| `equation` | `<expression>\n` |
| Unsupported type | (skip silently) |

**Rich text extraction**: All block types expose a `rich_text` array. Use `rich_text[].plain_text` joined — no need to parse bold/italic markup for knowledge extraction.

### 6c. Page assembly

For a single Notion page:

```
# <Page Title>

<Markdown body assembled from blocks>
```

Store the result as UTF-8 bytes with `mimeType: 'text/markdown'`. Apply existing `MAX_EXTRACTED_CHARS` (160,000 chars) cap — truncate with appended note if exceeded.

### 6d. Database import

For a Notion database, generate a structured summary document:

```
# <Database Title>

## Properties
| Property | Type |
|---|---|
| Name | title |
| Status | select |
| ...

## Entries (first 50)

### <Row Title>
Status: Done
Assignee: Alice
Notes: Some text content...

---

### <Row Title 2>
...
```

Fetch database pages via `POST /v1/databases/{id}/query` with `page_size=50`. For each page, extract title and all text/select/date properties. **Do not recursively fetch block content for each database row in v1** — use property values only. This caps API calls at 1 query call + 1 database metadata call.

Database import is limited to **50 rows** in v1.

---

## 7. Import as Private Zenquanta File / Knowledge Record

Mirrors `lib/integrations/github-import.ts` exactly. No object storage is used.

### Steps per page/database

1. Assemble text via block renderer (or database query for databases).
2. Encode as UTF-8 `Buffer`.
3. Compute SHA-256 `contentHash` of the buffer.
4. Check for existing `zen_integration_items` by `externalId` and `projectId` — patch if found, create if not.
5. Write `zen_files` record:
   ```
   provider: 'external'
   bucket: null
   storagePath: null
   publicUrl: null
   fileName: <Notion page title>
   mimeType: 'text/markdown'
   byteSize: buffer.length
   checksum: contentHash
   visibility: 'private'
   metadata: {
     source: 'notion',
     sourceKind: 'notion_page' | 'notion_database',
     externalId: 'notion-page:{pageId}' | 'notion-db:{databaseId}',
     notionPageId: pageId | null,
     notionDatabaseId: databaseId | null,
     notionUrl: page.url,
     importedAt: ISO string,
     lastEditedTime: <Notion lastEditedTime>,
     blockCount: number | null,        // for pages
     rowCount: number | null,          // for databases
   }
   ```
6. Run `indexUploadedFileForKnowledge({ userId, file, fileName, mimeType, bytes, projectId })`.
7. Upsert `zen_integration_items`:
   ```
   provider: 'notion'
   externalId: 'notion-page:{pageId}' or 'notion-db:{databaseId}'
   projectId
   fileId: file.id
   title: Notion page title
   sourceUrl: page.url
   path: null       // no path concept for Notion
   sha: null
   contentHash
   byteSize: buffer.length
   mimeType: 'text/markdown'
   status: 'imported'
   lastImportedAt: now()
   metadata: { notionPageId, notionDatabaseId, lastEditedTime, blockCount, rowCount }
   ```

---

## 8. Project Assignment

Pass `projectId` as a required body field to the import route. Validate that the project belongs to the authenticated user before importing (same check as GitHub and Drive imports).

Post-import reassignment uses the existing `PATCH /api/files/[id]` endpoint.

---

## 9. Manual Re-import

`POST /api/integrations/notion/reimport`

Body: `{ projectId: string; itemIds?: string[] }`

- Load matching `zen_integration_items` for user and project (or specific IDs if provided).
- For each item, re-fetch current blocks/database rows from Notion using the stored `notionPageId` or `notionDatabaseId` from `metadata`.
- Compute new `contentHash`; if unchanged from stored `contentHash`, skip re-indexing (optimization — always re-index if simpler for v1).
- Update `zen_files`, re-index, update `zen_integration_items.lastImportedAt`.

**Staleness signal**: Store `lastEditedTime` from Notion in item metadata. On reimport, fetch current `lastEditedTime` from `GET /v1/pages/{id}` before re-downloading all blocks. If unchanged, skip download entirely.

---

## 10. No Background Sync in v1

All imports and re-imports are user-triggered. There are no:
- Cron jobs
- Notion webhooks (Notion does not offer a public push notification API as of 2025)
- Background queues
- Automatic staleness detection

**Justification**: Notion does not offer a webhook/push notification API for page changes in its public API. A polling-based approach would require frequent API calls across all users and projects, hitting Notion's rate limits (3 req/sec per integration). User-triggered reimport is the correct v1 scope. Document this limitation clearly in the UI.

---

## 11. Security Risks

### High priority

| Risk | Mitigation |
|---|---|
| **Permanent token theft** | `encryptedTokenPayload` uses AES-256-GCM. Key lives in env, not in Neon. Unlike OAuth tokens with expiry, Notion tokens are permanent — a DB breach combined with a key leak gives indefinite access. Mitigate by rotating `NOTION_TOKEN_ENCRYPTION_KEY` on suspicion of compromise. |
| **Callback CSRF** | `state` UUID per-request, stored in httpOnly cookie, verified in callback. Same pattern as GitHub and Drive. |
| **Server-side block fetch abuse** | The server fetches blocks using the user's own Notion access token, which is scoped to pages the user explicitly shared. It cannot access pages outside the user's grant. Validate that `pageId` and `databaseId` values are valid UUIDs before using them in API calls. |
| **Memory exhaustion on large pages** | Block count limit (500 blocks), `MAX_EXTRACTED_CHARS` cap, and UTF-8 byte check before writing to DB. Abort block fetch loop on excess. |
| **Token over-scope** | Capabilities (`read_content`, `read_user_info`) are set at the dev portal, not in the OAuth URL. Double-check the integration configuration does not have insert/update enabled. |

### Medium priority

| Risk | Mitigation |
|---|---|
| **Notion API rate limits** | Notion enforces 3 requests/second per integration. Import and block-fetch calls must be sequential, not parallel. Add `await delay(350)` between block pagination requests if needed for large pages. |
| **User revokes at Notion** | Any subsequent API call returns 401 — set `status: 'error'`, clear token, surface reconnect prompt. |
| **Import of sensitive Notion content** | Users choose what to import. Show a UI note: "Only import Notion pages you intend to use as project knowledge." |
| **Database with thousands of rows** | Cap at 50 rows in v1. Document the limit clearly: "Import up to 50 database entries." |
| **Nested child pages not followed** | A page that links to child pages will import only its own blocks. Child pages appear as `[Child Page: Title]` placeholders. Users must import child pages separately. Document this behavior. |

### Lower priority

| Risk | Mitigation |
|---|---|
| **Malformed block data from Notion API** | Wrap block renderer in try/catch per block; skip malformed blocks without aborting the whole page. |
| **Emoji/Unicode in page titles** | Use as-is for `fileName`; all existing Zenquanta file name handling is Unicode-safe. |
| **Very deeply nested blocks** | Depth limit of 6 prevents infinite recursion. |

---

## 12. Required Environment Variables

```bash
# Notion OAuth 2.0 integration credentials (register at notion.so/my-integrations)
NOTION_CLIENT_ID=
NOTION_CLIENT_SECRET=

# Must match the redirect URI registered in your Notion integration
NOTION_CALLBACK_URL=https://your-domain.com/api/integrations/notion/callback

# AES-256-GCM key for encrypting Notion access tokens at rest in Neon
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
NOTION_TOKEN_ENCRYPTION_KEY=
```

Add these names (without values) to any committed env documentation.

Do not add to `.env.example` unless the user explicitly requests a committed env template.

---

## 13. Database Tables Needed

**No new tables.** Existing tables cover all required data.

### Schema change required: provider check constraint

`lib/db/schema.ts` — update `integrationProviderCheck`:

```ts
// Before
const integrationProviderCheck = ['github'] as const

// After (also adding google-drive when that integration is implemented)
const integrationProviderCheck = ['github', 'google-drive', 'notion'] as const
```

### Neon migration SQL (new migration file in `neon/migrations/`)

```sql
-- Update provider check to include notion (and google-drive if not already added)
ALTER TABLE zen_integration_accounts
  DROP CONSTRAINT IF EXISTS zen_integration_accounts_provider_check;

ALTER TABLE zen_integration_accounts
  ADD CONSTRAINT zen_integration_accounts_provider_check
  CHECK (provider IN ('github', 'google-drive', 'notion'));
```

If Google Drive has already been implemented and its migration already ran, adjust accordingly — only add `'notion'` to the existing constraint.

### New repository methods needed

Add to `lib/db/repositories/integrations.ts` (extend `NeonIntegrationsRepository`):

```ts
getNotionAccount(userId: string): Promise<NotionIntegrationAccount | null>

upsertNotionAccount(userId: string, input: {
  externalAccountId: string       // Notion user.id (owner sub)
  externalAccountName: string | null
  scopes: string[]                // e.g. ['read_content', 'read_user_info']
  encryptedTokenPayload: Record<string, unknown>
  syncState: { workspaceId: string; workspaceName: string | null }
}): Promise<NotionIntegrationAccount>

updateNotionStatus(userId: string, accountId: string, status: 'revoked' | 'error'): Promise<void>

disconnectNotion(userId: string): Promise<NotionIntegrationAccount | null>

upsertNotionItem(userId: string, input: UpsertNotionItemInput): Promise<NotionImportedItem>

listNotionItemsForProject(userId: string, projectId: string): Promise<NotionImportedItem[]>

listNotionItemsByIds(userId: string, ids: string[]): Promise<NotionImportedItem[]>
```

---

## 14. API Routes Needed

All routes: `import 'server-only'`, `runtime = 'nodejs'`, `requireAuthenticatedUser`, `appendAuthCookies` on session refresh.

| Method | Path | Handler |
|---|---|---|
| `GET` | `/api/integrations/notion` | Returns `NotionIntegrationStatus` (configured, connected, account, workspace) |
| `DELETE` | `/api/integrations/notion` | Disconnect account record, clear encrypted token |
| `GET` | `/api/integrations/notion/connect` | Initiate OAuth flow → redirect to Notion |
| `GET` | `/api/integrations/notion/callback` | OAuth code exchange, store encrypted token, redirect to `/?notion=connected` |
| `GET` | `/api/integrations/notion/pages` | List shared pages and databases (`?type=page|database|all&q=search`) |
| `POST` | `/api/integrations/notion/import` | Import selected pages/databases into a project |
| `POST` | `/api/integrations/notion/reimport` | Re-import previously imported pages for a project |

### File structure

```
app/api/integrations/notion/
  route.ts                     ← GET (status), DELETE (disconnect)
  connect/route.ts             ← GET (initiate OAuth)
  callback/route.ts            ← GET (OAuth callback)
  pages/route.ts               ← GET (list shared pages + databases)
  import/route.ts              ← POST (import)
  reimport/route.ts            ← POST (reimport)

lib/integrations/
  notion.ts                    ← OAuth helpers, Notion API client, page listing,
                                  block fetching, block-to-Markdown renderer,
                                  database query assembler,
                                  getNotionConfig(), buildNotionStatus()
  notion-import.ts             ← Import + reimport orchestration
  notion-tokens.ts             ← AES-256-GCM encrypt/decrypt, getAccessToken()

types/index.ts                 ← Add NotionIntegrationAccount, NotionIntegrationStatus,
                                  NotionImportedItem, NotionPageSummary,
                                  NotionPageListResponse, ProjectHomeNotionSummary
```

---

## 15. UI Entry Points

### `components/chat/notion-integration-panel.tsx` (new)

Mirroring `github-integration-panel.tsx`. Workspace panel with:

- **Not connected state**: "Connect Notion" button → `/api/integrations/notion/connect`. Note: _"You'll choose which pages to share in Notion's connection screen."_
- **Connected state**:
  - Connected workspace name and user display name.
  - Project selector (required before importing).
  - Page/database list from `GET /api/integrations/notion/pages`:
    - Type filter tabs: All / Pages / Databases.
    - Search input (uses `q` param).
    - Pagination (next page button).
    - Importable item: checkbox for selection, Notion icon, title, last edited date.
    - Already imported items: show "Imported" badge with last import date.
    - Database items: show entry count estimate if available.
  - "Import selected" button → `POST /api/integrations/notion/import`.
  - "Re-import project pages" button → `POST /api/integrations/notion/reimport`.
  - "Disconnect" button (with note about revoking in Notion settings).

### `components/chat/sidebar.tsx`

Add to user account dropdown alongside GitHub (and Google Drive if implemented):

```tsx
<DropdownMenuItem asChild>
  <button onClick={() => openWorkspaceTool({ tool: 'notion' })}>
    Notion
  </button>
</DropdownMenuItem>
```

### `components/chat/settings-modal.tsx`

Add a Notion section in the Integrations settings panel. Shows connection status, workspace name, connected user, disconnect button.

### `components/chat/project-home.tsx` (if a Project Home panel exists)

Add a `ProjectHomeNotionSummary` section (mirrors `ProjectHomeGitHubSummary`). Shows:
- Workspace connected or "Connect Notion" prompt.
- Count of imported Notion pages in this project.
- Last imported timestamp.
- "Import more" button → opens panel.

### `/knowledge` Knowledge Library

The `fileToIntelligence` mapper already surfaces `metadata.source` in `FileIntelligence.metadata.source`. Notion-imported files will carry `source: 'notion'`.

**Recommended approach** (Option B, defer source tabs):
- Notion files appear in the "All" tab with a Notion badge icon (same as the plan for Google Drive).
- When multiple external sources exist, add a source filter dropdown instead of proliferating tabs.
- The Knowledge Library's existing source badge logic only needs `metadata?.source === 'notion'` added.

### `lib/chat-context.tsx`

Add `'notion'` to the `WorkspaceToolRequestInput` union:

```ts
type WorkspaceToolRequestInput =
  | { tool: 'ask-files'; fileId?: string }
  | { tool: 'github' }
  | { tool: 'google-drive' }
  | { tool: 'notion' }
  | ...
```

---

## 16. Implementation Order

Each step is self-contained and independently mergeable.

1. **Types** — Add `NotionIntegrationAccount`, `NotionIntegrationStatus`, `NotionPageSummary`, `NotionPageListResponse`, `NotionImportedItem`, `ProjectHomeNotionSummary` to `types/index.ts`. Update `IntegrationProvider` union.

2. **Schema + migration** — Update `integrationProviderCheck` in `lib/db/schema.ts` to include `'notion'` (and `'google-drive'` if not already there). Write and verify migration SQL in `neon/migrations/`.

3. **Token helpers** — `lib/integrations/notion-tokens.ts`: AES-256-GCM encrypt/decrypt, `getNotionDecryptionKey()`, `getNotionAccessToken()`. No refresh logic needed. Unit-testable in isolation.

4. **Notion API client + block renderer** — `lib/integrations/notion.ts`: `getNotionConfig()`, `buildNotionStatus()`, OAuth URL builder, code exchange, search/list shared pages, `fetchPageBlocks()` with pagination and depth limit, `renderBlocksToMarkdown()`, `assemblePageText()`, `assembleDatabaseText()`.

5. **Repository methods** — Extend `lib/db/repositories/integrations.ts` with the 7 Notion methods from section 13.

6. **Import orchestration** — `lib/integrations/notion-import.ts`: `importNotionPages()`, `reimportNotionProjectPages()`. Mirror `github-import.ts` structure.

7. **API routes** — All 7 routes. Match existing patterns exactly: `requireAuthenticatedUser` → business logic → `appendAuthCookies`.

8. **Panel component** — `components/chat/notion-integration-panel.tsx`. Wire into `chat-layout.tsx` workspace tool dispatcher and `lib/chat-context.tsx`.

9. **Entry points** — Sidebar dropdown item, settings panel section, project home section, Knowledge Library source badge for `'notion'`.

10. **Verification** — `npm run typecheck`, `npm run lint`, `npm run build`. Confirm `/knowledge` shows Notion badge. Confirm Ask Files picks up Notion-indexed chunks.

---

## 17. Key Differences from GitHub / Google Drive Integrations

| Aspect | GitHub | Google Drive | Notion |
|---|---|---|---|
| Auth model | GitHub App (JWT + installation token) | OAuth 2.0 + refresh token | OAuth 2.0, permanent access token |
| Token expiry | Per-request installation token (1h) | Access token expires (refresh required) | Never expires |
| Token storage | `encryptedTokenPayload: null` (not needed) | AES-256-GCM encrypted | AES-256-GCM encrypted |
| Content format | Raw file bytes (text/binary) | Binary file download or Workspace export | Block API → assembled Markdown |
| File listing | Repository tree via GitHub API | Folder browse via Drive API | Shared pages via `/v1/search` |
| User access control | Repo-level installation grant | Folder/file browse after OAuth | User picks pages at OAuth time |
| Workspace exports | N/A | Google Doc → DOCX, Sheet → CSV | Block render → Markdown |
| Rate limits | 5,000 req/h (installation token) | Drive API quotas (per project/user) | 3 req/sec per integration |
| Revoke API | N/A (uninstall App at GitHub) | `POST oauth2.googleapis.com/revoke` | No public revoke endpoint |
| Background sync | Not implemented | Not planned for v1 | Not planned for v1 |

---

## 18. Out of Scope for v1

- Background sync / webhooks (Notion does not have a public push API)
- Recursive child page import (child pages appear as placeholders)
- Database rows with block-level content (only property values imported for databases)
- Shared databases or pages from other workspaces
- Notion comments import
- Rich text formatting preservation (markup stripped to `plain_text`)
- Per-page granular permission management
- Stripe, Supabase, external vector DB
- Notion write actions of any kind
