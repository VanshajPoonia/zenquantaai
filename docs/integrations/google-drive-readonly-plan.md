# Google Drive Read-Only Integration — Implementation Plan

**Status**: Planning only. No code changes in this document.  
**Date**: 2026-06-16  
**Scope**: v1 — user-triggered import of selected Drive files into Zenquanta projects and Ask Files. No background sync. No Drive writes.

---

## 1. OAuth Scope Strategy

### Recommended scope: `drive.readonly`

```
https://www.googleapis.com/auth/drive.readonly
```

Grants read access to all files and metadata in the user's Drive. Lets the server list files, navigate folders, and download content — all necessary for a file browser + import UX.

Google shows the user: _"See and download all your Google Drive files"_ at consent time. This is the expected disclosure for a Drive import integration.

### Why not `drive.file`?

`drive.file` only gives the app access to files the user explicitly opens through the app via the [Google Picker API](https://developers.google.com/drive/picker/guides/overview) (a JavaScript widget). This gives finer per-file consent but:

- Requires a separate Picker API key in addition to OAuth client credentials.
- Requires a JS-embedded Google Picker widget in the UI (different browser surface from the current panel pattern).
- Cannot browse folder trees without the Picker.

**Defer `drive.file` + Picker to a future version** if the consent surface needs to be narrowed.

### Request `offline` access

Always request `access_type=offline` to receive a `refresh_token`. Without it, tokens expire in 1 hour with no way to renew server-side.

```
access_type=offline
prompt=consent   // Forces Google to re-issue refresh_token even if previously granted
```

### Scopes to request

```
openid
https://www.googleapis.com/auth/userinfo.email
https://www.googleapis.com/auth/drive.readonly
```

`userinfo.email` is used to display the connected Google account email in the UI.

---

## 2. Token Storage and Encryption

### The `encryptedTokenPayload` column already exists

`zen_integration_accounts.encrypted_token_payload` (jsonb) is present in the schema. GitHub leaves it null (uses App installation tokens instead). Google Drive must populate it.

### Encryption: AES-256-GCM

Use Node.js built-in `crypto` — no new packages. Do not store plaintext tokens.

**Key**: `GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY` — a 64-character hex string representing 32 bytes (AES-256 key). Must be in `.env.local` and server-only.

**Encrypted payload envelope** (stored as jsonb):

```json
{
  "version": 1,
  "iv": "<32-char hex, 16 bytes>",
  "tag": "<32-char hex, 16 bytes auth tag>",
  "ciphertext": "<hex>"
}
```

**Plaintext payload** (what gets encrypted):

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "expiry_date": 1749999999000,
  "token_type": "Bearer",
  "scope": "https://www.googleapis.com/auth/drive.readonly ..."
}
```

### Token refresh

Before any Drive API call, decrypt the payload and check `expiry_date`. If within 60 seconds of expiry or already expired:

1. Call `POST https://oauth2.googleapis.com/token` with `grant_type=refresh_token`.
2. Encrypt and update `encrypted_token_payload` in Neon.
3. Proceed with the new `access_token`.

If refresh fails (e.g., user revoked at Google), catch the error and set `status: 'error'` on the account record. Surface this in the UI as "Reconnection required."

### Token implementation file

`lib/integrations/google-drive-tokens.ts` (server-only):

- `encryptTokenPayload(payload, key): EncryptedTokenEnvelope`
- `decryptTokenPayload(envelope, key): DriveTokenPayload`
- `getDecryptionKey(): Buffer` — reads and validates `GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY`
- `refreshDriveTokenIfNeeded(userId, account, db): Promise<string>` — returns current `access_token`, refreshes if needed, updates DB

---

## 3. Connection / Revocation Flow

### 3a. Connect

1. `GET /api/integrations/google-drive/connect`
   - Requires authenticated user session.
   - Checks `GOOGLE_DRIVE_CLIENT_ID` is configured; 400 if not.
   - Generates a CSRF `state` UUID.
   - Sets `zenquanta_gdrive_oauth_state` httpOnly cookie (10-minute TTL).
   - Redirects to:
     ```
     https://accounts.google.com/o/oauth2/v2/auth
       ?client_id=<CLIENT_ID>
       &redirect_uri=<CALLBACK_URL>
       &response_type=code
       &scope=openid email https://www.googleapis.com/auth/drive.readonly
       &access_type=offline
       &prompt=consent
       &state=<state>
     ```

