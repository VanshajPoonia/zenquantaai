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

Current behavior:

- Next production build runs TypeScript validation. Keep it that way unless a future task explicitly accepts the risk.

## Lint

```bash
npm run lint
```

Known issue:

- Lint uses the root ESLint flat config. Existing warnings may still need cleanup in a focused lint-debt milestone.

## Typecheck

```bash
npm run typecheck
```

## Unit Tests

```bash
npm run test
```

Watch mode for local test iteration:

```bash
npm run test:watch
```

Current scope:

- Vitest unit tests cover pure TypeScript helpers only.
- Tests must not require OpenRouter, Tavily, Neon, S3/R2, GitHub, Supabase, Stripe, browser automation, paid services, or real server secrets.
- Keep route handlers, database repositories, object storage clients, and live AI/search integrations out of unit tests unless they are isolated with explicit mocks.

## E2E Smoke Tests

```bash
npm run test:e2e
```

Current scope:

- Playwright smoke tests cover service-free route and form rendering only.
- The v1 suite should not require OpenRouter, Tavily, Neon test data beyond protected redirects, S3/R2, GitHub, Supabase, Stripe, browser automation services, production credentials, or real secrets.
- Authenticated workspace E2E coverage such as command palette open and global search empty state requires a future seeded Neon test database/session plan. Do not weaken auth or hardcode credentials to make those tests pass.

If Playwright browser binaries are missing, install the Chromium browser dependency before running E2E locally:

```bash
npx playwright install chromium
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
- prompt workflows, ordered steps, and run/step-run metadata
- text model comparisons and generated candidates
- private custom text assistants and their builder metadata
- editable artifacts saved from workspace outputs
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
- `/api/prompt-workflows`
- `/api/prompt-workflows/[id]`
- `/api/prompt-workflows/[id]/runs`
- `/api/model-comparisons`
- `/api/model-comparisons/[id]/choose`
- `/api/custom-assistants`
- `/api/custom-assistants/[id]`
- `/api/custom-assistants/test`
- `/api/assistant-recommendations`
- `/api/projects`
- `/api/projects/[id]`
- `/api/projects/[id]/home`
- `/api/search`
- `/api/memory-vault`
- `/api/conversations/[id]/memory`
- `/api/artifacts`
- `/api/artifacts/[id]`
- `/api/artifacts/[id]/actions`
- `/api/onboarding`
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
5. `neon/migrations/20260522_zenquanta_prompt_workflows.sql`
6. `neon/migrations/20260522_zenquanta_model_comparisons.sql`
7. `neon/migrations/20260524_zenquanta_auth_attempts.sql`
8. `neon/migrations/20260525_zenquanta_custom_assistants.sql`
9. `neon/migrations/20260526_zenquanta_artifacts.sql`
10. `neon/migrations/20260528_zenquanta_playbook_builder_metadata.sql`
11. `neon/migrations/20260528_zenquanta_prism_studio_metadata.sql`
12. `neon/migrations/20260528_zenquanta_custom_assistant_builder_v2.sql`
13. `neon/migrations/20260528_zenquanta_github_readonly_integrations.sql`

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
4. If testing GitHub repo context, configure a GitHub App with read-only Metadata and Contents permissions and set `GITHUB_APP_ID`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_PRIVATE_KEY`, and `GITHUB_APP_CALLBACK_URL`.
5. Apply the fresh Neon migrations for database/auth flows.
6. Start dev server with `npm run dev`.
7. Sign up or sign in.
8. Send a text prompt and verify `/api/chat` streaming.
9. With `TAVILY_API_KEY` configured, send a Pulse or `webSearch` prompt and verify sources appear.
10. With an embeddings key configured, upload a text/code file and a text-based PDF, enable `fileContext`, and verify chat cites uploaded-file sources.
11. Open Ask Files, select one indexed file and then a concrete project scope, ask a question, and verify the request uses normal `/api/chat`, returns file source snippets only when RAG returns them, and does not expose private file URLs.
12. Open GitHub repo context from Command Palette or Project Home, connect a read-only installation, import selected README/package/source files into a project, then verify Ask Files and Forge fileContext can retrieve imported snippets without exposing GitHub tokens or provider URLs.
13. Open AI Playbooks, install a starter template only by user action, create/edit a playbook with category/output/suggested assistant fields, edit variable labels/defaults/required flags, preview expanded prompts, run at least two assistant-family steps, and verify run history records completed step outputs when message ids are available.
14. Open Project Home from the workspace project selector and verify user-scoped conversations, files, generated images, playbooks, memory status, GitHub repo context, and quick actions.
15. Use command palette search globally and with a selected Project Home scope, and verify project searches do not show other project data.
16. Save an assistant message and a model comparison candidate into Artifact Studio, edit it, move it to a project, export it, and verify project search/Project Home can find it.
17. Open Memory Vault from Settings, Command Palette, and Project Home; verify conversation summaries are user-scoped, copy works, clearing a summary does not delete messages, and per-conversation memory toggles persist.
18. Run an Artifact Studio AI action, review the preview, apply it to the draft, save explicitly, and confirm usage is logged without raw cost exposure.
19. Open Private Assistants, create/edit/duplicate/pin a text-only assistant, attach prompt-library shortcuts, run a test prompt, and verify the test consumes normal text usage without saving the draft assistant.
20. Run Model Duel, review candidates with and without Blind Mode, assign scoring labels, save one winner into the conversation, and verify Prism/image is not selectable.
21. Create/select a private custom text assistant and confirm it sends through normal `/api/chat` with usage limits intact.
22. Generate an image with Prism and verify `/api/images/generate`.
23. Open Prism Studio, verify protected gallery previews, project/search/date/favorite filters, favorite persistence, prompt copy/reuse/remix, Save prompt as Artifact, and explicit preview before four-image or Velora campaign actions.
24. Check `/dashboard` for usage.
25. If using admin flows, ensure the user has an admin role in `zen_profiles`.
26. Check `/admin` with current-month defaults and optional date range, plan, assistant, and user filters.
27. Confirm Admin Product Analytics shows activation funnel, feature adoption, file indexing outcomes, and operational signals without exposing raw cost outside admin pages/APIs.
28. Confirm admin raw-cost views do not change user-facing `/dashboard` displayed-cost responses.

