# AI Task Log

## Current Status

The repository contains a real Zenquanta AI platform backed by Supabase for current app persistence/Auth/Storage, a Neon Postgres foundation for planned migration, and OpenRouter for AI transport. Shared AI project memory files exist at the repo root.

Current direction: plan upgrades remain manual/admin-driven, payment automation is out of scope unless explicitly requested, and Neon is foundation-only until a later explicit persistence migration.

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

- Initially added Neon database driver dependency and a storage-layer Neon helper.
- Added `neon/migrations/20260522_zenquanta_neon_initial.sql` for the `zen_*` application schema without Supabase RLS, `auth.uid()`, `auth.users` foreign keys, or Supabase Storage objects.
- Migrated the app data stores in `lib/storage/*` from Supabase REST calls to Neon SQL while preserving route/API contracts.
- Kept Supabase Auth and Supabase Storage in place for sessions and private attachment files.

### 2026-05-22 - Neon Foundation Boundary Correction

- Corrected the milestone back to foundation-only.
- Restored runtime `lib/storage/*` persistence stores to Supabase REST.
- Moved the Neon foundation to `lib/db/client.ts` and `lib/db/schema.ts`.
- Kept the Neon SQL schema migration and env documentation for later migration work.
- Confirmed Supabase remains current for runtime app persistence, Auth, and Storage.

### 2026-05-22 - Neon Repository Layer

- Added parallel server-only Neon repositories under `lib/db/repositories/*`.
- Covered profiles, subscriptions, usage, image generation events, plan requests, admin audit logs, projects, conversations/messages, prompts, settings, and assistant recommendation events.
- Kept routes, auth, billing, UI, file storage, and `lib/storage/*` runtime wiring on Supabase.
- Documented that repositories are migration targets only until routes are explicitly swapped.

## Current Work

- Neon database foundation is complete at the code/schema level.
- Parallel Neon repositories exist for later route-by-route migration.
- Runtime app persistence, Supabase Auth, and Supabase Storage remain active on Supabase.
- Local verification has run for TypeScript and production build; lint still needs ESLint flat config work.

## Proposed Next Work

- Add or fix ESLint flat configuration.
- Add a `typecheck` script such as `tsc --noEmit`.
- Decide whether the repo should standardize on npm or pnpm.
- Remove or replace the hardcoded fallback admin identity before production.
- Either implement real web search/retrieval for Pulse or make the UI clear that `webSearch` is not active.
- Apply and validate the Neon foundation migration in a real Neon database.
- Plan a later explicit store/API migration from Supabase REST to Neon repositories.
- Swap one feature area at a time from `lib/storage/*` to `lib/db/repositories/*`, verify behavior, then continue.
- Backfill existing Supabase Postgres data into Neon if preserving production data is required.
- Record separate decisions for auth and file storage before replacing Supabase Auth or Supabase Storage.

## Active Bugs / Issues

- `npm run lint` may fail because the repo is missing an ESLint flat config file.
- TypeScript build errors may be hidden by `typescript.ignoreBuildErrors: true` in `next.config.mjs`.
- Package manager guidance is unclear because `pnpm-lock.yaml` exists while `README.md` says `npm install`.
- Generated image persistence should be reviewed.

## Architecture Concerns

- Text and image transports are intentionally separate and should remain separate.
- Supabase remains the source of truth for app data, auth sessions, and private attachment storage.
- Neon Postgres is present as the planned database migration target, not current runtime persistence.
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