2. `GET /api/integrations/google-drive/callback?code=...&state=...`
   - Validate `state` matches cookie value; clear the state cookie.
   - Exchange `code` for tokens: `POST https://oauth2.googleapis.com/token`
   - Fetch connected Google account email/name: `GET https://www.googleapis.com/oauth2/v2/userinfo`
   - Encrypt token payload.
   - Upsert `zen_integration_accounts` with:
     ```
     provider: 'google-drive'
     externalAccountId: <Google user sub>
     externalAccountLogin: <email>
     externalAccountName: <name>
     installationId: null
     scopes: ['drive.readonly']
     status: 'connected'
     encryptedTokenPayload: <encrypted envelope>
     ```
   - Redirect to `/?drive=connected`.

### 3b. Disconnect / Revocation

`DELETE /api/integrations/google-drive`:

1. Decrypt current token from DB.
2. Call `POST https://oauth2.googleapis.com/revoke?token=<refresh_token>` (best-effort; do not block on error).
3. Set `status: 'revoked'`, `encryptedTokenPayload: null`, `revokedAt: now()`.
4. Imported `zen_integration_items` are **not** deleted — the imported Zenquanta files remain as knowledge. Document this behavior clearly in the UI ("Your imported files remain in your projects").

### 3c. Error handling

If the Drive API returns a 401 or 403, treat it as token revocation: update `status: 'error'`, clear `encryptedTokenPayload`, surface "Reconnect your Google Drive" in the panel.

---

## 4. File Picker / Listing UX

### Option: Custom folder browser (recommended for v1)

Consistent with the GitHub file listing pattern. No JavaScript SDKs required.

**Route**: `GET /api/integrations/google-drive/files`

Query params:

| Param | Default | Description |
|---|---|---|
| `folderId` | `root` | Drive folder ID to list |
| `q` | — | Drive query filter (optional search string applied as `name contains '...'`) |
| `pageToken` | — | Pagination (v1: cap at 100 files, no pagination UI needed) |

Drive API call:

```
GET https://www.googleapis.com/drive/v3/files
  ?q=('root' in parents and trashed=false)
  &fields=files(id,name,mimeType,size,modifiedTime,webViewLink,parents),nextPageToken
  &pageSize=100
  &orderBy=folder,name
```

Response shape returned to client:

```ts
{
  folderId: string
  folderName: string | null   // name of current folder (null for root)
  breadcrumbs: Array<{ id: string; name: string }>  // path from root to current folder
  files: GoogleDriveFileSummary[]
  nextPageToken: string | null
}

type GoogleDriveFileSummary = {
  id: string
  name: string
  mimeType: string            // Drive MIME type (may differ from export MIME)
  driveType: 'folder' | 'importable' | 'unsupported'
  size: number | null
  modifiedTime: string
  webViewLink: string | null
  exportMimeType: string | null  // resolved export MIME for Google Workspace docs
}
```

Folders appear at the top of the list. Clicking a folder navigates into it.

The client maintains a breadcrumb stack for back-navigation.

### Search

When `q` is provided, search is scope-widened to all of Drive (not folder-scoped):

```
name contains 'budget' and trashed=false
```

---

## 5. Supported Drive File Types

### Native uploads in Drive (downloaded via `alt=media`)

| MIME type | Extension(s) | Zenquanta support |
|---|---|---|
| `application/pdf` | `.pdf` | Extracted via PDF extractor |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `.docx` | Extracted via mammoth |
| `text/plain` | `.txt` | Generic text extractor |
| `text/csv` | `.csv` | CSV extractor |
| `text/markdown`, `text/x-markdown` | `.md`, `.mdx` | Markdown extractor |
| `application/json` | `.json` | JSON extractor |
| `text/html` | `.html` | Text extractor (HTML) |
| `text/x-python`, `text/typescript`, etc. | `.py`, `.ts`, … | Generic text extractor |

### Google Workspace documents (export required)

Google Workspace files cannot be downloaded directly; they must be exported to a compatible format.