## Production Safety Checks

- Keep the root ESLint flat config working.
- Run `npm run typecheck`.
- Keep `next.config.mjs` from ignoring TypeScript build errors.
- Confirm file storage credentials are server-only.
- Confirm `OPENROUTER_API_KEY` is server-only.
- Confirm `TAVILY_API_KEY` is server-only.
- Confirm `OPENAI_API_KEY` or `EMBEDDINGS_API_KEY` is server-only.
- Confirm generated images are stored durably if required.
- Confirm Neon auth-attempt limiting is applied before relying on production ID/password sign-in.
- Confirm pgvector is available in Neon before enabling uploaded-file knowledge.
- Confirm File Intelligence Cards expose only protected file URLs, show `knowledgeBase` status honestly, and do not claim retrieval for skipped/unsupported/pending files.
- Confirm text-based PDFs index through server-side extraction and image-only/scanned PDFs show a skipped/no-OCR status.
- Confirm Ask Files opens only in the authenticated workspace, uses `/api/chat` with `fileContext`, and stays disabled or explicit when embeddings/pgvector/indexed chunks are unavailable.
- Confirm GitHub App credentials remain server-only, installation tokens are never returned to clients, and the GitHub App permissions are read-only Metadata/Contents.
- Confirm GitHub imports are explicit foreground actions, skip unsafe/oversized/binary/secrets-like files, and create only user-owned project-scoped `zen_files`/`zen_file_chunks` records.
- Confirm Pulse/webSearch source display and no-key degradation before presenting live retrieval in production.
- Confirm failed Prism metadata rows are safe for admin analytics: no raw object URLs, bucket credentials, or provider secrets.
- Confirm Pulse Research Room shows only owned message sources/artifacts and stays honest when Tavily is unavailable or no source-backed messages exist.
- Do not claim automated payments, checkout, customer portal, webhooks, or subscription automation. Manual plan requests and admin activation are the intended flow unless explicitly changed later.
- Confirm raw model cost remains admin-only and user dashboards expose displayed usage only.

