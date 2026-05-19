# AI_CHECKLIST.md

Shared setup, verification, and debugging checklist for AI agents.

## Install Command

Use pnpm for local setup and verification:

```bash
pnpm install --frozen-lockfile
```

Package-manager note: `pnpm-lock.yaml` exists, `package-lock.json` does not, and frozen install succeeded with pnpm. If pnpm tries to remove/recreate `node_modules` in a non-interactive shell, use:

```bash
CI=true pnpm install --frozen-lockfile
```

`pnpm-workspace.yaml` currently allows build scripts for `sharp` and `unrs-resolver`, which were approved during dependency setup.

## Dev Server Command

```bash
pnpm run dev
```

Expected local URL from README:

```text
http://localhost:3000
```

## Build Command

```bash
pnpm run build
```

Known environment note: `next/font` may need network access to fetch Google Fonts during production builds unless fonts are cached or changed to local fonts.

## Lint Command

```bash
pnpm run lint
```

Current result: ESLint runs with `eslint.config.mjs` and fails on existing React/Next lint findings. The missing-config failure from the initial audit has been resolved.

## Test Command

No test command is currently defined in `package.json`.

## Type-Check Command

No `type-check` script is currently defined in `package.json`.

Use the manual command:

```bash
pnpm exec tsc --noEmit
```

Current result: passes after dependency installation.

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

## Pre-Change Checklist

- Read `AGENTS.md`.
- Read `AI_PROJECT.md`.
- Read `AI_TASK_LOG.md`.
- Read `AI_DECISIONS.md`.
- Read `AI_CHECKLIST.md`.
- Check `git status --short --branch`.
- Inspect relevant files before editing.
- Confirm whether the task is docs-only, frontend, backend, database, or workflow.
- Avoid touching unrelated files.

## Post-Change Checklist

- Update `AI_TASK_LOG.md` after repo changes.
- Update `AI_DECISIONS.md` if architecture decisions changed.
- Update `AI_CHECKLIST.md` if commands, setup, dependencies, or workflow changed.
- Update `AI_PROJECT.md` if product scope, features, structure, or maturity changed.
- Run safe relevant checks where possible.
- Document failed commands honestly.
- Check `git status --short`.

## Pre-Commit Checklist

- Verify only intended files changed.
- Confirm no secrets were added.
- Confirm no unrelated formatting churn.
- Run relevant checks if dependencies and config allow.
- Include verification results in handoff notes.
- Make sure shared docs are updated when required.

## Debugging Workflow

1. Reproduce the issue with the smallest command or route possible.
2. Read the relevant route/component/store/config before changing code.
3. Check whether the issue is frontend state, API route behavior, storage, auth, billing, or provider transport.
4. Prefer narrow fixes with focused verification.
5. If provider or Supabase calls fail, verify env configuration before changing app logic.
6. If usage or billing behavior is involved, inspect `lib/billing/`, `lib/config/pricing.ts`, and relevant storage stores.
7. If chat behavior is involved, inspect `lib/chat-context.tsx`, `hooks/useSendMessage.ts`, `lib/ai/chat.ts`, and the relevant API route.

## Common Failure Points

- Dependencies not installed: `next` and React types are unavailable.
- Existing lint findings: `pnpm run lint` currently fails on React Compiler/hooks rules and Next image warnings.
- Build network dependency: `pnpm run build` needs access to Google Fonts unless font handling changes.
- Missing env values: Supabase/OpenRouter runtime calls will fail or fall back.
- OpenRouter key missing: mock AI fallback may be used.
- Supabase migrations not applied: storage/API routes may fail.
- Provider pricing estimates may be stale.

## What To Do When Commands Fail

- Capture the exact command and failure.
- Do not hide failures.
- Distinguish environment/setup failures from code failures.
- If dependencies are missing, use `pnpm install --frozen-lockfile`.
- If a command failure is unrelated to the current task, document it and continue only if safe.
- Update `AI_TASK_LOG.md` with verification results after changing files.

## Initial Verification Baseline

- `git status --short --branch`: clean `main...origin/main` before workflow docs.
- `test -d node_modules`: failed; dependencies were not installed.
- `npm run lint`: observed failure due to missing ESLint config; recheck after dependencies are installed before making a final lint/config diagnosis.
- `npm run build`: failed because `next` was not found.
- `npx tsc --noEmit`: failed with missing dependencies/types and additional strictness errors to recheck after install.

## Verification Baseline: 2026-05-20

- `pnpm install --frozen-lockfile`: succeeded after network approval and approved build scripts.
- `pnpm add -D eslint@^9.0.0 eslint-config-next@16.2.0`: added the minimal local lint dependencies needed for the declared `lint` script and Next flat config.
- `pnpm run lint`: runs ESLint, but fails on existing app lint findings: React hook `set-state-in-effect`, React Compiler memoization/purity rules, React hook dependency warning, and Next `<img>` warnings.
- `pnpm run build`: failed in the default sandbox because Next could not fetch Google Fonts; passed with network approval.
- `pnpm exec tsc --noEmit`: passed.