| Drive MIME type | Export to | Zenquanta MIME after export |
|---|---|---|
| `application/vnd.google-apps.document` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `.docx` via mammoth |
| `application/vnd.google-apps.spreadsheet` | `text/csv` | CSV extractor |
| `application/vnd.google-apps.presentation` | — | **Skip in v1** (text export quality is poor) |
| `application/vnd.google-apps.drawing` | — | **Skip in v1** |
| `application/vnd.google-apps.script` | `application/vnd.google-apps.script+json` | **Skip in v1** |
| `application/vnd.google-apps.form` | — | **Skip in v1** |

Export endpoint: `GET https://www.googleapis.com/drive/v3/files/{id}/export?mimeType=<exportMime>`

### Files to skip (mark as `driveType: 'unsupported'`)

- Images: `image/*`
- Video: `video/*`
- Audio: `audio/*`
- Archives: `application/zip`, `application/x-tar`, etc.
- Google Forms, Drawings, Scripts, Presentations

### Size limits

- **Per file**: `MAX_PRIVATE_FILE_BYTES` (from `lib/storage/security.ts`) for native uploads. For Drive exports, apply a practical cap of `1 MB` since export bytes are not pre-known.
- **Per import batch**: 25 files, 2 MB total (align with GitHub batch limits; tune if Drive documents are typically larger than source code files).

Enforce limits before reading the full response body: check `Content-Length` header if present, or stream and abort on excess.

---

## 6. Import as Private Zenquanta File / Knowledge Record

Mirrors `lib/integrations/github-import.ts` exactly.

### Steps per file

1. Resolve import method: native download (`alt=media`) vs. Workspace export.
2. Fetch bytes (with enforced size limit).
3. Compute `SHA-256` checksum of bytes.
4. Check for existing `zen_integration_items` record by `externalId = driveFileId` and `projectId` — if found, patch; if not, create.
5. Write `zen_files` record:
   ```
   provider: 'external'
   bucket: null
   storagePath: null
   publicUrl: null
   fileName: <Drive file name>
   mimeType: <resolved MIME>
   byteSize: bytes.length
   checksum
   visibility: 'private'
   metadata: {
     source: 'google-drive',
     sourceKind: 'drive_file',
     externalId: driveFileId,
     driveMimeType: <original Drive MIME>,
     driveFileId,
     webViewLink,
     importedAt: ISO string,
     modifiedTime: <Drive modifiedTime>,
     exportMimeType: <if applicable>,
   }
   ```
6. Run `indexUploadedFileForKnowledge({ userId, file, fileName, mimeType, bytes, projectId })`.
7. Upsert `zen_integration_items`:
   ```
   provider: 'google-drive'
   externalId: driveFileId
   projectId
   fileId: file.id
   title: Drive file name
   sourceUrl: webViewLink
   path: Drive file name (no repo path concept)
   sha: null (use contentHash instead)
   contentHash: checksum
   byteSize: bytes.length
   mimeType: resolved MIME
   status: 'imported'
   lastImportedAt: now()
   metadata: { driveFileId, driveMimeType, modifiedTime }
   ```

Files without object storage paths are treated identically to GitHub imports in the Knowledge Library and Ask Files — the protected URL route (`/api/files/object`) is only invoked for files with a `storagePath`. Drive-imported files open via their `metadata.webViewLink` (the Drive view link) or show "view not available" for the inline viewer.

> **Important**: The `metadata.source = 'google-drive'` field is already surfaced in `FileIntelligence.metadata.source` by the existing `fileToIntelligence` mapper. The Knowledge Library will display Drive files in the **GitHub** tab alongside GitHub files, or a new source filter will need to be added. See section 14 (UI Entry Points) for the recommended change.

---

## 7. Project Assignment

Pass `projectId` as a required body field to the import route. Validates that the project belongs to the authenticated user before importing (same pattern as GitHub import).

Post-import reassignment uses the existing `PATCH /api/files/[id]` endpoint.

---

## 8. Re-import / Manual Sync

`POST /api/integrations/google-drive/reimport`

Body: `{ projectId: string; itemIds?: string[] }`

