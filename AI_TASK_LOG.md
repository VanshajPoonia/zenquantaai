# AI Task Log

## Current Status

The repository contains a real Zenquanta AI platform backed by Neon Postgres for app data, Supabase for Auth/Storage, and OpenRouter for AI transport. Shared AI project memory files exist at the repo root.

Current direction: plan upgrades remain manual/admin-driven, payment automation is out of scope unless explicitly requested, and database persistence has moved to Neon Postgres while Supabase Auth and Supabase Storage remain.

## Completed Work

### 2026-05-22 - Shared AI Memory Files

- Created the shared AI memory system for coding agents.
- Documented that the app is a current six-assistant Zenquanta AI platform, not the old four-mode version.
- Preserved current repo facts: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui-style components, Supabase, OpenRouter, text chat via `/api/chat`, Prism image generation via `/api/images/generate`, admin/user dashboards, manual plan requests, usage tracking, conversation memory, file uploads, prompt precheck, assistant recommendations, and public assistant pages.
- Noted that payment automation is not implemented and manual plan requests are the current upgrade path.
- Noted that Pulse has current-context branding, but real web search/retrieval is not confirmed.

### 2026-05-22 - Neon Direction And Manual Billing Scope

- Updated project direction to remove payment automation from the roadmap unless explicitly requested later.
- Kept manual plan requests and admin activation as the intended upgrade flow.
- Added phased Neon Postgres migration direction: migrate database persistence first while preserving Supabase Auth and Supabase Storage until separate decisions are made.
- Documented the pre-migration state: Supabase had not been removed and remained current for auth, Postgres data, storage, subscriptions, usage records, plan requests, and admin data at that point.

### 2026-05-22 - Neon Database Migration Implementation

- Added Neon database driver dependency and `lib/storage/neon.ts`.
- Added `neon/migrations/20260522_zenquanta_neon_initial.sql` for the `zen_*` application schema without Supabase RLS, `auth.uid()`, `auth.users` foreign keys, or Supabase Storage objects.
- Migrated the app data stores in `lib/storage/*` from Supabase REST calls to Neon SQL while preserving route/API contracts.
- Kept Supabase Auth and Supabase Storage in place for sessions and private attachment files.

## Current Work

- Neon database persistence implementation is complete at the code/schema level.
- Supabase Auth and Supabase Storage remain active.
- Local verification has run for TypeScript and production build; lint still needs ESLint flat config work.

## Proposed Next Work

- Add or fix ESLint flat configuration.
- Add a `typecheck` script such as `tsc --noEmit`.
- Decide whether the repo should standardize on npm or pnpm.
- Remove or replace the hardcoded fallback admin identity before production.
- Either implement real web search/retrieval for Pulse or make the UI clear that `webSearch` is not active.
- Apply and validate the Neon migration in a real Neon database.
- Backfill existing Supabase Postgres data into Neon if preserving production data is required.
- Record separate decisions for auth and file storage before replacing Supabase Auth or Supabase Storage.

## Active Bugs / Issues

- `npm run lint` may fail because the repo is missing an ESLint flat config file.
- TypeScript build errors may be hidden by `typescript.ignoreBuildErrors: true` in `next.config.mjs`.
- Package manager guidance is unclear because `pnpm-lock.yaml` exists while `README.md` says `npm install`.
- Generated image persistence should be reviewed.

## Architecture Concerns

- Text and image transports are intentionally separate and should remain separate.
- Neon Postgres is the source of truth for app data after sign-in.
- Supabase remains the source of truth for auth sessions and private attachment storage.
- OpenRouter is the only AI gateway.
- Billing is currently manual/admin-driven, not payment-provider-driven.
- Server-only secrets must remain out of client components.

## Testing Status

- No dedicated test script is defined in `package.json`.
- Current scripts are `dev`, `build`, `start`, and `lint`.
- Recommended typecheck command: `npx tsc --noEmit`.
- Lint setup needs attention before lint can be relied on.

## Known Risks

- Hardcoded fallback admin identity in `lib/storage/profiles.ts`.
- Missing ESLint flat config.
- Hidden TypeScript build errors.
- Package manager ambiguity.
- Visible `webSearch` setting without confirmed retrieval implementation.
- Payment automation is out of scope unless explicitly requested.
- Partial Neon migration still creates split-system risk because auth identity and storage references remain in Supabase.

## AI Handoff Summaries

### 2026-05-22

Shared memory files were created to give Codex, Claude Code, and future agents a consistent understanding of the repo. Future agents should begin by reading `AGENTS.md`, `AI_PROJECT.md`, `AI_TASK_LOG.md`, `AI_DECISIONS.md`, and `AI_CHECKLIST.md`.

## Future Feature Ideas

- Real web search/retrieval for Pulse.
- Durable generated-image storage.
- Automated test suite for auth, billing, routing, recommendations, and chat streaming.
- Safer incremental conversation persistence.
- Data migration tooling from Supabase Postgres exports into Neon.
- Auth and storage strategy decision after the database migration plan is clear.

## Open Questions

- Should the package manager be standardized on pnpm or npm?
- Should `webSearch` be hidden until retrieval is implemented?
- Should generated images be uploaded into Supabase Storage like user attachments?
- Should admin role management become database-only with no hardcoded fallback?
