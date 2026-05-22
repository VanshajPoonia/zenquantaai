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

- Lint may fail because ESLint 9 expects an `eslint.config.js` file.

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
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

Accepted aliases in code include:

- `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Supabase Setup Requirements

Supabase is used for:

- Auth
- Postgres data
- Storage
- subscriptions
- usage records
- plan requests
- admin data
- assistant recommendation telemetry

Expected private storage bucket:

- `zen-attachments`

## Migration Order

Apply migrations in this order:

1. `supabase/migrations/20260401_zenquanta_projects_prompts.sql`
2. `supabase/migrations/20260401_zenquanta_conversation_memory.sql`
3. `supabase/migrations/20260401_zenquanta_billing_admin_platform.sql`
4. `supabase/migrations/20260401_zenquanta_assistant_recommendations.sql`

## Local Verification Flow

1. Install dependencies.
2. Create `.env.local` from `.env.example`.
3. Fill OpenRouter and Supabase values.
4. Apply Supabase migrations in order.
5. Start dev server with `npm run dev`.
6. Sign up or sign in.
7. Send a text prompt and verify `/api/chat` streaming.
8. Generate an image with Prism and verify `/api/images/generate`.
9. Check `/dashboard` for usage.
10. If using admin flows, ensure the user has an admin role in `zen_profiles`.

## Production Safety Checks

- Review or remove the hardcoded fallback admin identity in `lib/storage/profiles.ts`.
- Add a working ESLint 9 config.
- Add and run a real typecheck command.
- Consider disabling `typescript.ignoreBuildErrors`.
- Confirm Supabase service-role secrets are server-only.
- Confirm `OPENROUTER_API_KEY` is server-only.
- Confirm generated images are stored durably if required.
- Confirm `webSearch` is implemented before presenting it as a real retrieval feature.
- Add Stripe or another payment integration before claiming automated subscriptions.

## Common Failure Points

- Missing OpenRouter key causes fallback/mock text and image behavior.
- Missing Supabase env vars breaks auth and persistence.
- Missing Supabase secret/service key can break server-side storage and REST access.
- Lint can fail because ESLint 9 config is missing.
- TypeScript errors can be hidden by Next config.
- Package manager mismatch can cause lockfile churn.
- Pulse is branded for current-context work, but real web search/retrieval may not be implemented.
- Manual plan requests are not payment automation.