- Loads matching `zen_integration_items` for the user and project (or specific IDs).
- For each item, re-downloads from Drive using the stored `driveFileId` in `metadata`.
- Computes new checksum; if unchanged from `contentHash`, skip re-indexing (optimization, not required in v1 — always re-index on reimport if simpler).
- Updates `zen_files` record, re-indexes, updates `zen_integration_items.lastImportedAt`.

`modifiedTime` from Drive can be stored in item metadata and checked against a freshly fetched file stat before downloading bytes, to avoid unnecessary downloads.

---

## 9. No Background Sync in v1

All imports and re-imports are user-triggered. There are no:

- Cron jobs
- Webhooks from Drive (Drive Push Notifications / Changes API)
- Background queues
- Auto-refresh of stale files

**Justification**: The GitHub integration has no background sync either. Users import deliberately. Background sync adds significant complexity (webhook verification, change polling, token lifecycle management across inactive users) with unclear v1 value. If requested later, Drive's [Changes API](https://developers.google.com/drive/api/v3/reference/changes) and `startPageToken` are the correct mechanism.

---

## 10. Security Risks

### High priority

| Risk | Mitigation |
|---|---|
| **Token theft from DB** | `encryptedTokenPayload` uses AES-256-GCM. Encryption key lives in env, not in Neon. A DB dump does not expose tokens without the key. |
| **Callback CSRF** | `state` UUID generated per-request, stored in httpOnly cookie, verified in callback. Same pattern as GitHub. |
| **SSRF via folderId/fileId** | Drive API enforces access control on the user's own token. The server never fetches arbitrary URLs — all requests go to `https://www.googleapis.com/drive/v3/*`. Validate that `folderId` is alphanumeric (Drive IDs are) before passing to API. |
| **Memory exhaustion on large files** | Enforce `Content-Length` header check before reading full body. Abort stream if size exceeds limit. |
| **Token over-scope (`drive.readonly`)** | The scope is disclosed to the user at Google's consent screen. All token handling is server-only — tokens never reach the browser. |

### Medium priority

| Risk | Mitigation |
|---|---|
| **Refresh token invalidated by user at Google** | Catch 401/403 from token refresh; set `status: 'error'`; surface reconnect CTA. |
| **Refresh race conditions** | If two concurrent requests hit an expired token simultaneously, both may call the refresh endpoint. Mitigation: add a short-lived DB flag (`tokenRefreshingAt`) or use the expiry check as an optimistic lock. (Can defer to v1.1.) |
| **Import of sensitive user files** | Users choose what to import. Show a UI note: "Only import files you intend to use as project knowledge." Cannot prevent at the API level. |
| **Google API quotas** | Drive API has per-project and per-user quotas. Sequential import (no parallel requests) avoids hitting per-second rate limits. If quota errors appear, implement exponential backoff. |
| **Drive file name collisions** | Two files with the same name in different folders can be imported. Use `driveFileId` as the deduplication key in `externalId`, not the name. |

### Lower priority

| Risk | Mitigation |
|---|---|
| **Export quality for Google Workspace docs** | Google Doc → DOCX export is faithful. Sheet → CSV is lossless. Slides text export is poor — skip slides in v1. |
| **Encrypted Google Docs** | Drive exports of encrypted Google Workspace files will fail gracefully; catch and report as `skipped`. |
| **Very large Workspace exports** | A large Google Sheet could export as a huge CSV. Apply size limits before reading the export response body. |

---

## 11. Required Environment Variables

```bash
# Google Drive OAuth2 app credentials (register at Google Cloud Console)
GOOGLE_DRIVE_CLIENT_ID=
GOOGLE_DRIVE_CLIENT_SECRET=

# Must match the redirect URI registered in Google Cloud Console
GOOGLE_DRIVE_CALLBACK_URL=https://your-domain.com/api/integrations/google-drive/callback

# AES-256-GCM key for encrypting OAuth tokens at rest in Neon
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY=
```

Add these names (without values) to any committed env documentation.

Do not add these to `.env.example` unless the user explicitly requests a committed env template.

---

## 12. Database Tables Needed

**No new tables.** Existing tables cover all required data.

### Schema change required: provider check constraint

`lib/db/schema.ts` — update `integrationProviderCheck`:

