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
DATABASE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

Accepted aliases in code include:

- `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEON_DATABASE_URL`
- `POSTGRES_URL`

`DATABASE_URL` is preferred for Neon. `NEON_DATABASE_URL` and `POSTGRES_URL` are accepted aliases in code.

## Neon Setup Requirements

Neon currently provides a server-only client, Drizzle schema definitions, a server-only repository layer, a handwritten fresh baseline migration, and migrated runtime database slices. The fresh schema and repository layer cover:

- app-owned users and auth identity placeholders
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

Repository rule:

- User-owned Neon writes should ensure a fresh `zen_users` anchor exists before inserting dependent records.

Current Neon-backed runtime routes:

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

## Supabase Setup Requirements

Supabase is currently used for:

- Auth
- Storage

Expected private storage bucket:

- `zen-attachments`

Supabase has not been removed. It remains required for current local development because Auth and private attachment storage still depend on it.

## Migration Order

Fresh foundation migration available for Neon:

1. `neon/migrations/20260522_zenquanta_fresh_initial.sql`

Apply with a Postgres client or Neon SQL editor. CLI example:

```bash
psql "$DATABASE_URL" -f neon/migrations/20260522_zenquanta_fresh_initial.sql
```

Supabase remains the current runtime setup for Auth and private attachment Storage. Apply Supabase migrations only when needed for those local runtime behaviors or historical reference:

1. `supabase/migrations/20260401_zenquanta_projects_prompts.sql`
2. `supabase/migrations/20260401_zenquanta_conversation_memory.sql`
3. `supabase/migrations/20260401_zenquanta_billing_admin_platform.sql`
4. `supabase/migrations/20260401_zenquanta_assistant_recommendations.sql`

## Fresh Neon Planning

Before changing persistence code again:

1. Apply or validate the fresh Neon schema separately from current runtime flows.
2. Do not import, copy, backfill, or preserve Supabase database rows.
3. Treat Supabase migrations as product/runtime reference only, not Neon prerequisites.
4. Keep Supabase Auth and Storage in place during database route migrations.
5. Verify each remaining `lib/storage/*` dependency has a clear fresh-Neon repository path before changing imports.
6. Swap one feature area at a time only in explicit milestones.
7. Record separate decisions before replacing Supabase Auth or Supabase Storage.
8. Do not wire additional routes to Neon repositories until the target environment has the fresh Neon migration applied.

## Local Verification Flow

1. Install dependencies.
2. Create `.env.local` from `.env.example`.
3. Fill OpenRouter, Neon, and Supabase values.
4. Apply required Supabase setup for Auth/Storage and apply the fresh Neon migration for migrated database flows.
5. Start dev server with `npm run dev`.
6. Sign up or sign in.
7. Send a text prompt and verify `/api/chat` streaming.
8. Generate an image with Prism and verify `/api/images/generate`.
9. Check `/dashboard` for usage.
10. If using admin flows, ensure the user has an admin role in `zen_profiles`.

## Production Safety Checks

- Review or remove the hardcoded fallback admin identity in `lib/storage/profiles.ts`.
- Add a working ESLint flat config.
- Add and run a real typecheck command.
- Consider disabling `typescript.ignoreBuildErrors`.
- Confirm Supabase service-role secrets are server-only.
- Confirm `OPENROUTER_API_KEY` is server-only.
- Confirm generated images are stored durably if required.
- Confirm `webSearch` is implemented before presenting it as a real retrieval feature.
- Do not claim automated payments, checkout, customer portal, webhooks, or subscription automation. Manual plan requests and admin activation are the intended flow unless explicitly changed later.

## Common Failure Points

- Missing OpenRouter key causes fallback/mock text and image behavior.
- Missing Neon `DATABASE_URL` breaks the Neon-backed settings, prompt library, assistant recommendation, project, conversation, chat persistence, image persistence, billing/admin, usage, dashboard, plan request, image history, profile/role hydration, and local import app-data paths.
- Missing Supabase env vars breaks auth and attachment storage.
- Missing Supabase secret/service key can break server-side storage access.
- Lint can fail because ESLint flat config is missing.
- TypeScript errors can be hidden by Next config.
- Package manager mismatch can cause lockfile churn.
- Pulse is branded for current-context work, but real web search/retrieval may not be implemented.
- Manual plan requests are not payment automation.
- Partial Neon route migration can create mixed Supabase/Neon data sources if the data boundary is not planned first.
- Auth user ID mapping must be designed before future route migrations, but Supabase database rows must not be copied into Neon.
- Supabase service-key assumptions may not apply after moving database access to Neon.
- Fresh schema parity checks matter for admin data, usage records, subscriptions, plan requests, conversations, projects, prompts, and settings.
- Storage URLs and attachment records may still depend on Supabase Storage after database migration.
- Neon repositories are active for settings, prompt library, assistant recommendation telemetry, projects, conversations, messages, conversation memory, subscriptions/manual plans, usage records, plan requests, dashboard data, image history, admin data, and profile/role hydration.