## Common Failure Points

- Missing OpenRouter key causes fallback/mock text and image behavior.
- Missing Tavily key causes Pulse/webSearch to answer without live source context and without source claims.
- Pulse Research Room uses persisted message `sources` and Pulse artifacts; if no source-backed messages exist, it should show empty states rather than live/source claims.
- Missing embeddings key skips uploaded-file indexing/retrieval without blocking uploads.
- File Intelligence re-index requires embeddings config and the stored private object; without either, it should fail clearly without exposing storage internals.
- Ask Files depends on already indexed files and the existing file RAG path; missing embeddings, missing pgvector, unsupported files, or project scopes with no indexed files should produce honest empty states rather than retrieval claims.
- Missing pgvector extension or file knowledge migration breaks chunk storage and retrieval.
- Text-based PDF extraction depends on embedded selectable text; scanned/image-only PDFs require future OCR and should not be represented as indexed.
- Missing prompt workflow or playbook builder metadata migrations break AI Playbook CRUD, structured builder fields, and run tracking, while one-off prompts still use `zen_prompt_library`.
- Missing model comparison migration breaks Model Duel, while normal chat remains separate.
- Missing artifacts migration breaks Artifact Studio, artifact search results, and Project Home artifact summaries.
- Missing Prism Studio metadata migration breaks generated-image project/favorite filters, while normal Prism generation can still run.
- Missing GitHub integration migration breaks `/api/integrations/github/*`, Project Home GitHub summaries, and repo-context imports, while ordinary uploads/Ask Files remain separate.
- Missing GitHub App env vars disables the GitHub repo context connection flow; the UI should show configuration-required state instead of claiming integration availability.
- Memory Vault uses existing conversation memory fields; if conversations are absent or summaries have not been generated, the vault should show empty states rather than inventing memory.
- Missing Neon `DATABASE_URL` breaks auth, settings, prompt library, assistant recommendation, project, conversation, chat persistence, image persistence, billing/admin, usage, dashboard, plan request, image history, profile/role hydration, and local import app-data paths.
- Missing S3-compatible/R2 env vars breaks attachment and generated-image storage when `FILE_STORAGE_PROVIDER` is `s3` or `r2`.
- Existing lint warnings can obscure newer warnings if not cleaned up intentionally.
- TypeScript errors should fail both `npm run typecheck` and `npm run build`.
- Package manager mismatch can cause lockfile churn.
- Tavily request failures should degrade without claiming live verification.
- OCR, scanned/image-only PDF extraction, and PDF layout reconstruction are not implemented in uploaded-file knowledge v1.
- Manual plan requests are not payment automation.
- Admin margin analytics are operational estimates from stored usage and active plan prices, not payment-provider revenue.
- Partial Neon route migration can create mixed Supabase/Neon data sources if the data boundary is not planned first.
- Supabase Auth users, sessions, and passwords are intentionally not copied into Neon.
- Fresh schema parity checks matter for admin data, usage records, subscriptions, plan requests, conversations, projects, prompts, and settings.
- Old Supabase Storage URLs and objects are intentionally not migrated into the new storage layer.
- Neon repositories are active for settings, prompt library, assistant recommendation telemetry, projects, conversations, messages, conversation memory, subscriptions/manual plans, usage records, plan requests, dashboard data, image history, admin data, and profile/role hydration.