```ts
// Before
const integrationProviderCheck = ['github'] as const

// After
const integrationProviderCheck = ['github', 'google-drive'] as const
```

This updates the Drizzle check constraint for `zen_integration_accounts.provider`.

### Neon migration SQL (new migration file in `neon/migrations/`)

```sql
-- Update provider check to include google-drive
ALTER TABLE zen_integration_accounts
  DROP CONSTRAINT IF EXISTS zen_integration_accounts_provider_check;

ALTER TABLE zen_integration_accounts
  ADD CONSTRAINT zen_integration_accounts_provider_check
  CHECK (provider IN ('github', 'google-drive'));
```

### New repository methods needed

Add to `lib/db/repositories/integrations.ts` (extend `NeonIntegrationsRepository`):

```ts
getGoogleDriveAccount(userId: string): Promise<GoogleDriveIntegrationAccount | null>

upsertGoogleDriveAccount(userId: string, input: {
  externalAccountId: string       // Google user sub
  externalAccountLogin: string    // email
  externalAccountName: string | null
  scopes: string[]
  encryptedTokenPayload: Record<string, unknown>
}): Promise<GoogleDriveIntegrationAccount>

updateGoogleDriveTokens(userId: string, accountId: string, encryptedPayload: Record<string, unknown>): Promise<void>

disconnectGoogleDrive(userId: string): Promise<GoogleDriveIntegrationAccount | null>

upsertGoogleDriveItem(userId: string, input: UpsertGoogleDriveItemInput): Promise<GoogleDriveImportedItem>

listGoogleDriveItemsForProject(userId: string, projectId: string): Promise<GoogleDriveImportedItem[]>

listGoogleDriveItemsByIds(userId: string, ids: string[]): Promise<GoogleDriveImportedItem[]>

getProjectGoogleDriveSummary(userId: string, projectId: string): Promise<ProjectGoogleDriveSummary>
```

---

## 13. API Routes Needed

All routes: `import 'server-only'`, `runtime = 'nodejs'`, `requireAuthenticatedUser`, `appendAuthCookies` on session refresh.

| Method | Path | Handler |
|---|---|---|
| `GET` | `/api/integrations/google-drive` | Returns `GoogleDriveIntegrationStatus` (configured, connected, account) |
| `DELETE` | `/api/integrations/google-drive` | Revoke tokens at Google + disconnect account record |
| `GET` | `/api/integrations/google-drive/connect` | Initiate OAuth flow → redirect to Google |
| `GET` | `/api/integrations/google-drive/callback` | Handle OAuth code exchange, store encrypted tokens |
| `GET` | `/api/integrations/google-drive/files` | List Drive files/folders (`?folderId=root&q=search`) |
| `POST` | `/api/integrations/google-drive/import` | Import selected Drive files into a project |
| `POST` | `/api/integrations/google-drive/reimport` | Re-import previously imported files for a project |

### File structure

```
app/api/integrations/google-drive/
  route.ts                     ← GET (status), DELETE (disconnect)
  connect/route.ts             ← GET (initiate OAuth)
  callback/route.ts            ← GET (OAuth callback)
  files/route.ts               ← GET (list files)
  import/route.ts              ← POST (import)
  reimport/route.ts            ← POST (reimport)

lib/integrations/
  google-drive.ts              ← OAuth helpers, Drive API client, file listing, download, export
  google-drive-import.ts       ← Import + reimport orchestration (mirrors github-import.ts)
  google-drive-tokens.ts       ← AES-256-GCM encrypt/decrypt, refresh logic

types/index.ts                 ← Add GoogleDriveIntegrationAccount, GoogleDriveIntegrationStatus,
                                  GoogleDriveImportedItem, GoogleDriveFileSummary, ProjectGoogleDriveSummary
```

---

## 14. UI Entry Points

### `components/chat/google-drive-integration-panel.tsx` (new)

Mirroring `github-integration-panel.tsx`. Workspace panel with:

- **Not connected state**: "Connect Google Drive" button → navigates to `/api/integrations/google-drive/connect`.
- **Connected state**:
  - Shows connected account email.
  - Project selector (required before importing).
  - Folder breadcrumb navigation.
  - File list with:
    - Folder icon → navigate into folder
    - Importable file → checkbox for selection
    - Unsupported file → dimmed with tooltip
  - Search input (queries across all Drive, not folder-scoped).
  - "Import selected" button → `POST /api/integrations/google-drive/import`
  - "Re-import project files" button → `POST /api/integrations/google-drive/reimport`
  - "Disconnect" button.

