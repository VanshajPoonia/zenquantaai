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

Neon is used for:

- projects
- conversations and messages
- prompt library
- user settings
- profiles and admin roles
- subscriptions and usage overrides
- text and image usage records
- plan requests and admin audit logs
- assistant recommendation telemetry

## Supabase Setup Requirements

Supabase is used for:

- Auth
- Storage

Expected private storage bucket:

- `zen-attachments`

Supabase has not been removed. It remains required for current local development because auth and private attachment storage still depend on it.

## Migration Order

Apply the Neon migration first:

1. `neon/migrations/20260522_zenquanta_neon_initial.sql`

Supabase Auth and Storage still require the Supabase setup. The older Supabase migrations remain as historical/setup context:

1. `supabase/migrations/20260401_zenquanta_projects_prompts.sql`
2. `supabase/migrations/20260401_zenquanta_conversation_memory.sql`
3. `supabase/migrations/20260401_zenquanta_billing_admin_platform.sql`
4. `supabase/migrations/20260401_zenquanta_assistant_recommendations.sql`

## Neon Migration Planning

Before changing persistence code again:

1. Inventory Supabase tables, policies, storage buckets, and auth identity assumptions.
2. Apply the Neon schema and migration path for database-backed records.
3. Keep Supabase Auth and Supabase Storage in place for the first database migration phase.
4. Map auth user IDs to Neon rows before moving conversations, admin data, usage records, plan requests, and subscriptions.
5. Verify each `lib/storage/*` module has a clear migration path.
6. Record separate decisions before replacing Supabase Auth or Supabase Storage.

## Local Verification Flow

1. Install dependencies.
2. Create `.env.local` from `.env.example`.
3. Fill OpenRouter, Neon, and Supabase values.
4. Apply the Neon migration and required Supabase Auth/Storage setup.
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
- Missing Neon `DATABASE_URL` breaks app data persistence.
- Missing Supabase env vars breaks auth and attachment storage.
- Missing Supabase secret/service key can break server-side storage access.
- Lint can fail because ESLint flat config is missing.
- TypeScript errors can be hidden by Next config.
- Package manager mismatch can cause lockfile churn.
- Pulse is branded for current-context work, but real web search/retrieval may not be implemented.
- Manual plan requests are not payment automation.
- Partial Neon migration can create mixed Supabase/Neon data sources if the data boundary is not planned first.
- Auth user ID mapping must be preserved when moving database rows to Neon.
- Supabase service-key assumptions may not apply after moving database access to Neon.
- Migration order and parity checks matter for admin data, usage records, subscriptions, plan requests, conversations, projects, prompts, and settings.
- Storage URLs and attachment records may still depend on Supabase Storage after database migration.
