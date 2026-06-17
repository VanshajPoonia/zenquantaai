# Zenquanta AI — Developer Handoff

Single-file handoff for the next coding agent (ChatGPT/Codex). Read this first,
then the linked memory files, then start work.

## TL;DR

Zenquanta AI is a Next.js App Router AI workspace — the **six-assistant** product
(Nova, Velora, Axiom, Forge, Pulse, Prism), **not** the old four-mode app. Backed by
Neon Postgres, neutral private object storage, OpenRouter (AI), Tavily (Pulse
search), and OpenAI-compatible embeddings (file RAG). The platform is built and
running; current focus is **private beta readiness**.

## Ground rules (non-negotiable — from AGENTS.md/CLAUDE.md)

- Read `AGENTS.md` first and follow it exactly. It overrides default behavior.
- **Do not** add Supabase or Stripe. No payment automation, checkout, webhooks, or
  customer portal — plan upgrades are manual (user requests → admin activates).
- **Do not** import/backfill/preserve Supabase DB rows or storage objects. Neon is fresh.
- Keep secrets server-only. Secrets live in `.env.local` (gitignored). There is **no
  committed `.env.example`** — do not recreate it unless explicitly asked. Never paste
  real secret values into chats, docs, logs, or screenshots.
- Prefer targeted changes over broad refactors. Use `@/` imports. Keep TypeScript
  strict. Match existing dark Tailwind/shadcn styling.
- Text chat (`/api/chat`, NDJSON stream) and Prism image gen (`/api/images/generate`,
  JSON) are intentionally separate transports. Model routing lives in `lib/config/*`;
  orchestration in `lib/ai/*`; search in `lib/search/*`; RAG in `lib/rag/*`; DB in
  `lib/db/*`; storage in `lib/storage/*`; billing in `lib/billing/*`.

## Required reading (in order)

1. `AGENTS.md` — workflow, conventions, scope boundaries.
2. `AI_PROJECT.md` — capabilities, routes, services, env vars, known risks.
3. `AI_TASK_LOG.md` — **most recent entries (2026-06-17) are your starting point.**
4. `AI_DECISIONS.md` — decisions already made; don't relitigate.
5. `AI_CHECKLIST.md` — setup, verification, migrations, failure points.
6. `docs/BETA_LAUNCH_CHECKLIST.md` — the operational beta to-do list.

## Current state (as of 2026-06-17)

Recently shipped (see `AI_TASK_LOG.md`):

- **Production Environment Validator** — admin-only `/admin/system-health` page +
  `GET /api/admin/system-health`. Checks DB/connection/schema/pgvector, OpenRouter,
  Tavily, embeddings, storage provider + credentials, auth security, app URL, and
  deployment env. Never exposes secret values.
- **Shareable Prompt & Playbook Templates** — `/share/templates/[token]` public
  pages + copy-to-workspace. Backed by `zen_template_shares`.
- **Beta Launch Checklist & Bug Bash Plan** — `docs/BETA_LAUNCH_CHECKLIST.md`
  (20 sections incl. tester task script and a bug report template).

Core platform already implemented: ID/password auth (Neon), six assistants,
streamed chat, Prism images + Prism Studio, projects + Project Home, global/command-
palette search, Artifact Studio (+ AI actions, versions, shares), AI Playbooks
(prompt workflows), Model Duel, private custom text assistants, file uploads +
RAG (pgvector), Ask Files, GitHub read-only repo context, Memory Vault, user
dashboard, admin dashboard + cost/margin/product analytics, manual plan requests +
admin activation, usage/billing enforcement.

## Environment status (already provisioned by the operator)

- ✅ Neon Postgres database is running.
- ✅ All 19 migrations applied, including the three newest
  (`20260616_zenquanta_artifact_shares`, `20260616_zenquanta_feedback_events`,
  `20260617_zenquanta_template_shares`) — operator ran them on 2026-06-16/17.
- ✅ An admin user exists (admin role in `zen_profiles`).

> **Quick sanity check (optional):** open `/admin/system-health` and confirm the
> Database group is green (it checks for the `zen_artifact_shares` and
> `zen_template_shares` tables among others). If anything unexpectedly shows
> `missing`, apply the relevant file from `neon/migrations/` (19 total, listed in
> `docs/BETA_LAUNCH_CHECKLIST.md` §2). Otherwise the schema is ready — start coding.

## Open work (prioritized)

1. **Self-serve data deletion (highest value).** There is no account/data-deletion
   flow; `docs/BETA_LAUNCH_CHECKLIST.md` §19 is currently manual DB cleanup. Build a
   user-owned deletion path (and/or admin-triggered per-user purge) that removes a
   user's conversations/messages, projects, prompts, workflows + runs, custom
   assistants, artifacts (+ versions + shares), model comparisons, files (+
   `zen_file_chunks`), generated images, memory, usage records, plan requests,
   recommendation/feedback telemetry, sessions, integrations — **and** their objects
   in file storage. Confirm protected file/image URLs 404 afterward. Respect existing
   ownership checks and FK/cascade behavior in `lib/db/schema.ts`.
2. **Sync the migration list** in `AI_CHECKLIST.md` (Migration Order section) — it
   lists 16 files; disk has 19. Add `20260616_zenquanta_artifact_shares.sql`,
   `20260616_zenquanta_feedback_events.sql`, `20260617_zenquanta_template_shares.sql`.
3. **Draft the exact per-user cleanup query set** referenced in §19 (useful even
   after #1 ships, for support/edge cases).

Pick the task the operator points you at; default to #1 if unspecified.

## Definition of done

- `npm run typecheck` — clean.
- `npm run lint` — 0 new errors (≈10 pre-existing warnings are acceptable; don't add more).
- `npm run build` — succeeds (production build runs TS validation; keep it that way).
- New API routes are owner/admin-scoped with validated IDs; no secrets or raw model
  cost leak to clients.

## Handoff back (update shared memory when state changes)

- `AI_TASK_LOG.md` — what changed, what was verified, remaining risk, next steps.
- `AI_DECISIONS.md` — any architecture decision made/reversed.
- `AI_PROJECT.md` — new routes/capabilities/migrations/risks.
- `AI_CHECKLIST.md` — new setup/verification/migration/env steps.
- `README.md` — only if user-facing setup/product docs change.

## Package manager note

`pnpm-lock.yaml` and `pnpm-workspace.yaml` exist; `README.md` documents `npm install`.
Confirm npm vs pnpm before changing dependencies to avoid lockfile churn.