### `components/chat/sidebar.tsx`

Add to user account dropdown:

```tsx
<DropdownMenuItem asChild>
  <Link href="/" onClick={() => openWorkspaceTool({ tool: 'google-drive' })}>
    Google Drive
  </Link>
</DropdownMenuItem>
```

(Or a dedicated settings page route — choose whichever matches GitHub's entry point pattern.)

### `components/chat/settings-panel.tsx`

Add a Google Drive section in the Integrations settings panel (alongside GitHub). Shows connection status, connected account, disconnect button.

### `components/chat/project-home.tsx`

Add a `ProjectHomeGoogleDriveSummary` section (mirrors existing `ProjectHomeGitHubSummary`). Shows:
- Connected account or "Connect Drive" prompt.
- Count of imported Drive files in this project.
- Last imported timestamp.
- "Import more" button.

### `/knowledge` Knowledge Library

The existing Knowledge Library already supports `metadata.source` for source badges. Two options:

**Option A (minimal)**: Update `isGitHubFile()` → rename to `getFileSource()` returning `'github' | 'google-drive' | 'upload'`. Add a "Google Drive" tab alongside "GitHub." Show Drive icon badge on Drive-imported files.

**Option B (deferred)**: Keep the current "GitHub" tab as-is for now; Drive-imported files appear in "All" tab with a Drive badge. Add a dedicated source tab in a later pass when more sources exist.

Option B is simpler and avoids changing Knowledge Library code at import time.

### `lib/chat-context.tsx`

Add `'google-drive'` to the `WorkspaceToolRequestInput` union:

```ts
type WorkspaceToolRequestInput =
  | { tool: 'ask-files'; fileId?: string }
  | { tool: 'github' }
  | { tool: 'google-drive' }
  | ...
```

---

## 15. Implementation Order

Each step is self-contained and mergeable independently.

1. **Types** — Add `GoogleDriveIntegrationAccount`, `GoogleDriveIntegrationStatus`, `GoogleDriveFileSummary`, `GoogleDriveImportedItem`, `ProjectGoogleDriveSummary` to `types/index.ts`.

2. **Schema + migration** — Update `integrationProviderCheck` in `lib/db/schema.ts`. Write and verify the migration SQL in `neon/migrations/`.

3. **Token helpers** — `lib/integrations/google-drive-tokens.ts`: AES-256-GCM encrypt/decrypt, `getDecryptionKey()`, `refreshDriveTokenIfNeeded()`. Unit-testable in isolation.

4. **Drive client** — `lib/integrations/google-drive.ts`: OAuth URL builder, code exchange, userinfo fetch, Drive file listing, file download (`alt=media`), Google Workspace export, `getGoogleDriveConfig()`, `buildGoogleDriveStatus()`.

5. **Repository methods** — Extend `lib/db/repositories/integrations.ts` with the 7 Google Drive methods listed in section 12.

6. **Import orchestration** — `lib/integrations/google-drive-import.ts`: `importGoogleDriveFiles()`, `reimportGoogleDriveProjectFiles()`. Mirrors `github-import.ts` structure.

7. **API routes** — All 7 routes. Match existing GitHub route patterns exactly (auth check → profile ensure → handler → append cookies).

8. **Panel component** — `components/chat/google-drive-integration-panel.tsx`. Wire into `chat-layout.tsx` and `lib/chat-context.tsx`.

9. **Entry points** — Sidebar dropdown, settings panel section, project home section, Knowledge Library source tab.

10. **Verification** — `npm run typecheck`, `npm run lint`, `npm run build`.

---

## 16. Out of Scope for v1

- Background sync / webhooks (Drive Changes API, Push Notifications)
- Google Picker API / `drive.file` scope
- Google Slides import
- Shared Drive (Team Drive) support
- Import from Shared With Me
- Per-file granular permissions or scoped tokens
- Stripe, Supabase, external vector DB
- Drive write actions of any kind
