# AI Project Checklist

## Install

Documented install command:

```bash
npm install
```

Known ambiguity:

- `pnpm-lock.yaml` exists and `node_modules/.pnpm` exists.
- `README.md` says `npm install`.
- Before changing dependencies, decide whether the repo standard is npm or pnpm.

## Development

```bash
npm run dev
```

Default local URL:

```text
http://localhost:3000
```

## Build

```bash
npm run build
```

Known issue:

- `next.config.mjs` sets `typescript.ignoreBuildErrors: true`, so build may hide TypeScript errors.

## Lint

```bash
npm run lint
```

Known issue:

- Lint may fail because the repo is missing an ESLint flat config file.

## Typecheck

No `typecheck` script currently exists.

Recommended command:

```bash
npx tsc --noEmit
```

## Required Environment Variables

From `.env.example`:

```env
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
TAVILY_API_KEY=
OPENAI_API_KEY=
# EMBEDDINGS_API_KEY=
# EMBEDDINGS_BASE_URL=https://api.openai.com/v1
# EMBEDDINGS_MODEL=text-embedding-3-small
DATABASE_URL=
FILE_STORAGE_PROVIDER=local
FILE_STORAGE_BUCKET=zenquanta-files
FILE_STORAGE_LOCAL_DIR=.storage/zenquanta
# FILE_STORAGE_ENDPOINT=
# FILE_STORAGE_REGION=auto
# FILE_STORAGE_ACCESS_KEY_ID=
# FILE_STORAGE_SECRET_ACCESS_KEY=
```

Accepted aliases in code include:

- `NEON_DATABASE_URL`
- `POSTGRES_URL`

`DATABASE_URL` is preferred for Neon. `NEON_DATABASE_URL` and `POSTGRES_URL` are accepted aliases in code.

## Neon Setup Requirements

Neon currently provides a server-only client, Drizzle schema definitions, a server-only repository layer, a handwritten fresh baseline migration, and migrated runtime database slices. The fresh schema and repository layer cover:

- app-owned users, auth identity placeholders, local credentials, and sessions
- projects
- conversations and messages
- prompt library
- user settings
- profiles and admin roles
- subscriptions and usage overrides
- text and image usage records
- plan requests and admin audit logs
- assistant recommendation telemetry
- file metadata
- generated image metadata
- uploaded-file text chunks and pgvector embeddings for project knowledge

Repository rule:

- User-owned Neon writes should ensure a fresh `zen_users` anchor exists before inserting dependent records.

Current Neon-backed runtime routes:

- `/api/auth/*`
- `/api/settings`
- `/api/prompts`
- `/api/prompts/[id]`
- `/api/assistant-recommendations`
- `/api/projects`
- `/api/projects/[id]`
- `/api/conversations`
- `/api/conversations/[id]`
- conversation persistence inside `/api/chat`
- billing enforcement and text usage logging inside `/api/chat`
- conversation persistence inside `/api/images/generate`
- billing enforcement and image usage logging inside `/api/images/generate`
- `/api/images/history`
- `/api/dashboard` and `/dashboard`
- `/pricing` and `/api/plan-requests`
- `/api/admin/*`, `/admin`, and `/admin/users/[id]`
- auth profile/role hydration
- local browser import app-data writes

## Private File Storage Setup Requirements

New uploaded files and generated images use `lib/storage/object-store.ts`.

Supported providers:

- `local` for development
- `s3` for S3-compatible storage
- `r2` for Cloudflare R2/S3-compatible storage

Expected private bucket:

- `zenquanta-files`

Local storage writes to `.storage/zenquanta`, which is gitignored. Production storage should use server-only S3-compatible/R2 credentials. Do not expose storage access keys to the frontend.

## Migration Order

Fresh foundation migration available for Neon:

1. `neon/migrations/20260522_zenquanta_fresh_initial.sql`
2. `neon/migrations/20260522_zenquanta_local_auth.sql`
3. `neon/migrations/20260522_zenquanta_message_sources.sql`
4. `neon/migrations/20260522_zenquanta_file_knowledge.sql`

Apply with a Postgres client or Neon SQL editor. CLI example:

```bash
psql "$DATABASE_URL" -f neon/migrations/20260522_zenquanta_fresh_initial.sql
```

Supabase migrations remain as historical/product reference only. They are not prerequisites for Neon app data, Neon auth, or neutral private file storage:

