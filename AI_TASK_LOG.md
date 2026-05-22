# AI Task Log

## Current Status

The repository contains a real Zenquanta AI platform backed by Supabase and OpenRouter. Shared AI project memory files have been planned for creation at the repo root.

## Completed Work

### 2026-05-22 - Shared AI Memory Files

- Created the shared AI memory system for coding agents.
- Documented that the app is a current six-assistant Zenquanta AI platform, not the old four-mode version.
- Preserved current repo facts: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui-style components, Supabase, OpenRouter, text chat via `/api/chat`, Prism image generation via `/api/images/generate`, admin/user dashboards, manual plan requests, usage tracking, conversation memory, file uploads, prompt precheck, assistant recommendations, and public assistant pages.
- Noted that Stripe automation is not implemented.
- Noted that Pulse has current-context branding, but real web search/retrieval is not confirmed.

## Current Work

- Documentation and workflow setup only.
- No app code, routes, APIs, auth, billing, storage, styling, or runtime behavior should be changed for this task.

## Proposed Next Work

- Add or fix ESLint 9 configuration.
- Add a `typecheck` script such as `tsc --noEmit`.
- Decide whether the repo should standardize on npm or pnpm.
- Remove or replace the hardcoded fallback admin identity before production.
- Either implement real web search/retrieval for Pulse or make the UI clear that `webSearch` is not active.

## Active Bugs / Issues

- `npm run lint` may fail because ESLint 9 expects `eslint.config.js`.
- TypeScript build errors may be hidden by `typescript.ignoreBuildErrors: true` in `next.config.mjs`.
- Package manager guidance is unclear because `pnpm-lock.yaml` exists while `README.md` says `npm install`.
- Generated image persistence should be reviewed.

## Architecture Concerns

- Text and image transports are intentionally separate and should remain separate.
- Supabase is the source of truth after sign-in.
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
- Missing ESLint 9 config.
- Hidden TypeScript build errors.
- Package manager ambiguity.
- Visible `webSearch` setting without confirmed retrieval implementation.
- No Stripe automation.

## AI Handoff Summaries

### 2026-05-22

Shared memory files were created to give Codex, Claude Code, and future agents a consistent understanding of the repo. Future agents should begin by reading `AGENTS.md`, `AI_PROJECT.md`, `AI_TASK_LOG.md`, `AI_DECISIONS.md`, and `AI_CHECKLIST.md`.

## Future Feature Ideas

- Real web search/retrieval for Pulse.
- Durable generated-image storage.
- Automated Stripe billing and webhooks.
- Automated test suite for auth, billing, routing, recommendations, and chat streaming.
- Safer incremental conversation persistence.

## Open Questions

- Should the package manager be standardized on pnpm or npm?
- Should `webSearch` be hidden until retrieval is implemented?
- Should generated images be uploaded into Supabase Storage like user attachments?
- Should admin role management become database-only with no hardcoded fallback?
