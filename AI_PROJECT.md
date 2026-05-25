# Zenquanta AI Project State

## Project Name

Zenquanta AI

## Current Purpose

Zenquanta AI is a Next.js App Router AI workspace with branded assistant families for text chat, image generation, prompt organization, usage tracking, and admin-managed subscription access.

This is the current six-assistant platform, not the old four-mode version.

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS v4
- shadcn/ui-style components built on Radix UI
- neutral private file storage for uploads and generated images
- Fresh Neon Postgres for migrated app persistence
- Drizzle schema definitions for the fresh Neon foundation
- Neon repositories for fresh database access and explicit route migrations
- Tavily for Pulse/webSearch source retrieval
- OpenAI-compatible embeddings for uploaded-file knowledge retrieval
- OpenRouter for AI model access
- Vercel Analytics

## Implemented Features

- Authenticated workspace.
- ID/password auth backed by fresh Neon credentials.
- Six assistant families.
- Streamed text chat.
- Prism image generation.
- Conversation persistence.
- Conversation-scoped memory summaries.
- File uploads through the neutral storage abstraction.
- Text/code uploaded-file knowledge indexing and retrieval with Neon pgvector.
- Generated image files stored through the neutral storage abstraction.
- Local prompt precheck and assistant recommendations.
- Projects.
- Prompt library.
- Reusable prompt workflows with ordered assistant-family steps.
- Text model comparison mode with selectable best-response save-in.
- Private custom text assistants built on top of the built-in text assistant modes.
- User dashboard.
- Admin dashboard.
- Admin cost and margin analytics with period, plan, assistant, and user filters.
- Per-user admin controls.
- Manual plan request flow.
- Usage tracking for text and image requests.
- Public assistant pages.

Prompt workflow v1 runs are intentionally simple: each step is queued as a normal chat or Prism image send using the chosen assistant family. There is no background automation engine, and normal usage logging remains the billing/usage source of truth.

Model comparison v1 is text-only. Users can compare multiple available text assistants through OpenRouter, review model/assistant/latency/displayed usage, and save one chosen response into the conversation. Prism image comparison is not part of this first slice.

## Assistant Families

- `Nova`: general work and practical assistance.
- `Velora`: creative writing, tone, copy, and ideation.
- `Axiom`: structured reasoning and decision support.
- `Forge`: coding, debugging, architecture, and implementation.
- `Pulse`: current-context and research-style assistant with Tavily-backed web search when configured.
- `Prism`: image generation.

Mode mapping:

- `general` -> `nova`
- `creative` -> `velora`
- `logic` -> `axiom`
- `code` -> `forge`
- `live` -> `pulse`
- `image` -> `prism`

## Main Routes

- `/`: main chat workspace.
- `/dashboard`: user usage dashboard.
- `/pricing`: plan overview and manual plan request flow.
- `/admin`: admin overview and user/request management.
- `/admin/users/[id]`: per-user admin detail.
- `/auth/reset-password`: password reset completion page.
- `/nova`, `/velora`, `/axiom`, `/forge`, `/pulse`, `/prism`: public assistant pages.

## Main APIs

- `/api/chat`: streamed text chat.
- `/api/images/generate`: Prism image generation.
- `/api/images/history`: image generation history.
- `/api/conversations` and `/api/conversations/[id]`: conversation persistence.
- `/api/projects` and `/api/projects/[id]`: project management.
- `/api/prompts` and `/api/prompts/[id]`: prompt library.
- `/api/prompt-workflows`, `/api/prompt-workflows/[id]`, and `/api/prompt-workflows/[id]/runs`: reusable workflow CRUD and lightweight run tracking.
- `/api/model-comparisons` and `/api/model-comparisons/[id]/choose`: text assistant/model comparison and chosen response save-in.
- `/api/settings`: user settings.
- `/api/attachments`: attachment upload.
- `/api/dashboard`: user dashboard data.
- `/api/assistant-recommendations`: recommendation telemetry.
- `/api/plan-requests`: user plan requests.
- `/api/admin/*`: admin overview, users, and plan requests.
- `/api/auth/*`: session, sign-in, sign-up, sign-out, unsupported magic-link compatibility, and password reset/update.
- `/api/bootstrap/import-local`: local browser data import into the server-backed stores.

## Auth Status

Auth is implemented as custom Neon-backed credentials auth in `lib/auth/session.ts`.

Current user-facing auth is ID/password-first. Passwords are hashed with per-user salts, sessions use opaque HTTP-only cookies, and auth rows live in Neon. Sign-in attempts are rate-limited through Neon-backed hashed login/IP attempt rows. Supabase Auth users, sessions, and passwords are not imported or preserved; existing users need to sign up again.

## Database Status

Neon Postgres is the active runtime database for migrated app data. Supabase Postgres is no longer the active source for the migrated settings, prompts, recommendations, projects, conversations, billing/admin, usage, plan request, dashboard, and image history flows.

