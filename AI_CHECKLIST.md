# AI_CHECKLIST.md

Shared setup, verification, and debugging checklist for AI agents.

## Install Command

README says:

```bash
npm install
```

Note: `pnpm-lock.yaml` exists. Confirm package-manager preference before dependency or lockfile changes.

## Dev Server Command

```bash
npm run dev
```

Expected local URL from README:

```text
http://localhost:3000
```

## Build Command

```bash
npm run build
```

## Lint Command

```bash
npm run lint
```

Current observed result from initial audit: this failed because ESLint could not find `eslint.config.(js|mjs|cjs)`. Recheck after dependencies are installed before making a final lint/config diagnosis.

## Test Command

No test command is currently defined in `package.json`.

## Type-Check Command

No `type-check` script is currently defined in `package.json`.

README expects the manual command:

```bash
npx tsc --noEmit
```

Current known result from initial audit: this failed before dependencies were installed, with many missing module/type errors and some strictness errors to recheck after install.

## Env Setup

Create local env file:

```bash
cp .env.example .env.local
```

`.env.example` currently includes:

```env
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

Keep `.env.local` and secrets out of git.

## Database Commands

No package script for database migrations is currently defined.

README says to apply Supabase migrations in this order:

1. `20260401_zenquanta_projects_prompts.sql`
2. `20260401_zenquanta_conversation_memory.sql`
3. `20260401_zenquanta_billing_admin_platform.sql`
4. `20260401_zenquanta_assistant_recommendations.sql`

Unknown: whether a Supabase CLI workflow is intended.