1. `supabase/migrations/20260401_zenquanta_projects_prompts.sql`
2. `supabase/migrations/20260401_zenquanta_conversation_memory.sql`
3. `supabase/migrations/20260401_zenquanta_billing_admin_platform.sql`
4. `supabase/migrations/20260401_zenquanta_assistant_recommendations.sql`

## Fresh Neon Planning

Before changing persistence code again:

1. Apply or validate the fresh Neon schema separately from current runtime flows.
2. Do not import, copy, backfill, or preserve Supabase database rows.
3. Treat Supabase migrations as product/runtime reference only, not Neon prerequisites.
4. Use neutral private file storage for new uploads and generated images.
5. Supabase runtime helpers have been removed; do not reintroduce Supabase runtime clients for app data, auth, or storage.
6. Swap one feature area at a time only in explicit milestones.
7. Do not import, copy, backfill, or preserve old Supabase Storage objects.
8. Do not wire additional routes to Neon repositories until the target environment has the fresh Neon migration applied.

## Local Verification Flow

1. Install dependencies.
2. Create `.env.local` from `.env.example`.
3. Fill OpenRouter, Neon, file storage, Tavily, and embeddings values as needed.
4. Apply the fresh Neon migrations for database/auth flows.
5. Start dev server with `npm run dev`.
6. Sign up or sign in.
7. Send a text prompt and verify `/api/chat` streaming.
8. With `TAVILY_API_KEY` configured, send a Pulse or `webSearch` prompt and verify sources appear.
9. With an embeddings key configured, upload a text/code file, enable `fileContext`, and verify chat cites uploaded-file sources.
10. Generate an image with Prism and verify `/api/images/generate`.
11. Check `/dashboard` for usage.
12. If using admin flows, ensure the user has an admin role in `zen_profiles`.

## Production Safety Checks

- Add a working ESLint flat config.
- Add and run a real typecheck command.
- Consider disabling `typescript.ignoreBuildErrors`.
- Confirm file storage credentials are server-only.
- Confirm `OPENROUTER_API_KEY` is server-only.
- Confirm `TAVILY_API_KEY` is server-only.
- Confirm `OPENAI_API_KEY` or `EMBEDDINGS_API_KEY` is server-only.
- Confirm generated images are stored durably if required.
- Confirm pgvector is available in Neon before enabling uploaded-file knowledge.
- Confirm Pulse/webSearch source display and no-key degradation before presenting live retrieval in production.
- Do not claim automated payments, checkout, customer portal, webhooks, or subscription automation. Manual plan requests and admin activation are the intended flow unless explicitly changed later.

## Common Failure Points

- Missing OpenRouter key causes fallback/mock text and image behavior.
- Missing Tavily key causes Pulse/webSearch to answer without live source context and without source claims.
- Missing embeddings key skips uploaded-file indexing/retrieval without blocking uploads.
- Missing pgvector extension or file knowledge migration breaks chunk storage and retrieval.
- Missing Neon `DATABASE_URL` breaks auth, settings, prompt library, assistant recommendation, project, conversation, chat persistence, image persistence, billing/admin, usage, dashboard, plan request, image history, profile/role hydration, and local import app-data paths.
- Missing S3-compatible/R2 env vars breaks attachment and generated-image storage when `FILE_STORAGE_PROVIDER` is `s3` or `r2`.
- Lint can fail because ESLint flat config is missing.
- TypeScript errors can be hidden by Next config.
- Package manager mismatch can cause lockfile churn.
- Tavily request failures should degrade without claiming live verification.
- Advanced PDF/OCR extraction is not implemented in uploaded-file knowledge v1.
- Manual plan requests are not payment automation.
- Partial Neon route migration can create mixed Supabase/Neon data sources if the data boundary is not planned first.
- Supabase Auth users, sessions, and passwords are intentionally not copied into Neon.
- Fresh schema parity checks matter for admin data, usage records, subscriptions, plan requests, conversations, projects, prompts, and settings.
- Old Supabase Storage URLs and objects are intentionally not migrated into the new storage layer.
- Neon repositories are active for settings, prompt library, assistant recommendation telemetry, projects, conversations, messages, conversation memory, subscriptions/manual plans, usage records, plan requests, dashboard data, image history, admin data, and profile/role hydration.