The fresh Neon schema lives in `neon/migrations/20260522_zenquanta_fresh_initial.sql`, and typed Drizzle table definitions live in `lib/db/schema.ts`.

Neon repositories live in `lib/db/repositories/*`. They cover fresh Neon users/auth identity mapping, profiles, subscriptions, usage, plan requests, admin audit logs, projects, conversations/messages/memory, prompts, prompt workflows and run records, text model comparisons and candidates, settings, assistant recommendations, file metadata, and generated image metadata.

Active Neon runtime data paths are:

- `/api/settings`
- `/api/prompts`
- `/api/prompts/[id]`
- `/api/prompt-workflows`
- `/api/prompt-workflows/[id]`
- `/api/prompt-workflows/[id]/runs`
- `/api/model-comparisons`
- `/api/model-comparisons/[id]/choose`
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

These routes use clean Neon records going forward. Existing Supabase rows are not imported, copied, backfilled, or preserved.

The Neon migration creates:

- app-owned users, auth identity mapping, credentials, and sessions
- profiles, subscriptions, manual plan requests, usage overrides, text/image usage events, and admin audit logs
- projects, conversations, messages, conversation memory fields, prompt library, prompt workflows, text model comparisons, private custom text assistants, and user settings
- assistant recommendation events, file metadata, and generated image metadata
- uploaded-file text chunks and pgvector embeddings for private project knowledge

Supabase migrations still exist as historical/product reference only. They are not prerequisites for Neon auth, Neon app data, or the neutral file storage path.

Neon migration order:

1. `20260522_zenquanta_fresh_initial.sql`
2. `20260522_zenquanta_local_auth.sql`
3. `20260522_zenquanta_message_sources.sql`
4. `20260522_zenquanta_file_knowledge.sql`
5. `20260522_zenquanta_prompt_workflows.sql`
6. `20260522_zenquanta_model_comparisons.sql`
7. `20260524_zenquanta_auth_attempts.sql`
8. `20260525_zenquanta_custom_assistants.sql`

Historical Supabase migration order documented in `README.md`:

1. `20260401_zenquanta_projects_prompts.sql`
2. `20260401_zenquanta_conversation_memory.sql`
3. `20260401_zenquanta_billing_admin_platform.sql`
4. `20260401_zenquanta_assistant_recommendations.sql`

## Billing And Usage Status

Billing and usage tracking exist, but payment automation does not.

Payment automation is out of scope unless explicitly requested later. Plan upgrades should remain manual plan requests with admin activation for now.

Implemented:

- plan tiers: `free`, `basic`, `pro`, `ultra`, `prime`
- core token wallet
- tier token wallet
- image credit wallet
- daily message limits
- daily image limits
- text usage events
- image generation events
- admin-only raw/displayed cost and margin analytics
- manual admin activation
- usage limit overrides

Not implemented:

- automated checkout
- automated subscription sync
- automated billing webhooks
- customer portal

## Storage Status

Supabase Storage has been replaced for new files by a neutral server-side object storage abstraction in `lib/storage/object-store.ts`.

Current behavior:

- uploads go through `/api/attachments`
- authenticated file reads go through `/api/files/object`
- upload metadata is stored in `zen_files`
- generated image metadata is stored in `zen_generated_images`
- local development storage writes under `.storage/zenquanta`
- production storage should use `FILE_STORAGE_PROVIDER=s3` or `FILE_STORAGE_PROVIDER=r2` with an S3-compatible endpoint such as Cloudflare R2

Old Supabase-hosted files are not imported, copied, or preserved.

Uploaded text/code files can be indexed for project knowledge. The first version extracts safe text-like files only, chunks text server-side, stores embeddings in Neon `zen_file_chunks` with pgvector, and retrieves scoped chunks for chat when `fileContext` is enabled. Raw files remain private in object storage. Advanced PDF/OCR handling is not part of this first version.

## Model Routing Status

OpenRouter is the only AI generation gateway in current code. Tavily is used only for server-side web search context. OpenAI-compatible embeddings are used only for private uploaded-file retrieval when configured.

Key files:

- `lib/config/assistants.ts`
- `lib/config/models.ts`
- `lib/config/image-models.ts`
- `lib/ai/openrouter.ts`
- `lib/search/web-search.ts`
- `lib/rag/*`
- `lib/ai/chat.ts`

Text assistant routing and response profile overrides are centralized in config. Prism image routing is separate from text chat.

## Neon Postgres Migration Status

Supabase is no longer an active runtime dependency for fresh auth, app data, uploads, or generated-image storage. Historical Supabase migrations still exist in the repo as reference from earlier milestones, but Supabase runtime clients and old Supabase-backed storage modules have been removed.

Implemented foundation and migration slices:

1. Add Neon dependency and server-only client in `lib/db/client.ts`.
2. Add typed Drizzle schema definitions in `lib/db/schema.ts`.
3. Add handwritten fresh Neon SQL schema migration for the current Zenquanta product.
4. Add server-only Neon repositories in `lib/db/repositories/*` as the fresh database access layer.
5. Migrate the first low-risk runtime routes: settings, prompts, and assistant recommendation telemetry.
6. Migrate projects, conversations, messages, and conversation memory to Neon, including chat/image persistence saves and dashboard recent conversations.
7. Move usage, image history, manual plan requests, subscriptions, usage overrides, admin audit logs, dashboard data, admin routes, admin pages, pricing plan request flows, and profile/role hydration to fresh Neon repositories.
8. Replace Supabase Auth with fresh Neon credentials auth.
9. Replace Supabase Storage with neutral private file storage.
10. Add Neon-backed prompt workflows and lightweight workflow run tracking.
11. Add text model comparison records and candidate persistence.

Planned migration direction:

1. Start fresh in Neon. Do not import or backfill Supabase database or auth rows.
2. Use Supabase database/schema only as reference for product capabilities.
3. Continue migrating runtime routes to Neon through explicit, bounded milestones.
4. Use the neutral file storage layer for new uploads and generated images.
5. Do not import Supabase Auth users, sessions, or passwords.

Do not create Supabase-to-Neon copy/import migrations.

## Frontend Structure

The main workspace is composed from:

- `components/chat/chat-layout.tsx`
- `lib/chat-context.tsx`
- `components/chat/sidebar.tsx`
- `components/chat/header.tsx`
- `components/chat/chat-area.tsx`
- `components/chat/composer.tsx`
- `components/chat/message.tsx`
- `components/chat/settings-panel.tsx`
- `components/chat/settings-modal.tsx`

The auth gate is `components/auth/auth-gate.tsx`.

## Backend Structure

Backend logic is implemented with Next route handlers and server actions:

- route handlers under `app/api/*`
- server actions in `app/admin/actions.ts` and `app/pricing/actions.ts`
- Neon database foundation in `lib/db/client.ts` and `lib/db/schema.ts`
- Parallel Neon repositories in `lib/db/repositories/*`
- neutral file storage helpers in `lib/storage/object-store.ts`, `lib/storage/attachments.ts`, and `lib/storage/generated-images.ts`
- web search helpers in `lib/search/web-search.ts`
- historical Supabase migrations in `supabase/migrations/*`
- auth helpers in `lib/auth/session.ts`
- billing helpers in `lib/billing/*`

## Environment Variables

Required or expected variables:

- `OPENROUTER_API_KEY`
- `OPENROUTER_BASE_URL`
- `TAVILY_API_KEY`
- `OPENAI_API_KEY`
- `EMBEDDINGS_API_KEY`
- `EMBEDDINGS_BASE_URL`
- `EMBEDDINGS_MODEL`
- `DATABASE_URL`
- `FILE_STORAGE_PROVIDER`
- `FILE_STORAGE_BUCKET`
- `FILE_STORAGE_LOCAL_DIR`
- `FILE_STORAGE_ENDPOINT`
- `FILE_STORAGE_REGION`
- `FILE_STORAGE_ACCESS_KEY_ID`
- `FILE_STORAGE_SECRET_ACCESS_KEY`

Accepted aliases in code include:

- `NEON_DATABASE_URL`
- `POSTGRES_URL`

## Known Incomplete Systems

- No payment automation or automated subscription billing; manual plan requests and admin activation remain the intended flow.
- Pulse web search depends on `TAVILY_API_KEY`; without it, Pulse/webSearch degrades without claiming live verification.
- Uploaded-file knowledge depends on an embeddings key and the pgvector migration; unsupported/binary/PDF/OCR-heavy files are not indexed in v1.
- No automated test script is defined.
- Old Supabase-hosted files are intentionally not migrated into the new storage layer.

## Known Risks

- `npm run lint` now uses `eslint.config.mjs`; current lint status should be checked before releases because warnings may still exist.
- `npm run typecheck` runs `tsc --noEmit`.
- `npm run build` no longer ignores TypeScript build errors.
- Package manager is ambiguous: `pnpm-lock.yaml` exists, while `README.md` documents `npm install`.
- File storage access keys must remain server-only.
- Conversation saves currently delete and reinsert messages, which may be risky for large histories or concurrent writes.
- Neon starts fresh and does not preserve old Supabase rows.
- Settings, prompts, prompt workflows, text model comparisons, private custom text assistants, assistant recommendation telemetry, projects, conversations, messages, conversation memory, billing/admin data, usage records, plan requests, dashboard data, image history, and admin mutations are wired to Neon.
- Custom assistants are private text assistants only in v1; image/Prism custom assistants, public sharing, marketplaces, and arbitrary raw model selection are out of scope.
- S3-compatible/R2 storage configuration must be validated before production if local storage is not acceptable.
