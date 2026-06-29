# AI Task Log

## Current Status

The repository contains a real Zenquanta AI platform backed by Neon for runtime app data and credentials auth, neutral private file storage for new uploads/generated images, and OpenRouter for AI transport. Shared AI project memory files exist at the repo root. The workspace now includes Neon-backed global search through `/api/search`, a Cmd/Ctrl+K command palette, first-run onboarding through `/api/onboarding`, Artifact Studio through `/api/artifacts` (with shareable links via `/share/artifacts/[token]`), Prism Studio through `/api/images/history`, Pulse Research Room through `/api/pulse/research-room`, File Intelligence Cards through `/api/files`, Ask Files through the existing `/api/chat` file-context path, GitHub read-only repo context through `/api/integrations/github/*`, and a Memory Vault for visible conversation memory controls. The prompt library includes reusable Neon-backed prompt workflows (with shareable links via `/share/templates/[token]`), the composer includes Model Duel for text assistant comparisons, and the admin dashboard includes filtered cost/margin analytics.

Current direction: plan upgrades remain manual/admin-driven, payment automation is out of scope unless explicitly requested, and Neon/storage start fresh without importing Supabase database rows or storage objects.

## 2026-06-29 - Private Beta Preflight Audit

**Goal**: Explicit user request to run the full private-beta preflight audit against the 20-point checklist in `docs/BETA_LAUNCH_CHECKLIST.md`, verify readiness, and fix only targeted beta-blocking issues — no new features.

**Green checks (verified live against a local dev server + disposable QA accounts, not just code review)**:
- `/admin/system-health`, `/admin`, `/admin/users/[id]` all gated correctly: pages redirect via `requireAdmin()`, APIs return 401/403 via `requireAdminApiUser()`/`requireAuthenticatedUser()`, confirmed live with curl (307/401 for unauthenticated, 403 pattern verified in code for non-admin).
- Required env var names in `AI_PROJECT.md`/`docs/BETA_LAUNCH_CHECKLIST.md` match `.env.local` keys with no real values present in any doc; `.env.local` is gitignored and untracked.
- `neon/migrations/` contains exactly the 19 files in the order documented in `AI_CHECKLIST.md` and `docs/BETA_LAUNCH_CHECKLIST.md` §2 — confirmed by directory listing, not just doc cross-reference.
- Sign up, sign in, sign out, and invalid-password rejection all verified live via real `/api/auth/*` calls with a disposable account: sign-up creates a session, sign-out clears it server-side (subsequent `/api/auth/session` returns 401), wrong password returns a safe generic error with no field-level leak, rate limiting is enforced through `zen_auth_attempts` before sign-in.
- All five text assistants verified live end-to-end through `/api/chat`: Nova/Velora/Axiom/Forge returned correctly attributed, billed responses. Pulse was broken until the fix below; after the fix it streams correctly and shows the honest "no source context available" degradation note since no `TAVILY_API_KEY` is configured locally — confirms the no-key degradation path works.
- `/api/chat` rejects image/Prism requests with a 400 pointing to `/api/images/generate`; image generation through `/api/images/generate` was verified live (real OpenRouter image call, metadata persisted, protected preview URL returned).
- Protected file route `/api/files/object` verified live: 401 unauthenticated, 200 for the owning user, 404 for a second authenticated user attempting the same URL — cross-user image/file access is blocked.
- RAG/Ask Files honesty, search user-scoping, artifacts/versions/shares/template-share token safety, playbook step billing, Model Duel text-only enforcement, Prism Studio ownership, plan-request/admin-activation flow, and dashboard cost-boundary (raw cost/margin admin-only) were all code-audited in depth (file:line evidence) with no beta-blocking issues found. No Stripe/checkout/payment-webhook code exists anywhere in the repo.
- Self-serve/admin purge code (ownership derivation, self-purge blocking, tombstoning, safe grouped previews) matches `AI_TASK_LOG.md`'s 2026-06-20 entry with no regressions — but see the migration-gap blocker below, found only by actually invoking the route.
- `npm run typecheck`, `npm run lint` (0 errors, same 10 pre-existing warnings), `npm run test` (20 files, 88 tests), `npm run build` (all routes compile), and `npx playwright test` (12 passed, 1 intentionally skipped pending a dedicated Neon branch) all pass after the fixes below.
- Mobile (375px): `/pricing`, an assistant page (`/nova`), the unauthenticated auth gate, and the authenticated chat workspace all render with zero horizontal overflow and no console errors. `/dashboard` had a real overflow bug, fixed below. `/admin/system-health` could not be exercised live (no admin credentials available without guessing a real local admin's password) — its layout was code-audited and looks low-risk, but is unverified live; flagged below.

**Blockers fixed**:
1. **Pulse was broken for every free/basic-tier user.** `lib/config/assistants.ts` mapped free/basic tier `pulse` to `x-ai/grok-4.1-fast`, which OpenRouter now reports as deprecated, causing every Pulse send to fail mid-stream with a recoverable-but-real error. Pro/ultra/prime tiers already used the working `x-ai/grok-4.20`. Fixed by pointing free/basic at `x-ai/grok-4.20` (cost entry already existed in `lib/config/pricing.ts`, so no pricing gap). Verified live: Pulse now streams a full response, with the honest no-Tavily-key degradation note still present.
2. **`/dashboard` had a real horizontal-overflow bug at mobile width.** The "Recent conversations" and "Recent image generations" cards (`app/dashboard/page.tsx`) used `truncate` on a flex child without `min-w-0`, and the surrounding CSS Grid items also lacked `min-w-0` — both flex and grid items default to `min-width: auto`, so the long un-wrapped title text expanded its container instead of truncating. Verified via Playwright DOM inspection (found exact offending elements, not just a visual glance), confirmed `scrollWidth` dropped from 544px to exactly 375px after the fix, full-page screenshot confirms clean rendering.
3. **Password reset had no working admin-assisted path.** `/api/auth/password/reset-request` correctly tells the user reset is admin-assisted, but there was no admin-side tool anywhere to actually act on that — `/admin/users/[id]` had no password control. Per explicit user decision (not a unilateral feature add), added a minimal, scoped admin capability: a new `POST /api/admin/users/[id]/password` route (`requireAdminApiUser`-gated, 8-character minimum, reuses the existing scrypt hashing path via a new `setUserPasswordByAdmin()` in `lib/auth/session.ts`, revokes all of the target user's existing sessions via a new `revokeAllSessions()`, and writes an `admin_user_password_reset` audit log entry) plus a `UserPasswordResetCard` client component wired into `/admin/users/[id]`. No email provider or token table was introduced — this stays within the existing architecture. Verified live end-to-end with disposable QA accounts: a promoted QA admin reset a second QA user's password; the target's prior session immediately returned 401, the old password was rejected, the new password worked, a non-admin caller got 403, an unauthenticated caller got 401, and a sub-8-character password got 400.
4. **This local dev Neon database was missing the `zen_feedback_events` table** (migration #17, `neon/migrations/20260616_zenquanta_feedback_events.sql`), discovered by actually invoking `/api/account/delete-data` and hitting a 500 (`relation "public.zen_feedback_events" does not exist` inside `NeonUserPurgeRepository.preview`, `lib/db/repositories/user-purge.ts:97`). The code was correct — this was a migration-application gap in this one local database, not a bug. Per explicit user decision, applied migrations #17 and #18 (`20260616_zenquanta_incremental_performance_indexes.sql`, additive indexes only) directly to the local `DATABASE_URL` via `psql`; confirmed both via `information_schema` before/after and a successful live `/api/account/delete-data` call afterward. **This only fixes this local dev database** — confirm all 19 migrations are applied to whichever Neon database actually backs the beta before relying on deletion/purge there.

5. **`/admin/system-health`'s header used a layout pattern inconsistent with the rest of the app and risked clipping/awkward stacking at mobile width** (`flex items-center justify-between` with no mobile breakpoint, plus a right-aligned `items-end` block that would sit oddly under left-aligned text once stacked) — the same anti-pattern already fixed on `/dashboard` earlier in this audit. Fixed to `flex flex-col gap-4 ... sm:flex-row sm:items-center sm:justify-between`, matching the established header pattern used on `/dashboard` and `/admin/users/[id]`. Verified live at 375px: promoted a fresh disposable QA account to admin via a direct, scoped DB role update (not by guessing the real local admin's password), confirmed zero horizontal overflow and a clean stacked layout via screenshot, then deleted the QA account through self-serve deletion afterward.

**Known limitations / informational**:
- `docs/manual-product-smoke-test.md`'s "Password reset route behavior" section and `docs/BETA_LAUNCH_CHECKLIST.md` §16 were updated to describe the real admin-assisted flow (no self-serve email/token reset exists) instead of describing token states that were never backed by working code.
- All five disposable QA accounts created during this audit (two for general flow verification, two for the admin password-reset test, one for the system-health mobile check) were cleaned up via the app's own self-serve full-account deletion — none remain in the local database.
- Pre-existing, unchanged-by-this-audit: the destructive purge Playwright E2E test remains intentionally skipped pending a dedicated empty/schema-only Neon branch (per the 2026-06-20 entry); Tavily-with-key and GitHub integration paths could not be exercised locally (no `TAVILY_API_KEY`/GitHub App configured in this environment) — both degrade honestly without a key, which was verified.

**Files changed**:
- `lib/config/assistants.ts` — free/basic tier `pulse` model id `x-ai/grok-4.1-fast` → `x-ai/grok-4.20`.
- `app/dashboard/page.tsx` — added `min-w-0` to the "Recent conversations"/"Recent image generations" grid-item Cards and their truncated title `<p>` elements, and `shrink-0` to their adjacent badges, fixing real mobile horizontal overflow.
- `lib/auth/session.ts` — added `setUserPasswordByAdmin()` and `revokeAllSessions()`.
- `app/api/admin/users/[id]/password/route.ts` — new admin-only password-reset route.
- `components/admin/user-password-reset-card.tsx` — new admin UI card.
- `app/admin/users/[id]/page.tsx` — wired in the new card.
- `docs/BETA_LAUNCH_CHECKLIST.md`, `docs/manual-product-smoke-test.md` — corrected password-reset expectations to match real behavior.
- `app/admin/system-health/page.tsx` — mobile-responsive header (`flex-col` + `sm:flex-row`), matching the pattern already used on `/dashboard` and `/admin/users/[id]`.
- Local-database-only (not a code change): applied `neon/migrations/20260616_zenquanta_feedback_events.sql` and `20260616_zenquanta_incremental_performance_indexes.sql` to the local dev `DATABASE_URL`.

**Beta readiness recommendation**: **Ready, pending one environment check.** Core product surfaces (auth including admin-assisted password reset, all five text assistants, Prism, file/search/artifact/playbook ownership boundaries, billing/cost boundaries, admin gating, self-serve/admin deletion) are solid and verified live end-to-end, not just by inspection, and all real issues found (deprecated Pulse model, dashboard mobile overflow, system-health mobile layout) are fixed and verified, including on a real mobile viewport with an authenticated admin session. The only remaining action item is operational, not code: confirm all 19 migrations are actually applied to whichever Neon database backs the beta — this audit caught a real missing-table gap in the local dev DB by exercising the deletion path live rather than trusting documentation, and that database's gap has only been fixed for the local environment, not necessarily the beta one.

## 2026-06-29 - UI/Flow Redesign and Mobile Responsiveness Pass

**Goal**: Explicit user request to improve the app's UI/flow and make it mobile-friendly, using the `frontend-design` skill plus three fetched design references (`DESIGN.md` = runwayml, `together.ai/DESIGN.md`, `x.ai/DESIGN.md`) combined into one direction. This overrides the default "preserve current styling" rule in `AGENTS.md` for this task only.

**Direction**: Kept the existing dark oklch token system, Geist/Geist Mono fonts, and the six per-assistant accent colors (signature device, not replaced). Added: a shared `.eyebrow` utility (uppercase Geist Mono label) in `app/globals.css`, a `cta` pill button variant and `eyebrow` badge variant in `components/ui/button.tsx`/`badge.tsx`. Removed dead `.glow-*` CSS (the real glow mechanism is `getModeGlow()` in `lib/mode-utils.tsx`, which never referenced those classes).

**Mobile fixes (the actual product surface)**:
- `components/chat/sidebar.tsx` + `chat-layout.tsx`: sidebar now renders as a `Sheet` overlay with backdrop below 768px instead of pushing/crushing the chat column; defaults closed on phones on first mount; auto-closes on navigation actions.
- `components/chat/settings-panel.tsx`: was a hardcoded `w-80` `<aside>` with no responsive handling (would overflow on phones) — now a full-screen overlay below `md`, unchanged above it.
- Audited `artifact-studio.tsx`, `playbook-studio.tsx`, `memory-vault.tsx`, `prism-studio.tsx`, `pulse-research-room.tsx`, `ask-files-panel.tsx`, `github-integration-panel.tsx` — all are Radix `Dialog`-based and already mobile-safe (`w-[calc(100vw-1rem)]` or base responsive max-width); no changes needed.
- `components/chat/header.tsx`: added a mobile-only overflow menu folding help/session-settings/share/admin behind one trigger.
- `components/chat/composer.tsx`: send/stop buttons bumped from `h-9` to `h-10` for touch target; safe-area bottom padding was already present.
- Found and fixed a pre-existing bug while testing: a floating absolutely-positioned "reopen sidebar" button in `chat-layout.tsx` exactly overlapped the header's own identical hamburger button (both called `toggleSidebar`), making the header's button dead/unreachable. Removed the redundant floating one.

**Visual redesign**: `components/assistants/assistant-brand-page.tsx` (replaced repeated `rounded-3xl` card grid with eyebrow+display-headline hero and hairline-divided rows), `components/auth/auth-gate.tsx` (pill sign-in/sign-up toggle, mono eyebrow labels, fixed `h-screen items-center` → `min-h-screen` + scroll so the form doesn't clip on short mobile viewports with the keyboard open), `app/pricing/page.tsx` (plan cards → hairline-divided slab, pill CTAs).

**Verification**: `npm run typecheck`, `npm run lint` (same 10 pre-existing warnings, 0 errors), and `npm run build` all passed after every phase. Manually drove the app with Playwright + chromium at 375px/1280px: public assistant page and auth gate screenshots confirmed the new visual language; signed in with a temporary test account (`verifybot1782673032859` — not yet cleaned up, safe to purge) and confirmed the sidebar opens as a true overlay (not a push panel) on mobile, closes on backdrop click, and the settings panel renders as a usable full-screen overlay instead of the old crushed `w-80` panel.

**Not changed**: Admin pages, dashboard data views, knowledge library internals, and all API/billing/auth logic — visual-only pass, per the user-approved plan.

---

## 2026-06-20 - Self-Serve Data Deletion Verification

**Goal**: Audit the existing self-serve/admin purge implementation, add focused security and orchestration coverage, and run destructive end-to-end verification only against an explicitly approved dedicated Neon branch and non-production storage namespace.

**Audit result**: The existing purge repository covers all current user-owned product tables directly or through verified foreign-key cascades. Self-service routes derive their target only from the authenticated session; admin routes re-check the admin role in the handler, block self-purge, and use the protected path target. Full-account deletion removes auth access and tombstones identity rows. Object refs are collected before the database transaction, and protected reads depend on metadata that the transaction removes before best-effort object cleanup.

**Implemented**:
- Expanded purge helper tests for confirmation edge cases, invalid scopes, normalized counts, exact preview keys, unsafe/deduplicated object refs, and tombstone fields.
- Hardened preview sanitization so case/underscore variants and token/secret/password/private-provider URL fields cannot survive future sanitizer callers.
- Added service tests proving ref collection precedes the database transaction, object deletion follows it, invalid confirmation performs no deletion, and partial provider failures return counts without leaking the caught error.
- Added route tests proving guessed body IDs cannot change self-service scope, full-account responses clear cookies, non-admin access is rejected, admin self-purge is blocked, and admin audit payloads remain grouped/safe.
- Added a guarded Playwright fixture that creates disposable accounts through real auth routes, seeds all current purge categories, uploads real local neutral-storage objects, and verifies workspace deletion, full-account sign-out/tombstoning, admin purge, protected 404s, object removal, safe responses/audits, and an unaffected control user.
- Updated `AI_CHECKLIST.md`, `docs/BETA_LAUNCH_CHECKLIST.md`, `docs/HANDOFF.md`, and `tests/e2e/README.md` with the repeatable safety-gated workflow and current verification boundary.

**Verification**:
- Focused purge tests passed: 3 files, 15 tests.
- `npm run test` passed: 20 files, 88 tests.
- `npm run typecheck` passed.
- `npm run lint` passed with the same 10 existing warnings and 0 errors.
- `npm run build` passed and lists all four purge routes as dynamic handlers.
- `git diff --check` plus explicit checks for the three new untracked test files passed.
- `npm run test:e2e -- user-purge.spec.ts` started the app and safely skipped the destructive test because the dedicated opt-in/database variables were absent.
- Browser fallback: the `agent-browser` CLI was unavailable. The existing Playwright smoke suite loaded all six public assistant pages, while six unauthenticated workspace/auth-gate checks timed out at `Restoring your Zenquanta workspace…`; this is outside the purge code path and remains a separate environment/runtime risk.

**Remaining risks**: Seeded Neon/object deletion, protected 404s, actual sign-out, and real admin purge are not yet runtime-proven because no dedicated empty/schema-only branch was supplied. The harness currently forces local neutral storage under `/tmp`; if beta uses S3/R2, repeat object cleanup against a non-production bucket. Do not mark `docs/BETA_LAUNCH_CHECKLIST.md` §19 complete until that run passes.

**Not changed**: No public route shape, tombstone decision, schema/migration, dependency, Supabase, Stripe, payment automation, or unrelated `pnpm-workspace.yaml` change was introduced.

---

## 2026-06-17 - Manual Per-User Cleanup SQL Support Guide

**Goal**: Replace vague beta manual cleanup fallback notes with an operator-safe SQL guide for one-user cleanup when self-serve/admin purge fails or needs manual follow-up.

**Files changed**:
- `docs/support/per-user-cleanup-sql.md` — New support guide covering warnings, target verification, object-ref export, dry-run counts, workspace-data cleanup SQL, full-account tombstone cleanup SQL, cascade notes, object-storage cleanup, verification queries, protected URL checks, and safe audit/support logging.
- `docs/BETA_LAUNCH_CHECKLIST.md` — §19 now points operators to the support SQL playbook as the manual fallback path.

**Coverage**: The guide covers current user-owned Neon tables from `lib/db/schema.ts`, including auth/profile/session/credential rows, conversations/messages/memory, projects, prompts, workflows/steps/runs, custom assistants, artifacts/versions/shares, template shares, model comparisons/candidates, files/chunks, generated images/image events, usage/subscriptions/plan requests/overrides, recommendation/feedback telemetry, GitHub integration accounts/items, and admin audit references.

**Assumptions**: Self-serve/admin purge remains the primary path. The SQL guide is fallback-only, does not execute destructive SQL itself, does not hard-delete `zen_users`, and keeps `.env.local`/secrets out of docs.

**Verification**: `git diff --check` passed. Typecheck, lint, and build were skipped because this is docs-only.

---

## 2026-06-17 - AI_CHECKLIST Neon Migration Order Sync

**Goal**: Verify and record that `AI_CHECKLIST.md` uses the current authoritative Neon migration order.

**Verified**:
- Inspected `neon/migrations/` and confirmed the 19 current Neon migration files are present.
- Cross-checked `AI_CHECKLIST.md` against `docs/BETA_LAUNCH_CHECKLIST.md`; both list the same 19-file order, including `20260616_zenquanta_artifact_shares.sql`, `20260616_zenquanta_feedback_events.sql`, `20260616_zenquanta_incremental_performance_indexes.sql`, and `20260617_zenquanta_template_shares.sql`.

**Files changed**:
- `AI_TASK_LOG.md` — Added this docs-only verification entry.

**Not changed**: Runtime code, `.env.example`, Supabase, Stripe, and the existing uncommitted purge implementation were not touched for this task.

**Checks**: `git diff --check` passed. Typecheck, lint, and build were skipped because this was a docs-only verification/logging pass.

---

## 2026-06-17 - Self-Serve Data Deletion / User Purge v1

**Goal**: Add foreground, authenticated deletion flows for user workspace-data deletion, user full-account deletion, and admin target-user purge.

**Implemented**:
- Added shared purge types plus pure validation/sanitization helpers for scopes, typed confirmations, safe grouped previews/results, object-ref normalization, deletion-order documentation, and tombstone patches.
- Added server-only purge repository/service layers that collect upload/generated-image object refs first, revoke database access through scoped deletes/tombstoning, then attempt object-store deletion best-effort.
- Added protected routes: `POST /api/account/delete-data/preview`, `POST /api/account/delete-data`, `POST /api/admin/users/[id]/purge/preview`, and `POST /api/admin/users/[id]/purge`.
- Added Settings Danger Zone controls for users and an admin purge card on `/admin/users/[id]`, including preview summaries, scope selection, typed confirmations, self-purge prevention for admins, and full-account sign-out redirect acknowledgement.
- Updated project/checklist/beta/decision docs for the tombstone-account decision, route coverage, 19-file migration list, and beta deletion verification.

**Safety behavior**: Preview/result payloads expose grouped counts only. They do not expose bucket names, storage keys, source URLs, content, raw model costs, provider tokens, or secrets. Full-account deletion preserves scrubbed `zen_users` / `zen_profiles` rows so admin audit references remain intact.

**Verification**:
- `npm run test -- --run tests/user-purge-utils.test.ts` passed.
- `npm run test` passed: 18 files, 78 tests.
- `npm run typecheck` passed.
- `npm run lint` passed with 10 existing warnings and 0 errors.
- `npm run build` passed.
- `git diff --check` passed.

**Remaining risks**: No seeded Neon/browser manual QA was run yet, so the first staging pass should test user data-only deletion, user full-account deletion, admin purge, self-purge blocking, protected file/image 404s after purge, and safe partial object-cleanup reporting.

---

## 2026-06-17 - Developer Handoff Doc

**Goal**: Give the next coding agent (ChatGPT/Codex) a single self-contained entry point to continue the project. Documentation only.

**Files changed**:
- `docs/HANDOFF.md` — New handoff doc: TL;DR, non-negotiable ground rules (no Supabase/Stripe, secrets server-only, no `.env.example`, separate text/image transports, where each concern lives), required-reading order, current shipped state, environment status, prioritized open work, definition of done, and the handoff-back protocol.

**Environment status captured**: Operator confirms Neon is running, an admin user exists in `zen_profiles`, and all 19 Neon migrations are applied — including the three newest (`20260616_zenquanta_artifact_shares`, `20260616_zenquanta_feedback_events`, `20260617_zenquanta_template_shares`), which the operator ran on 2026-06-16/17. `/admin/system-health` is noted as an optional green-light sanity check, not a required remediation step.

**Open work flagged for the next agent (prioritized)**: (1) self-serve data deletion to replace the manual `BETA_LAUNCH_CHECKLIST.md` §19 cleanup; (2) sync the 16→19 migration list in `AI_CHECKLIST.md`; (3) draft the exact per-user cleanup query set.

**Verified**: Doc-only change. No runtime code modified, so typecheck/lint/build were not re-run.

**Next steps**: Point ChatGPT/Codex at `docs/HANDOFF.md` (with repo access) or share it plus the six required-reading files (plain web, no secrets). Default first task is self-serve data deletion.

---

## 2026-06-17 - Beta Launch Checklist & Bug Bash Plan

**Goal**: Prepare Zenquanta AI for a small private beta with an operator/admin-facing readiness checklist and tester bug-bash plan. Documentation only.

**Files changed**:
- `docs/BETA_LAUNCH_CHECKLIST.md` — New 20-section beta launch + bug bash doc: required env vars, Neon migration order (authoritative 19-file list), admin setup, storage provider checks, OpenRouter/Tavily/embeddings/GitHub verification, manual plan request + admin activation, file/search privacy, usage/billing + Prism credit enforcement, mobile checks, known limitations, bug report template, rollback plan, manual data-deletion notes, first 10 tester tasks, and a sign-off block. Points operators at `/admin/system-health` as the pre-flight.
- `ZENQUANTA_PROJECT_CONTEXT.md` — Fixed two stale `.env.example` references (lines ~87 and ~716) to reflect that secrets live in `.env.local` and there is no committed `.env.example`.

**`.env.example` → `.env.local` sweep**: Searched the repo for `.env.example` references. The recent docs (`README.md`, `AGENTS.md`, `CLAUDE.md`, `AI_CHECKLIST.md`, `AI_PROJECT.md`) and the System Health validator already use `.env.local` correctly. Only `ZENQUANTA_PROJECT_CONTEXT.md` still pointed at `.env.example` as a live file — now corrected. Remaining `.env.example` mentions are intentional policy statements ("do not recreate/add to `.env.example` unless explicitly requested") in `AGENTS.md`, `CLAUDE.md`, and the integration plan docs, plus one historical note in this log — all left as-is. No `.env.example` file exists on disk; `.gitignore` still ignores it (harmless).

**Beta readiness status**: Documentation and pre-flight tooling are ready. Core platform (Neon auth, chat, projects, billing/usage, admin) is implemented. Open items before invites are operational, not code: apply all 19 Neon migrations to a fresh DB, set required env vars, promote an admin in `zen_profiles`, choose a durable storage provider (s3/r2) if uploads must persist, take a Neon snapshot for rollback, and draft the per-user manual-deletion query set (no self-serve account deletion exists yet).

**Verified**: Doc-only change. No runtime code modified, so typecheck/lint/build were not re-run for this task. Migration list and env var names cross-checked against `neon/migrations/`, `AI_CHECKLIST.md`, and `AI_PROJECT.md`.

**Next steps**: Operator works through `docs/BETA_LAUNCH_CHECKLIST.md` §1–§4, confirms `/admin/system-health` shows 0 missing required services, then sends the §20 task script to the first cohort. Consider a future self-serve data-deletion endpoint to replace the manual cleanup in §19.

---

## 2026-06-17 - Shareable Prompt and Playbook Templates v1

**Goal**: Allow users to create controlled share links for prompt templates and AI Playbook templates. Public visitors can preview the template and copy it into their own workspace. Run history, conversations, and project data are never exposed.

**Files changed**:
- `lib/db/schema.ts` — Added `zenTemplateShares` table and `templateShareTypeCheck` constant
- `neon/migrations/20260617_zenquanta_template_shares.sql` — Migration SQL for `zen_template_shares`
- `types/index.ts` — Added `TemplateShareType`, `TemplateShareVisibility`, `TemplateShareInfo`, `TemplateShareCreated`, `TemplateShareInput`, `PublicPromptShare`, `PublicPlaybookShare`, `PublicTemplateShare`, `TemplateCopyResult`
- `lib/db/repositories/template-shares.ts` — New repository: `create`, `list`, `revoke`, `getPublicByToken`, `copyToWorkspace`
- `lib/db/repositories/index.ts` — Exports `neonTemplateSharesRepository`
- `app/api/prompts/[id]/shares/route.ts` — `GET` (list) + `POST` (create) for prompt shares
- `app/api/prompts/[id]/shares/[shareId]/route.ts` — `DELETE` (revoke) for prompt shares
- `app/api/prompt-workflows/[id]/shares/route.ts` — `GET` (list) + `POST` (create) for playbook shares
- `app/api/prompt-workflows/[id]/shares/[shareId]/route.ts` — `DELETE` (revoke) for playbook shares
- `app/api/share/templates/[token]/route.ts` — Public JSON API (no auth)
- `app/api/share/templates/[token]/copy/route.ts` — Copy-to-workspace endpoint (auth required)
- `app/share/templates/[token]/page.tsx` — Public read-only server component; shows prompt content or playbook steps
- `app/share/templates/[token]/copy-button.tsx` — Client component for copy-into-workspace CTA
- `components/chat/prompt-library-button.tsx` — Share button on prompt cards + playbook cards, share dialog (create/copy/revoke)

**Architecture decisions**:
- **Single table**: `zen_template_shares` stores both prompt and playbook shares with `template_type: 'prompt' | 'playbook'` and `template_id: text` (no FK, since prompts use a composite PK `(user_id, id)` which cannot be referenced with a simple FK). Share records linger as audit trail after template deletion; `getPublicByToken` returns null if the underlying template no longer exists.
- **Token model**: Identical to artifact shares — 32 random bytes base64url (43 chars). Raw token returned only on creation; SHA-256 hash stored in DB. Token validation regex `/^[A-Za-z0-9_-]{40,60}$/` on public routes.
- **Copy-to-workspace**: `POST /api/share/templates/[token]/copy` (auth required). For prompts: inserts into `zen_prompt_library`. For playbooks: inserts into `zen_prompt_workflows` + `zen_prompt_workflow_steps` with fresh IDs. No run history, no project scoping, no conversation data copied.
- **Public page**: `/share/templates/[token]` server component. Shows prompt content (monospace) or playbook title/description/variables/steps (assistant + template text). `CopyToWorkspaceButton` client component redirects unauthenticated users to `/sign-in?next=...`.
- **Private data**: `getPublicByToken` never returns `userId`, `projectId`, `conversationId`, run history, or workflow run outputs. For playbooks, step IDs are excluded from the public payload.
- **Revocation**: `revokedAt` field; revoked links immediately return 404 at the public API and page level.
- **Expiry**: `expiresAt` nullable; checked server-side.

**Verified**: `npm run typecheck` clean, `npm run lint` 0 errors (10 pre-existing warnings), `npm run build` succeeds with all 8 new routes in the manifest.

**Remaining risks**:
- Migration `neon/migrations/20260617_zenquanta_template_shares.sql` must be run in Neon before the feature is live.
- `template_id` has no FK — if a prompt or playbook is deleted, its shares become silently 404-returning dead links (audit trail preserved, no cascade). This is intentional.
- Unauthenticated copy flow redirects to `/sign-in` which must exist (it does in this repo).

**Next steps**: Run the Neon migration. Consider surfacing "shared" badge on prompt/playbook cards if they have active share links (requires client-side share count check).

---

## 2026-06-17 - Production Environment Validator v1

**Goal**: Provide admins a server-only diagnostic tool at `/admin/system-health` (and `GET /api/admin/system-health`) that checks whether all required env vars and service dependencies are configured, without exposing any secret values.

**Files changed**:
- `types/index.ts` — Added `HealthStatus`, `HealthCheck`, `SystemHealthReport`
- `lib/system-health/checks.ts` — New server-only module: 12 named checks across DB, AI services, web search, embeddings, storage, and environment. Returns `SystemHealthReport` with per-check status and summary counts.
- `app/api/admin/system-health/route.ts` — Admin-only `GET` route. Returns `SystemHealthReport` JSON. Protected by `requireAdminApiUser`.
- `app/admin/system-health/page.tsx` — Admin-only server component with `requireAdmin`. Renders grouped check cards (Database / AI Services / Web Search / RAG / File Storage / Environment). Shows healthy/degraded/missing/unknown status with icons and summary chips.
- `app/admin/page.tsx` — Added "System health" button link in the header next to "Back to app".

**Checks implemented**:
1. `db_url` — DATABASE_URL / NEON_DATABASE_URL / POSTGRES_URL presence. Shows sanitized host, never credentials.
2. `db_connect` — Live `SELECT 1` via Neon client. Reports connection failure message safely.
3. `db_schema` — Queries `information_schema.tables` for 5 expected tables (`zen_users`, `zen_subscriptions`, `zen_auth_sessions`, `zen_artifact_shares`, `zen_template_shares`). Lists missing tables when any absent.
4. `pgvector` — Queries `pg_available_extensions WHERE name = 'vector'`. Distinguishes not-available vs available-but-not-installed vs installed (with version).
5. `openrouter` — OPENROUTER_API_KEY present via `hasOpenRouterConfig()`.
6. `tavily` — TAVILY_API_KEY via `hasWebSearchConfig()`. Missing = degraded (not missing), Pulse degrades gracefully.
7. `embeddings` — EMBEDDINGS_API_KEY or OPENAI_API_KEY via `hasEmbeddingConfig()`. Missing = degraded; shows current model name.
8. `storage_provider` — FILE_STORAGE_PROVIDER resolved value. Local in production = degraded with warning.
9. `storage_creds` — If s3/r2, checks endpoint/access-key-id/secret/bucket all present. Shows endpoint hostname and bucket name (no secret values).
10. `auth_security` — NODE_ENV check: production = cookies use Secure flag; non-production = degraded with dev note.
11. `app_url` — NEXT_PUBLIC_APP_URL or VERCEL_URL; missing = degraded (share links may use wrong base URL).
12. `deploy_env` — VERCEL_ENV / NODE_ENV detection for deployment context.

**Architecture decisions**:
- No secret values ever returned. Endpoint URLs truncated to hostname only. Credentials shown as `(configured)` or listed as missing by var name only.
- All DB checks wrapped in try/catch — a check failure captures the error message safely and returns `unknown` or `missing`, never throws through the route.
- DB checks run in parallel (`Promise.all`) to minimize latency.
- `dynamic = 'force-dynamic'` on the page so checks always run fresh (not cached at build time).
- Never calls paid AI APIs (no OpenRouter completions, no embedding generation, no Tavily search). DB `SELECT 1` and extension queries are free reads.

**Verified**: `npm run typecheck` clean, `npm run lint` 0 errors, `npm run build` succeeds with 2 new routes in manifest.

---

## 2026-06-17 - Shareable Artifact Links v1

**Goal**: Allow users to create controlled share links for selected artifacts. Links are read-only. Revoked links stop working immediately.

**Files changed**:
- `lib/db/schema.ts` — Added `zenArtifactShares` table and `artifactShareVisibilityCheck` constant
- `neon/migrations/20260616_zenquanta_artifact_shares.sql` — Migration SQL for `zen_artifact_shares`
- `types/index.ts` — Added `ArtifactShareVisibility`, `ArtifactShareInfo`, `ArtifactShareCreated`, `ArtifactShareInput`, `PublicArtifactShare`
- `lib/db/repositories/artifact-shares.ts` — New repository: `create`, `list`, `revoke`, `getPublicByToken`
- `lib/db/repositories/index.ts` — Exports `neonArtifactSharesRepository`
- `app/api/artifacts/[id]/shares/route.ts` — `GET` (list) + `POST` (create)
- `app/api/artifacts/[id]/shares/[shareId]/route.ts` — `DELETE` (revoke)
- `app/api/share/artifacts/[token]/route.ts` — Public JSON API (no auth)
- `app/share/artifacts/[token]/page.tsx` — Public read-only server component page
- `components/chat/artifact-studio.tsx` — Share button + Share dialog (create/copy/revoke)

**Architecture decisions**:
- **Token model**: 32 random bytes as `base64url` (43 chars). Raw token never stored — only SHA-256 hash stored in `zen_artifact_shares.token_hash`. Unique index on hash. Identical to session token pattern in `lib/auth/session.ts`.
- **Token validation**: Public routes reject tokens that don't match `/^[A-Za-z0-9_-]{40,60}$/` before hitting DB.
- **Visibility**: `public_link` (no auth required) or `private_link` (same token-gate, future use). Both currently accessible by anyone with the token — token entropy provides the access control.
- **Expiry**: `expiresAt` nullable. Checked server-side on `getPublicByToken` — expired links return null.
- **Revocation**: Sets `revokedAt`. `list()` filters `revokedAt IS NULL`. `getPublicByToken` returns null if revoked. Revoked at token remains in DB for audit.
- **Public page**: `/share/artifacts/[token]` is a Next.js server component. Calls repository directly (no auth check). Exposes only `title`, `artifactType`, `content` — no userId, projectId, conversationId, metadata.
- **Token delivery**: Raw token returned only on `POST` creation response (`ArtifactShareCreated`). Not stored in client state after the dialog closes.
- **Security**: Share links expose no project files, conversation history, or owner workspace data. `Content-Security-Policy` and `robots` meta on the public page set to `noindex` for private links.

**Verified**: `npm run typecheck` clean, `npm run lint` 0 errors, `npm run build` succeeds with all 4 new routes in the manifest.

**Remaining risks**:
- Migration must be run in Neon before the share feature can be used. Artifact owners will need to run `20260616_zenquanta_artifact_shares.sql`.
- Token validation regex assumes base64url output from Node `randomBytes(32).toString('base64url')` (always 43 chars). Range 40–60 gives buffer if source changes.
- `private_link` and `public_link` are currently equivalent in access (token is the only gate). Future implementation could require Zenquanta login for `private_link`.

**Next steps**: Run the Neon migration. Consider adding a per-artifact share count to the `ProjectHomeArtifactSummary` or workspace home surface if shares become a first-class metric.

---

## 2026-06-16 - Notion Read-Only Integration Plan

**Goal**: Plan a safe Notion integration for importing selected pages and databases into Zenquanta projects and Ask Files. Documentation only — no code changed.

**Deliverable**: `docs/integrations/notion-readonly-plan.md`

**Key decisions documented**:

- **OAuth model**: Notion uses capability-based permissions set at the developer portal, not OAuth scope strings. Required capabilities: `read_content` + `read_user_info` only. Insert/update capabilities must remain off. The user selects which pages to share inside Notion's OAuth UI — no folder-browser UX is needed post-connect.
- **Token storage**: Notion access tokens are permanent (no expiry, no refresh_token). AES-256-GCM encryption using existing `zen_integration_accounts.encrypted_token_payload` column. Key from `NOTION_TOKEN_ENCRYPTION_KEY` env var. No refresh logic needed — simpler than Drive, but permanent tokens carry higher breach risk.
- **Content assembly**: Notion has no binary file download. Pages are assembled by recursively fetching blocks via `GET /v1/blocks/{id}/children` (paginated, depth limit 6, block count limit 500) and rendering to Markdown using a `renderBlocksToMarkdown()` function. Output stored as `mimeType: 'text/markdown'` bytes, fed into the existing `indexUploadedFileForKnowledge()` pipeline unchanged.
- **Database import**: `POST /v1/databases/{id}/query` (cap 50 rows). Properties extracted as a structured Markdown document — block-level content per row is not fetched in v1.
- **Schema change**: Update `integrationProviderCheck` in `lib/db/schema.ts` to include `'notion'` (and `'google-drive'` if that migration has not yet run). One migration SQL statement.
- **Import path**: Mirrors GitHub import — `zen_files` with `provider: 'external'`, `bucket: null`, `storagePath: null`, `metadata.source: 'notion'`. Tracked in `zen_integration_items` with `externalId: 'notion-page:{pageId}'` or `'notion-db:{databaseId}'`.
- **Revocation**: No public Notion revoke endpoint. DELETE route clears `encryptedTokenPayload`, sets `status: 'revoked'`. UI instructs user to also revoke from their Notion connected apps settings.
- **Re-import optimization**: Store `lastEditedTime` from Notion in item metadata. On reimport, check current `lastEditedTime` before re-fetching all blocks.
- **No background sync in v1**: Notion has no public webhook/push API for page changes. User-triggered only.
- **Rate limiting**: Notion enforces 3 req/sec per integration. Block pagination calls must be sequential.

**New lib files planned**: `lib/integrations/notion.ts`, `lib/integrations/notion-import.ts`, `lib/integrations/notion-tokens.ts`

**New API routes planned** (7): `GET/DELETE /api/integrations/notion`, `GET /api/integrations/notion/connect`, `GET /api/integrations/notion/callback`, `GET /api/integrations/notion/pages`, `POST /api/integrations/notion/import`, `POST /api/integrations/notion/reimport`

**New env vars**: `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`, `NOTION_CALLBACK_URL`, `NOTION_TOKEN_ENCRYPTION_KEY`

**Security risks addressed**: permanent token (no expiry) requires encryption key discipline, CSRF state cookie, block ID validation (UUID format check), memory limit on block fetch, rate limit handling, 401 detection sets `status: 'error'`.

**No code changed. No app behavior modified.** Ready for implementation when requested.

## 2026-06-16 - Google Drive Read-Only Integration Plan

**Goal**: Plan a safe Google Drive integration for importing selected Drive documents into Zenquanta projects and Ask Files. Documentation only — no code changed.

**Deliverable**: `docs/integrations/google-drive-readonly-plan.md`

**Key decisions documented**:

- **OAuth scope**: `drive.readonly` recommended for v1 (enables folder browsing + content download). `drive.file` + Google Picker deferred to a future version. Always request `offline` access for `refresh_token`.
- **Token storage**: Use existing `zen_integration_accounts.encrypted_token_payload` (jsonb column already present, currently null for GitHub). AES-256-GCM encryption with key from `GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY` env var; plaintext tokens never stored. Token refresh logic detects expiry before each API call and updates DB.
- **Schema change**: Update `integrationProviderCheck` in `lib/db/schema.ts` to include `'google-drive'`. One migration SQL statement to update the check constraint on `zen_integration_accounts`. No new tables needed.
- **Import path**: Mirrors GitHub import exactly — Drive bytes fetched server-side, written to `zen_files` with `provider: 'external'` (no object storage), indexed via `indexUploadedFileForKnowledge()`, tracked in `zen_integration_items` with `externalId = driveFileId`.
- **Google Workspace files**: Google Doc → export DOCX → mammoth; Google Sheet → export CSV. Slides/Drawings/Scripts skipped in v1.
- **File types**: All existing Zenquanta extractors apply (PDF, DOCX, TXT, CSV, Markdown, JSON, code).
- **No background sync in v1**: All imports are user-triggered. No webhooks, cron, or Changes API.
- **Revocation**: DELETE route decrypts token, calls Google revoke endpoint, clears `encryptedTokenPayload`, sets status `revoked`. Imported files remain as Zenquanta knowledge.
- **Drive API 401/403**: Treated as implicit revocation; sets status to `error` and surfaces reconnect CTA.
- **Knowledge Library**: `metadata.source = 'google-drive'` already surfaced by `fileToIntelligence`. Option A: add "Google Drive" tab alongside GitHub tab. Option B (deferred): show Drive badge in "All" tab only.

**New lib files planned**: `lib/integrations/google-drive.ts`, `lib/integrations/google-drive-import.ts`, `lib/integrations/google-drive-tokens.ts`

**New API routes planned** (7): `GET/DELETE /api/integrations/google-drive`, `GET /api/integrations/google-drive/connect`, `GET /api/integrations/google-drive/callback`, `GET /api/integrations/google-drive/files`, `POST /api/integrations/google-drive/import`, `POST /api/integrations/google-drive/reimport`

**New env vars**: `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_CALLBACK_URL`, `GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY`

**Security risks addressed**: token encryption at rest, CSRF state cookie pattern (same as GitHub), SSRF mitigated by Drive API own-account scoping, size limits enforced before reading response body, refresh race condition noted (defer to v1.1), revocation detection on 401/403.

**No code changed. No app behavior modified.** Ready for implementation when requested.

## 2026-06-16 - Knowledge Library v1

**Goal**: Dedicated page where users can browse, filter, and manage all uploaded and imported knowledge files across projects.

**New route**: `/knowledge` (dynamic, server-rendered, auth-gated via `requireServerUser`).

**Files changed**:

- **`lib/db/repositories/files.ts`** — `fileToIntelligence` now exposes `source` from the raw DB metadata in `FileIntelligence.metadata`. GitHub files carry `source: 'github'`; upload files have `source: null`. This enables client-side source detection without a full DB query.
- **`app/api/files/[id]/route.ts`** — New `PATCH` handler accepts `{ projectId: string | null }`. Validates the project belongs to the authenticated user before patching. Returns updated `FileIntelligence` on success. Existing `DELETE` is unchanged.
- **`app/knowledge/page.tsx`** — Server component. Auth gates with `requireServerUser`, fetches user's project list, renders `KnowledgeLibraryClient`.
- **`app/knowledge/knowledge-library-client.tsx`** — Client component. Fetches files from `/api/files` with project scoping. Tabs: All / Indexed / Skipped+Failed / GitHub. Project filter select, search input. Renders `FileIntelligenceCard` for each file with source badge, project context, and "Assign to project" button. Actions available: View (protected URL), Download, Ask this file (navigates to `/?openAskFiles=<fileId>`), Re-index, Assign to project (dialog with PATCH call), Remove (with AlertDialog confirm).
- **`components/chat/chat-layout.tsx`** — `ChatShell` reads the `openAskFiles` URL param on mount (once `authState.status === 'authenticated'`) and calls `openWorkspaceTool({ tool: 'ask-files', fileId })`. Cleans up the URL with `window.history.replaceState`. This closes the round-trip from Knowledge Library → workspace Ask Files.
- **`components/chat/sidebar.tsx`** — Added `Knowledge Library` link in the user account dropdown alongside Dashboard and Plans.

**Source detection**: `file.metadata?.source === 'github'` for GitHub-imported files; all others treated as uploads. No object-storage path is exposed to the browser; `viewUrl` and `downloadUrl` point to `/api/files/object?…` (the authenticated protected route).

**Not implemented in v1**: multi-select bulk actions, pagination beyond the 300-file limit, conversation-scoped view, GitHub-specific reimport button from the library page.

**Verification**: `npm run typecheck` ✓ · `npm run lint` 0 errors, 10 pre-existing warnings ✓ · `npm run build` all 58+ routes ✓ (new `/knowledge` route appears as `ƒ Dynamic`).

## 2026-06-16 - Expanded File Extraction for Business and Developer Files

- Expanded `lib/rag/extraction.ts` to support Markdown, JSON, CSV, and DOCX beyond plain text/code and PDF.
- Added `mammoth 1.12.0` (no native deps) via pnpm for DOCX text extraction; added `types/mammoth.d.ts` with a minimal ambient declaration since no `@types/mammoth` package exists on npm.
- **Markdown (`.md`, `.mdx`)**: Previously read as raw UTF-8 (worked but syntax tokens polluted embeddings). Now strips markdown rendering markers (headings, bold/italic, inline code, fenced code blocks kept as content, links reduced to display text, images removed, blockquotes/bullets/table pipes cleaned) before normalizing and chunking, producing cleaner prose for vector embeddings.
- **JSON (`.json`, `application/json`)**: Previously read as raw UTF-8. Now validates with `JSON.parse` and pretty-prints with `JSON.stringify(…, null, 2)` so chunks align on object boundaries rather than arbitrary character positions. Returns `unsupported` with a clear reason if the file is not valid JSON.
- **CSV (`.csv`, `text/csv`)**: Previously read as raw UTF-8. Now parsed with a minimal RFC 4180 parser (handles quoted fields containing commas, newlines, and escaped `""` pairs) and converts each data row to `Header: value | Header: value` format for readable semantic search. Capped at 10,000 rows and 2× `MAX_EXTRACTED_CHARS` of input scanning to avoid huge memory use on large exports.
- **DOCX (`.docx`)**: Was previously `unsupported`. Now extracted via `mammoth.extractRawText`, which handles standard Word document structure (paragraphs, headings, lists). Returns `unsupported` with a clear reason for encrypted or corrupted files. Dynamic import (`await import('mammoth')`) keeps mammoth out of the critical path for non-DOCX uploads.
- **Unchanged behavior**: All other text and code file types (`.ts`, `.py`, `.sql`, `.html`, etc.) continue through the existing generic UTF-8 reader path. PDF handling is unchanged.
- **Dispatcher order**: PDF → DOCX → (unsupported boundary for non-text) → JSON → CSV → Markdown → generic text. DOCX check must precede the `!isTextKnowledgeFile` guard because DOCX is binary.
- **Skipped / not supported**: OCR, image-based PDFs, password-protected DOCX, external parsing services, external vector DBs, Supabase, Stripe.
- `isDocxKnowledgeFile` is now exported alongside `isTextKnowledgeFile` and `isPdfKnowledgeFile` so future upload-path code can detect DOCX without re-implementing the same logic.
- Did not change `lib/rag/indexing.ts` (unchanged — already calls `extractTextFromFileBytes` and handles all status variants), `lib/storage/attachments.ts` (unchanged), or any API routes.
- Verification: `npm run typecheck` ✓ · `npm run test` 73/73 ✓ · `npm run lint` 0 errors, 10 pre-existing warnings ✓ · `npm run build` all routes ✓

## 2026-06-16 - Ask Files Source Citations V1

- Improved `SourceList` in `components/chat/message.tsx` to properly display file chunk citations when users ask questions about uploaded files.
- **What changed**: Replaced the flat single-section source list with a type-aware split that handles file and web sources separately.
- **File sources now show**:
  - `FileText` icon to visually distinguish from web links
  - File name (from `source.title`, which is the original `fileName` from `zen_files`)
  - **Chunk label** (`Chunk N` derived from `source.chunkIndex + 1`) — honest section indicator, no fake page numbers
  - Snippet text (line-clamp-3, up to 700 chars from the chunk content already stored in `FileKnowledgeSource.snippet`)
  - "Open file" link via `ExternalLink` icon if `source.url !== '#'`; non-clickable `<div>` if URL is `'#'` (no bucket/storagePath stored)
  - Honest `"Relevant file context used"` label when snippet is absent
- **Web sources**: unchanged behavior — sequential ID badge, domain, external link icon
- **Mixed responses** (file context + web search): two separate panels labeled "File context used" and "Web sources"; single-type responses keep the existing "Sources" label
- **No backend changes needed**: the full data pipeline was already in place — `lib/rag/retrieval.ts` retrieves `FileKnowledgeSource` with all required fields, `/api/chat/route.ts` streams them via the `sources` event and persists them to `zen_messages.sources`, and the `FileKnowledgeSource` type already carries `fileName`, `chunkId`, `chunkIndex`, `snippet`, `score`, `fileId`, and `url`.
- Added `FileKnowledgeSource` and `MessageSource` imports to `message.tsx` to enable the `isFileKnowledgeSource` type guard.
- Did not add page numbers (no page data exists in chunks), did not expose private files beyond existing storage URLs, did not add an external vector DB, did not add Supabase or Stripe, did not bypass billing.
- Remaining risks: `source.url` for file sources is a pre-signed or local storage URL generated server-side at retrieval time. Pre-signed URLs expire; if a user opens a persisted message hours later the "Open file" link may no longer work. The graceful `'#'`-check prevents broken links but does not guarantee freshness for stored old responses.
- Verification: `npm run typecheck` ✓ · `npm run lint` 0 errors, 10 pre-existing warnings ✓ · `npm run build` 57 routes ✓

## 2026-06-16 - User Preference Center V1

- Implemented User Preference Center v1 as an expanded and reorganized settings modal (`components/chat/settings-modal.tsx`).
- Added two new functional settings:
  - **Usage Optimization** (`usageOptimization: UsageOptimization`) — 4-card picker (Balanced / Fast / Best Quality / Lowest Usage) that maps directly to `sessionDefaults.modelOverride` (`auto` / `gemini` / `claude` / `deepseek`). Selecting a card sets the default model profile for new sessions without bypassing plan or model limits. Per-session overrides remain available in the session panel.
  - **Default Project Behavior** (`defaultProjectBehavior: DefaultProjectBehavior`) — 2-option picker (Remember last project / Always start in Inbox) wired to workspace load in `lib/chat-context.tsx`. When `inbox` is selected, the stored browser project selection is ignored on auth restore and new sessions always open in the general workspace (`all`).
- Added `UsageOptimization` and `DefaultProjectBehavior` types to `types/index.ts`.
- Added `getModelOverrideForUsageOptimization` and `getUsageOptimizationFromModelOverride` helpers to `lib/config/models.ts`.
- Updated `DEFAULT_APP_SETTINGS` with `usageOptimization: 'balanced'` and `defaultProjectBehavior: 'last_used'` defaults.
- Updated `lib/db/repositories/settings.ts` with validated normalization for both new fields; unknown values fall back to defaults.
- All 10 requested settings are now present and functional in the modal:
  1. Default assistant (existing mode grid, relabeled "Default Assistant")
  2. Default response style (Balanced / Concise / Detailed)
  3. Memory enabled/disabled (Session Feature Defaults toggle)
  4. File context default (Session Feature Defaults toggle)
  5. Web search default (Session Feature Defaults toggle)
  6. Assistant recommendation toggle
  7. Personalized recommendation toggle
  8. Usage optimization preference (Fast / Balanced / Best Quality / Lowest Usage)
  9. Default project behavior (Inbox / Last Used)
  10. Theme/UI preferences (dark theme locked + accent style picker)
- Did not expose raw cost, add Supabase, add Stripe, or bypass plan limits.
- Remaining risks: `usageOptimization` is derived from `sessionDefaults.modelOverride` at render time via `getUsageOptimizationFromModelOverride`; if a user manually sets `modelOverride` to `gpt` or `qwen` in the session panel, the preference center will show `balanced` as the nearest match until they explicitly select an optimization card.
- Verification pending: `npm run typecheck`, `npm run lint`, `npm run build`.

## 2026-06-16 - Personalized Assistant Recommendations V2

- Added opt-in Personalized Assistant Recommendations v2 on top of the existing local Smart Assistant Router. Base prompt classification remains the source of truth; personalization only applies bounded confidence/explanation nudges when the user enables it.
- Extended settings with `assistantRecommendations.personalized`, defaulting to `false` for existing and new users, and added a separate Settings toggle that is disabled when assistant recommendations are off.
- Added safe personalization summary types and pure router helpers that derive task-level signals from recommendation outcomes, Feedback V1 metadata/ratings, selected Model Duel winners, and recent assistant usage without storing prompts, message content, snippets, raw costs, provider secrets, or cross-user data.
- Added protected `GET /api/assistant-recommendations/personalization`, scoped to the authenticated user, and wired authenticated workspace hydration to fetch the summary only when personalization is enabled.
- Updated inline recommendation chip and send-time recommendation dialog to show the base reason plus a subtle personalized explanation such as “You usually choose Forge for coding tasks.”
- Added unit coverage for unchanged base routing when personalization is off, Forge/code acceptance history, Pulse rejection confidence suppression, Velora creative feedback, and unrelated Model Duel winner non-overrides.
- Preserved constraints: no external ML, no OpenRouter routing call, no Supabase, no Stripe, no plan/model-limit bypass, and no hidden prompt/router auto-tuning beyond the opt-in local nudge.
- Remaining risks: no seeded Neon/browser QA was run to verify a real account’s personalization summary over time; the v2 summary is request-time derived and may need caching if high-volume accounts make the settings/workspace load slower.
- Verification: `npm run test` passed with 17 files and 73 tests; `npm run typecheck` passed; `npm run lint` passed with the existing 11 warnings and 0 errors; `npm run build` passed with the known Node `module.register()` deprecation warning.

## 2026-06-16 - Feedback Loop V1

- Added Feedback Loop v1 for user-scoped assistant/message, Model Duel candidate, artifact action, playbook run, Prism image, and backend-ready search-result feedback capture.
- Added forward-only Neon migration `20260616_zenquanta_feedback_events.sql`, Drizzle `zenFeedbackEvents`, shared feedback request/response types, a pure validation/sanitization helper, and `neonFeedbackRepository`.
- Added protected `POST /api/feedback`; it requires the authenticated Neon session, hydrates the user profile, validates entity/rating input, returns `404` for missing/foreign concrete entities, and stores sanitized append-only events.
- Added reusable feedback controls to completed assistant messages, completed Model Duel candidates, artifact action previews, playbook final outputs, and selected Prism images. Downvotes can include an optional short reason; submissions show a lightweight thanks acknowledgement and make no AI call.
- Extended admin product analytics with aggregate feedback counts, rating breakdowns, downvote rate, entity-type buckets, and negative-feedback operational signals. Normal users do not receive cross-user feedback data.
- Search-result feedback is supported by the backend with sanitized metadata, but command-palette row UI wiring is deferred to keep the v1 UI low-risk.
- Added focused Vitest coverage for feedback entity/rating validation, reason trimming, and metadata stripping of snippets, content, object-store internals, secrets, and raw-cost fields.
- Verification: `npm run test` passed with 17 files and 68 tests; `npm run typecheck` passed; `npm run lint` passed with the existing 11 warnings and 0 errors; `npm run build` passed with the known Node `module.register()` deprecation warning; `git diff --check` passed.

## 2026-06-16 - Workspace Home V1

- Added Workspace Home v1 as the authenticated first screen inside `/` when no conversation or Project Home is open. `/dashboard` remains focused on usage, plan status, admin-adjacent dashboard data, and Activity Timeline.
- Added shared `WorkspaceHome*` response types, `lib/workspace-home/suggestions.ts`, and unit-tested rule-based suggestion logic. Suggestions are deterministic and make no AI calls or token-using requests on page load.
- Added `lib/db/repositories/workspace-home.ts` and exported `neonWorkspaceHomeRepository`; it derives capped, user-scoped summaries from existing Neon projects, conversations, artifacts, prompt workflow runs, files, and generated images. Responses exclude raw costs, admin data, provider secrets, direct object-store URLs, and large content payloads.
- Added protected `GET /api/workspace-home`, which requires the authenticated Neon session, hydrates the user profile, computes a displayed-only usage snapshot from existing billing helpers, and returns continue items, recent workspace lists, suggestions, and generated timestamp.
- Added `components/chat/workspace-home.tsx` and updated `components/chat/chat-area.tsx` so Project Home still wins when selected, active conversations still render normally, and Workspace Home replaces the old generic empty state for authenticated users with no active chat.
- Quick actions use existing chat-context methods: new chat, inline new project, upload to target project, open Playbooks, prepare Prism image draft, open Pulse Research Room, and open global search.
- Updated project/checklist docs to include `/api/workspace-home` and the authenticated `/` Workspace Home.
- Remaining risks: no seeded Neon/browser QA was run to click every Workspace Home target; playbook-run links currently open the Playbooks surface rather than focusing an exact historical run row; upload quick action requires a target project.
- Verification: `npm run test` passed with 16 files and 64 tests; `npm run typecheck` passed; `npm run lint` passed with the existing 11 warnings and 0 errors; `npm run build` passed with the known Node `module.register()` deprecation warning.

## 2026-06-16 - Workspace Activity Timeline V1

- Added Workspace Activity Timeline v1 as a user-scoped feed derived from existing Neon tables, without event sourcing, background jobs, external analytics, Supabase, Stripe, or a database migration.
- Added shared activity domain types in `types/index.ts` plus pure timeline helpers in `lib/activity/timeline.ts` for valid event types, limit/cursor normalization, update-event suppression, safe workspace hrefs, and newest-first paging.
- Added `lib/db/repositories/activity.ts` and exported `neonActivityRepository`; it derives capped activity from projects, conversations, user messages, files and knowledge status, artifacts, playbook runs, generated images, completed Model Duel records, custom assistants, and plan requests. All reads are scoped by authenticated `userId`; project filters remain project-scoped; raw cost, admin audit logs, provider secrets, and direct private file URLs are not exposed.
- Added protected `GET /api/activity` with `requireAuthenticatedUser`, profile hydration, project ownership validation, and `projectId`, `type`, `limit`, and `before` filters. Invalid type/limit/cursor returns `400`; foreign project filters return `404`.
- Added a server-rendered Activity Timeline card to `/dashboard` with project/type filters, compact chronological items, empty state, and links back to conversations/messages, Project Home, Artifact Studio, Ask Files, Prism Studio, Playbooks, Model Duel conversations, Custom Assistants, and Pricing.
- Added lightweight workspace deep-link handling in `lib/chat-context.tsx` so dashboard links can open conversations/messages or the relevant workspace tool after authenticated workspace hydration.
- Added Vitest coverage for activity helper behavior: mixed-source sorting, type/project/cursor/limit filtering, duplicate update suppression, event type validation, cursor/limit validation, and safe workspace link generation.
- Remaining risks: no seeded Neon `EXPLAIN ANALYZE`, cross-user fixture, or browser QA was run for the derived feed; project/tool deep links use existing workspace tool request support and do not yet focus every nested entity such as a specific playbook workflow row.
- Verification: `npm run test` passed with 15 files and 60 tests; `npm run typecheck` passed; `npm run lint` passed with the existing 11 warnings and 0 errors; `npm run build` passed with the known Node `module.register()` deprecation warning.

## 2026-06-16 - Artifact Export Pack V1

- Added server-backed Artifact Export Pack v1 for saved artifacts.
- Added pure export formatting helpers for Markdown, plain text, and JSON with safe filename sanitization, MIME type selection, and a JSON envelope that excludes `userId`.
- Added protected `GET /api/artifacts/[id]/export?format=markdown|text|json`, which requires the authenticated Neon session, reads artifacts through the user-scoped artifact repository, returns `404` for missing/foreign artifacts, returns `400` for unsupported formats, and sends attachment headers with `private, no-store` plus `nosniff`.
- Updated Artifact Studio to replace the single Markdown-only export button with an export dropdown. Saved artifacts now export Markdown, plain text, or JSON through the protected route; unsaved drafts keep local Markdown export only.
- Added focused Vitest coverage for export format validation, filename sanitization, Markdown/text content, and JSON export privacy.
- PDF export remains out of scope for v1 because the repo has PDF extraction support but no safe existing PDF generation pattern, and no new document-generation dependency was added.
- No database migration, external storage, Google Docs integration, Supabase, Stripe, billing, artifact editing, artifact versioning, search, or Project Home behavior changed.
- Verification: `npm run test` passed with 14 files and 55 tests; `npm run typecheck` passed; `npm run lint` passed with the existing 11 warnings and 0 errors; `npm run build` passed with the known Node `module.register()` deprecation warning; `git diff --check` passed.

## 2026-06-16 - Artifact Version History V1 Verification

- Verified the existing Artifact Version History implementation instead of duplicating schema or routes.
- Confirmed `neon/migrations/20260603_zenquanta_artifact_versions.sql` and `zenArtifactVersions` already provide the `zen_artifact_versions` table with artifact/user ownership, metadata snapshots, optional `created_by_action`, baseline backfill, and version lookup indexes.
- Confirmed artifact create and update paths write version snapshots transactionally, restore writes a new `restore_version` snapshot, and duplicate creates a new artifact plus its initial version snapshot.
- Confirmed applied Artifact Actions still follow the intended flow: `/api/artifacts/[id]/actions` performs a billed preview only, the UI stamps `metadata.lastArtifactAction` when the user applies the preview, and `created_by_action` is recorded only after the user explicitly saves the edited artifact.
- Confirmed protected version APIs remain present and user-scoped: `GET /api/artifacts/[id]/versions`, `POST /api/artifacts/[id]/versions/[versionId]/restore`, and `POST /api/artifacts/[id]/versions/[versionId]/duplicate`; missing or foreign artifacts/versions return `404`.
- Confirmed Project Home and global/project search continue to read current `zen_artifacts` rows rather than historical version rows, so restoring or duplicating updates the normal artifact surfaces without adding historical-version search noise.
- No runtime code, public route, response type, Supabase, Stripe, realtime collaboration, external storage, automatic AI call, or billing behavior changed in this pass.
- Verification: `npm run test` passed with 13 files and 49 tests; `npm run typecheck` passed; `npm run lint` passed with the existing 11 warnings and 0 errors; `npm run build` passed with the known Node `module.register()` deprecation warning; `git diff --check` passed.
- Remaining risk: seeded Neon/manual browser QA should still exercise create, edit, action apply/save, history preview, restore, duplicate, Project Home, and search together on a real account.

## 2026-06-16 - Large Conversation Performance And Persistence Safety Refresh

- Confirmed the current large-conversation foundations are already present: `/api/conversations` returns message-light shells, `/api/conversations/[id]?messageLimit=80` hydrates the newest page, `/api/conversations/[id]/messages` loads older pages, the chat UI exposes `Load older messages`, and older-page prepends preserve scroll position.
- Confirmed generation context is bounded before OpenRouter: conversation memory can be injected, only recent non-system messages are selected, per-message and total character caps are enforced, and the latest user request is preserved.
- Confirmed normal text sends persist with header/message upserts instead of delete-and-reinsert, streaming passes the request abort signal, stopped/failed generations persist safe assistant error state, and Pulse/file sources persist on assistant messages.
- Optimized conversation header refresh so saves aggregate message count, latest preview, token/cost totals, credits, and image count in SQL instead of selecting every message `usage` JSON payload for long conversations.
- Tightened admin user detail loading so admin detail uses message-light conversation rows, matching the current UI which only shows conversation count.
- Added pure unit coverage for mapping aggregate usage rows into the existing `UsageEstimate` shape.
- Updated stale project risk documentation that still described conversation saves as destructive full rewrites.
- Remaining risks: no seeded Neon `EXPLAIN ANALYZE` was run; multi-tab concurrent sends still rely on the client send queue and message upserts rather than a schema-backed send lease/version field; admin analytics still need aggregate/materialized reporting if production volume grows.
- Verification: `npm run test` passed with 13 files and 49 tests; `npm run typecheck` passed; `npm run lint` passed with the existing 11 warnings and 0 errors; `npm run build` passed with the known Node `module.register()` deprecation warning; `git diff --check` passed.

## 2026-06-16 - Incremental Database Performance And Indexing Pass

- Reviewed Neon/Drizzle query patterns across search, projects, conversations/messages, artifacts, prompt workflows/runs, Prism history, dashboard/admin analytics, Model Duel, custom assistants, files, attachments, and GitHub integration imports.
- Added forward-only migration `neon/migrations/20260616_zenquanta_incremental_performance_indexes.sql` for current high-frequency access paths:
  - b-tree indexes for project lists, file conversation lists, generated-image project/favorite history, usage and image event user/admin filters, plan request user/status history, GitHub imported-file project summaries, and message attachment JSON cleanup.
  - trigram indexes for existing ILIKE search fields not covered by the prior pass: project name/description, conversation memory summary, prompt workflow title/description, workflow step title/template, generated-image negative prompt, and custom assistant description.
- Mirrored representable b-tree indexes in `lib/db/schema.ts`; trigram and JSONB GIN indexes remain migration-only performance details.
- Improved query/list behavior without changing response shapes:
  - Capped prompt library, prompt workflow, custom assistant, and project repository list methods with conservative defaults and maximums.
  - Capped the admin plan-request list route to 200 rows by default and 1000 maximum while leaving internal analytics calls unbounded unless they pass a limit.
  - Replaced file deletion attachment cleanup so it queries only owned messages whose attachment JSON contains the deleted file id, instead of hydrating every conversation and every message for the user.
- Kept existing pagination unchanged for conversations, message pages, files, artifacts, Prism image history, search, and workflow runs because they already use limits/cursors.
- Remaining risks: no seeded Neon dataset or `EXPLAIN ANALYZE` proof was run in this pass; admin overview still performs broad in-memory product analytics and should move to aggregate SQL, cached summaries, or materialized reporting tables once production volume justifies it; JSONB metadata ILIKE search remains intentionally unindexed.
- Verification: `npm run typecheck` passed; `npm run lint` passed with the existing 11 warnings and 0 errors; `npm run build` passed with the known Node `module.register()` deprecation warning; `git diff --check` passed. `npm run test` was not run because this pass did not add or change test files.

## 2026-06-16 - User-Scope And Privacy Hardening Pass

- Reviewed route protection for `/api/search`, projects, conversations, artifacts, prompt workflows, prompts, custom assistants, model comparisons, images, attachments, protected file objects, dashboard, settings, admin routes, auth helpers, GitHub integration routes, and the relevant Neon repositories.
- Confirmed the core user-owned routes require `requireAuthenticatedUser`, admin APIs require `requireAdminApiUser`, and owned resource IDs are generally validated through user-scoped repository lookups before reads/writes.
- Confirmed private file reads go through `/api/files/object`, Prism history responses return protected private file URLs with `sourceUrl: null`, raw model cost/margin are scrubbed from normal user AI responses, and search queries remain scoped to `auth.user.id` with owned project validation.
- Issue found and fixed: `/api/integrations/github` returned the full GitHub account shape, including provider/internal fields such as `installationId` and `syncState`. Added a client-safe GitHub account serializer so status responses expose only display-safe connection fields.
- Added a unit test proving GitHub client status serialization omits installation IDs, sync metadata, provider/internal IDs, and private key values.
- Remaining risks: no seeded cross-user database fixtures or authenticated E2E tests currently prove ownership boundaries at runtime; keep authenticated workspace/search/integration leakage tests deferred until a safe Neon/session fixture exists.
- Verification: `npm run test` passed with 12 files and 47 tests; `npm run typecheck` passed; `npm run lint` passed with the existing 11 warnings and 0 errors; `npm run build` passed; `git diff --check` passed.

## 2026-06-16 - Stabilized Playwright Smoke Tests

- Stabilized the existing Playwright smoke suite instead of adding duplicate E2E infrastructure.
- Switched Playwright to a dedicated local dev server on `127.0.0.1:3100` and kept `npm run test:e2e` as `playwright test`.
- Updated route navigation helpers to wait for `domcontentloaded`, preserving smoke coverage for the unauthenticated auth gate, sign-in/sign-up forms, protected dashboard/pricing/admin redirects, and public assistant pages.
- Documented that authenticated workspace, command palette, and global search E2E remain deferred until a seeded Neon/session fixture exists; tests must not use `.env.local` secrets, production credentials, real API keys, Supabase, Stripe, or external services.
- Planning failure mode documented: the previous Playwright web server on port 3000 accepted connections but route requests hung, causing `page.goto` timeouts across all smoke routes.
- Verification: `npm run test:e2e` passed with 12 Chromium smoke tests after rerunning with local-server sandbox approval; `npm run test` passed with 11 files and 45 tests; `npm run typecheck` passed; `npm run lint` passed with the existing 11 warnings and 0 errors; `npm run build` passed; `git diff --check` passed.

## 2026-06-16 - Verified Automated Test Foundation

- Confirmed the lightweight Vitest unit-test foundation already exists with `npm run test`, `npm run test:watch`, `vitest.config.ts`, Node test environment, and the existing `@/` alias.
- Confirmed existing pure-helper coverage includes assistant routing/config, pricing/billing display helpers, prompt precheck/router behavior, file helpers, custom assistant validation, search result normalization, playbook variable interpolation, conversation/context helpers, artifact versions, storage/security, and user-scope security.
- Updated `AI_CHECKLIST.md` to state that unit tests must not require `.env.local` values or read/copy local secrets.
- No package scripts, dependencies, runtime code, Supabase, Stripe, external-service tests, or secret-dependent tests were added.
- Verification before this entry: `npm run test` passed with 11 files and 45 tests, `npm run typecheck` passed, and `npm run lint` passed with 11 existing warnings and 0 errors.

## 2026-06-16 - Refreshed Manual Product Smoke Test Checklist

- Updated `docs/manual-product-smoke-test.md` in place as the complete manual QA checklist for sign-up through advanced Zenquanta AI product flows.
- Refreshed the checklist metadata for the current `.env.local`/staging-safe workflow and Neon migrations through `20260603_zenquanta_performance_indexes.sql`.
- Added standalone manual smoke coverage for onboarding/starter packs, authenticated password update/reset behavior, Model Duel, and Memory Vault.
- Tightened regression checks for text/image route separation, private file route protection, user-scoped search/data access, GitHub read-only behavior, and manual plan/admin activation without Stripe/payment automation.
- No runtime code changed.

## 2026-06-16 - Aligned Environment Docs With `.env.local`

- Updated repo workflow docs to treat `.env.local` as the intentional local-only development env file and to avoid restoring or committing `.env.example` unless explicitly requested.
- Updated setup/checklist language to create or edit `.env.local` directly, while keeping env examples as non-secret placeholder key references only.
- Added the artifact version history and performance index Neon migrations to the checklist migration list.
- No product code changed. The previous post-feature audit found no required product-code fixes; the remaining work from that pass was stale environment/setup documentation.
- Verification plan for this docs-only cleanup: `rg -n "\\.env\\.example" README.md AI_CHECKLIST.md AGENTS.md CLAUDE.md AI_TASK_LOG.md AI_PROJECT.md AI_DECISIONS.md`, `git diff --check`, and `git status -sb`.

## 2026-06-16 - Post-Feature Product Audit

- Performed a documentation-only audit of the recent Zenquanta AI feature wave across the required project docs, Neon schema/migrations/repositories, chat context, API routes, chat/admin/ui components, auth, billing, storage, RAG, search, and config modules.
- No product code was changed. Follow-up env documentation now records that `.env.local` is the local-only development env file and `.env.example` should not be restored unless explicitly requested.

| Feature name | Status | Main files involved | API routes involved | Database tables/migrations involved | User-facing UI entry point | Known risks | Recommended follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Command palette | Implemented | `components/chat/command-palette.tsx`, `components/chat/chat-layout.tsx`, `components/chat/header.tsx`, `lib/chat-context.tsx` | `/api/search` | Searches Neon user rows across conversations, messages, artifacts, prompts, files, generated images, model comparisons, custom assistants; `20260603_zenquanta_performance_indexes.sql` | Header search button and Cmd/Ctrl+K workspace palette | Depends on authenticated search responses; no seeded browser E2E in this audit | Add authenticated command-palette E2E coverage for opening each result/action type |
| Global search | Implemented | `app/api/search/route.ts`, `lib/db/repositories/search.ts`, `components/chat/command-palette.tsx` | `/api/search` | User-scoped Neon search over conversation, message, artifact, prompt, file, image, model comparison, and custom assistant tables | Command palette global search mode | Results include content snippets, so session/auth leakage tests matter | Add fixtures proving one user cannot see another user's snippets or rows |
| Onboarding and starter packs | Implemented | `components/chat/onboarding-dialog.tsx`, `app/api/onboarding/route.ts`, `lib/config/onboarding.ts` | `/api/onboarding` | `zen_user_settings`, `zen_projects`, `zen_prompt_library` | First-run onboarding dialog | Repeat-completion/idempotency was not browser-tested here | Add onboarding repeat-run and starter-pack creation tests |
| Project Home | Implemented | `components/chat/project-home.tsx`, `app/api/projects/[id]/home/route.ts`, `lib/db/repositories/project-home.ts` | `/api/projects/[id]/home` | `zen_projects`, `zen_conversations`, `zen_files`, `zen_generated_images`, `zen_prompt_workflows`, `zen_artifacts`, `zen_integration_items` | Project panel/home surface in workspace | Route has a harmless extra project-list query; no seeded project-home QA | Remove redundant query and add project-home fixture coverage |
| Project-specific search | Implemented | `components/chat/command-palette.tsx`, `components/chat/project-home.tsx`, `app/api/search/route.ts`, `lib/db/repositories/search.ts` | `/api/search?projectId=...` | Same search tables with owned project validation; `20260603_zenquanta_performance_indexes.sql` | Project Home search action and command palette project scope | Project scope excludes non-project-owned resources such as reusable prompts/custom assistants by design | Add leakage tests for foreign `projectId` and document scoped result behavior |
| Artifact Studio | Implemented | `components/chat/artifact-studio.tsx`, `app/api/artifacts/*`, `lib/db/repositories/artifacts.ts` | `/api/artifacts`, `/api/artifacts/[id]`, `/api/artifacts/[id]/versions`, restore, duplicate | `zen_artifacts`, `zen_artifact_versions`; `20260526_zenquanta_artifacts.sql`, `20260603_zenquanta_artifact_versions.sql` | Artifact Studio panel and save/open artifact actions | Version behavior was not seeded-Neon/browser-tested here | Add version history restore/duplicate integration QA |
| Artifact actions | Implemented | `app/api/artifacts/[id]/actions/route.ts`, `components/chat/artifact-studio.tsx`, `lib/ai/chat.ts`, `lib/billing/*` | `/api/artifacts/[id]/actions` | `zen_artifacts`, `zen_usage_events` | Artifact Studio action controls | Action previews are billed AI outputs but not automatically persisted | Add UX tests for preview, apply, and save-as-version flow |
| AI Playbooks | Implemented | `components/chat/playbook-studio.tsx`, `app/api/prompt-workflows/*`, `lib/db/repositories/prompt-workflows.ts` | `/api/prompt-workflows`, `/api/prompt-workflows/[id]`, `/api/prompt-workflows/[id]/runs` | `zen_prompt_workflows`, `zen_prompt_workflow_steps`, `zen_prompt_workflow_runs`, `zen_prompt_workflow_step_runs`; `20260522_zenquanta_prompt_workflows.sql` | Playbook Studio and workspace actions | V1 runs foreground queued chat/image actions, not a background automation engine | Add recovery/partial-run QA for foreground execution |
| Playbook Builder improvements | Implemented | `components/chat/playbook-studio.tsx`, `lib/config/playbook-templates.ts`, prompt workflow repository | `/api/prompt-workflows*` | Prompt workflow metadata JSON; `20260528_zenquanta_playbook_builder_metadata.sql` | Playbook Builder/Studio | Metadata is flexible JSON and usage estimates are qualitative | Add validation tests for builder metadata and template loading |
| Smart Assistant Router | Implemented | `lib/router/*`, `hooks/usePromptPrecheck.ts`, `components/chat/smart-router-dialog.tsx`, `components/chat/assistant-recommendation-chip.tsx` | `/api/assistant-recommendations` | `zen_assistant_recommendation_events` | Composer recommendation chip/dialog | Rule quality can be noisy; telemetry is useful but not proof of routing accuracy | Review telemetry and add suppression/acceptance heuristics after real usage |
| Assistant Handoffs | Implemented | `lib/config/assistant-handoffs.ts`, `components/chat/message.tsx`, `lib/chat-context.tsx` | Existing `/api/chat` or `/api/images/generate` paths | Normal conversation/message/usage tables | Message-level handoff menu | Handoffs are not separately tracked as analytics events | Add optional handoff telemetry if product decisions need it |
| Quality-check actions | Implemented | `lib/config/assistant-quality-actions.ts`, `components/chat/message.tsx`, `lib/chat-context.tsx` | Existing `/api/chat` or `/api/images/generate` paths | Normal conversation/message/usage tables | Message quality/action menu | Action provenance is mostly prompt/content based, not structured metadata | Add lightweight action metadata if auditability becomes important |
| Memory Vault | Implemented | `components/chat/memory-vault.tsx`, `app/api/memory-vault/route.ts`, `app/api/conversations/[id]/memory/route.ts`, `lib/db/repositories/memory-vault.ts` | `/api/memory-vault`, `/api/conversations/[id]/memory` | `zen_conversations.memory_summary`, `memory_updated_at`, `session_settings` | Memory Vault panel and conversation memory controls | Memory is conversation-derived and should not become hidden global preference memory without a privacy design | Add explicit preference-memory design only if requested later |
| Model Duel | Implemented | `components/chat/model-comparison-button.tsx`, `app/api/model-comparisons/*`, `lib/db/repositories/model-comparisons.ts` | `/api/model-comparisons`, `/api/model-comparisons/[id]/choose` | `zen_model_comparisons`, `zen_model_comparison_candidates`; `20260522_zenquanta_model_comparisons.sql` | Composer Model Duel button | Text-only by design; first-action flow was not browser-tested in this audit | Add seeded QA for brand-new conversation Model Duel and candidate billing |
| Prism Studio | Implemented | `components/chat/prism-studio.tsx`, `app/api/images/history/*`, `app/api/images/generate/route.ts`, `lib/db/repositories/generated-images.ts` | `/api/images/generate`, `/api/images/history`, `/api/images/history/[id]` | `zen_generated_images`, `zen_image_generation_events`; `20260528_zenquanta_prism_studio_metadata.sql` | Prism Studio panel and Prism assistant flow | Requires storage health for protected URLs; gallery pagination/assets were not manually inspected here | Add gallery asset-health QA against production-like object storage |
| Pulse Research Room | Implemented | `components/chat/pulse-research-room.tsx`, `app/api/pulse/research-room/route.ts`, `lib/db/repositories/pulse-research.ts`, `lib/search/web-search.ts` | `/api/pulse/research-room`, plus `/api/chat` when sending research prompts | `zen_messages.sources`, conversations, artifacts as saved outputs | Pulse Research Room panel | Tavily absence degrades search capability; source-history UX needs real API QA | Add source-history tests with and without `TAVILY_API_KEY` |
| File Intelligence Cards | Implemented | `components/chat/file-intelligence-card.tsx`, `app/api/files/*`, `lib/db/repositories/files.ts`, `lib/rag/*` | `/api/files`, `/api/files/[id]`, `/api/files/[id]/reindex`, `/api/files/object` | `zen_files`, `zen_file_chunks`; `20260522_zenquanta_file_knowledge.sql` | File cards in attachments/project/file panels | GitHub external files intentionally have no object-store download URL | Improve external-file states and add bulk/file-manager QA |
| Ask Files | Implemented | `components/chat/ask-files-panel.tsx`, `lib/chat-context.tsx`, `lib/rag/retrieval.ts`, `/api/chat` file-context handling | `/api/files`, `/api/chat` | `zen_files`, `zen_file_chunks` | Ask Files panel and file-context composer flow | Quality depends on extracted chunks and embedding config; large selected-file sets need caps | Add selected-file cap UX and citation display checks |
| PDF text extraction without OCR | Implemented | `lib/rag/extraction.ts`, `lib/rag/indexing.ts`, `lib/utils/files.ts` | Upload/reindex paths through `/api/attachments`, `/api/files/[id]/reindex`, and `/api/chat` retrieval | `zen_files.metadata.knowledgeBase`, `zen_file_chunks` | File upload, File Intelligence Card, Ask Files | Scanned/image-only or password-protected PDFs remain unsupported by design | Add OCR as a separate future milestone with explicit cost/privacy decisions |
| Usage transparency | Implemented | `components/chat/usage-transparency-hint.tsx`, `app/api/dashboard/route.ts`, `lib/billing/*` | `/api/dashboard`, normal AI action routes | `zen_subscriptions`, `zen_usage_events`, `zen_image_generation_events`, `zen_plan_change_requests` | Composer usage hint, dashboard, pricing surfaces | Composer hint is qualitative and not a binding quote | Calibrate labels against real usage data after launch |
| Upgrade nudges | Implemented | `components/chat/upgrade-nudges.tsx`, `app/pricing/page.tsx`, `app/dashboard/page.tsx`, `app/api/plan-requests/route.ts` | `/api/plan-requests`, `/api/dashboard` | `zen_plan_change_requests`, `zen_subscriptions`, usage tables | Composer/errors, pricing, dashboard | Dismissal/visibility behavior may be session-local depending on surface | Add persistent nudge dismissal only if it improves UX |
| Admin product analytics | Implemented | `app/admin/page.tsx`, `components/admin/*`, `app/api/admin/overview/route.ts`, `lib/db/repositories/admin.ts` | `/api/admin/overview`, `/api/admin/users`, `/api/admin/plan-requests` | Profiles, subscriptions, usage, image events, projects, files, workflows, comparisons, custom assistants, plan requests | `/admin` | Request-time aggregation may get heavy with large datasets | Add caching or materialized summaries once production volume justifies it |
| Custom Assistant Builder v2 | Implemented | `components/chat/custom-assistant-button.tsx`, `app/api/custom-assistants/*`, `lib/db/repositories/custom-assistants.ts`, `lib/config/custom-assistants.ts` | `/api/custom-assistants`, `/api/custom-assistants/[id]`, `/api/custom-assistants/test` | `zen_custom_assistants`; `20260525_zenquanta_custom_assistants.sql`, `20260528_zenquanta_custom_assistant_builder_v2.sql` | Composer private assistant builder | Text-only/private by design; prompt-library references live in metadata | Add project-scoping/sharing only as an explicit future feature |
| Integration architecture planning | Implemented | `AI_DECISIONS.md`, `AI_PROJECT.md`, `AI_CHECKLIST.md`, `AI_TASK_LOG.md` | None for planning itself | Planning plus `zen_integration_accounts`, `zen_integration_items` for GitHub | Docs and GitHub panel | Roadmap/docs can drift because GitHub shipped before broader provider rollout | Reconcile roadmap and token-encryption policy before adding more providers |
| GitHub read-only integration | Implemented | `components/chat/github-integration-panel.tsx`, `app/api/integrations/github/*`, `lib/integrations/github.ts`, `lib/integrations/github-import.ts`, `lib/db/repositories/integrations.ts` | `/api/integrations/github/connect`, `/callback`, `/repositories`, `/repository`, `/import`, `/status` | `zen_integration_accounts`, `zen_integration_items`, imported `zen_files`/`zen_file_chunks`; `20260528_zenquanta_github_readonly_integrations.sql` | GitHub integration panel, Project Home imported context | Current code is read-only; external App configuration and removal flows still need production QA | Validate GitHub App permissions in production and add imported-content remove/disconnect UX |

Cross-cutting audit checks:

- User scoping: new protected routes use `requireAuthenticatedUser`, project filters validate owned projects, search uses `userId` filters, file object reads verify owned private metadata before object-store access, and admin routes use `requireAdminApiUser`.
- Neon repositories: audited feature routes call the fresh Neon repository layer rather than Supabase runtime clients. No runtime Supabase client reintroduction was found outside historical docs/migrations.
- Billing: `/api/chat`, `/api/images/generate`, artifact actions, Model Duel candidates, and custom assistant tests enforce/log usage. Playbooks, handoffs, and quality actions dispatch through the existing billed chat/image paths. Normal user responses scrub `rawCostUsd` and `marginUsd`.
- Prism separation: `/api/chat` rejects image/Prism requests and keeps image generation on `/api/images/generate`.
- Private files: private file reads go through `/api/files/object`; generated image history returns protected file URLs and hides source URLs; global/project search is auth-protected and user-scoped.
- GitHub integration: route surface is read-only repository listing/summary/import. No GitHub write route was found; installation tokens appear short-lived and `encrypted_token_payload` is currently not persisted.
- Admin/raw cost boundaries: raw cost and margin analytics are exposed through admin repository/routes/pages only; normal dashboard/pricing surfaces use displayed usage summaries.
- Payments: no Stripe checkout, webhooks, customer portal, or payment automation was found; manual plan requests/admin activation remain the current billing workflow.

Verification:

- `npm run typecheck` passed.
- `npm run lint` passed with 11 existing warnings: two raw `<img>` warnings, several unused symbol warnings in chat/UI/db utilities, and two `actionTypes` type-only warnings.
- `npm run build` passed with the known Node `module.register()` deprecation warning under Next.js 16.2.0/Turbopack.
- Runtime browser QA and seeded Neon integration tests were not performed in this audit.

## 2026-06-11 - Fixed New-Conversation 404 In Prism And Model Duel

- Audited every Neon-backed API route for the same premature-404 pattern fixed in `/api/chat` (client-generated `conversationId` for a not-yet-persisted conversation rejected before create/upsert can run). Artifacts, projects, prompts/workflows, files, Pulse research room, GitHub integration, and custom assistants only ever operate on server-issued IDs and were unaffected.
- `app/api/images/generate/route.ts`: applied the same `&& !body?.conversation` exemption as `/api/chat`, so a brand-new conversation's first Prism request no longer 404s before `resolveConversation`/`save` can persist it.
- `app/api/model-comparisons/route.ts`: the client (`runModelComparison` in `lib/chat-context.tsx`) never sent a `conversation` payload at all, so it always 404'd on a brand-new conversation's first Model Duel run. Added `conversation?: Conversation` to `ModelComparisonRequest` (`types/index.ts`), had the client send `conversation: currentChatRef.current ?? undefined`, and mirrored the route's `projectScope`/`scopedConversation`/404-exemption handling from `/api/chat` so new conversations persist correctly.
- Verification: `npm run typecheck` passed.
- Remaining risk: should manually verify in the browser that running Prism or Model Duel as the very first action in a brand-new chat persists the conversation without "Conversation not found."

## 2026-06-11 - Fixed New-Conversation 404 In Chat Send

- Fixed `/api/chat` returning `Conversation not found.` (404) for every first message of a brand-new conversation. The user-scoping check added in `8b7c7e0` ("tighten user scoped route validation") rejected client-generated `conversationId`s before `saveTurnStart` could create the row via `upsertConversationHeader`.
- `app/api/chat/route.ts`: the early 404 now only fires when `body.conversationId` is set, no stored conversation exists, and the request also lacks a `body.conversation` seed payload (mirroring the existing `projectScope` fallback at the same spot). New conversations with a `conversation` payload now pass through and persist normally.
- This also explains the "pressing Enter doesn't send" symptom: the composer's Enter handler was correct, but the resulting `/api/chat` request errored immediately on new chats, surfacing as a failed/erroring response.
- Verification: `npm run typecheck` passed.
- Remaining risk: should manually verify in the browser that starting a brand-new chat now persists and shows up in the sidebar/history without the "Conversation not found." error.

## 2026-06-10 - Responsive Workspace Composer And Chat Flow

- Compacted the workspace header/sidebar controls for small screens, including smaller hamburger buttons, tighter header spacing, hidden secondary actions on mobile, and a capped sidebar width that cannot consume the full viewport.
- Reworked the composer layout so the textarea, tool controls, and send/stop actions stack naturally on mobile instead of overlapping; the tool row now scrolls horizontally, the send action becomes compact on small screens, and mobile keyboard-helper text is hidden.
- Reduced the mobile footprint of the usage transparency hint and improved chat message wrapping/widths so long text, code, and attachments stay inside the viewport.
- Updated chat scrolling so a new assistant response scrolls to the top of that response, streaming does not keep forcing the viewport downward while the user reads, and loading older messages preserves the current scroll position.
- Fixed a runtime Drizzle schema mismatch where assistant recommendation events tried to insert an unused `project_id` column that the fresh Neon migration does not create.
- Verification: `npm run typecheck` passed; `npm run lint` passed with the existing 11 warnings; `curl http://localhost:3000/` returned 200 while the dev server was running.
- Remaining risk: real-device QA should still test a long streaming response on a narrow screen to tune exact scroll offset and composer height if needed.

## 2026-06-10 - Nested Button Hydration Fix

- Fixed a React/Next hydration warning caused by full-card `<button>` elements wrapping Radix `Checkbox` buttons.
- Converted the onboarding starter-project/starter-prompts cards, Model Duel assistant selection cards, and GitHub import file rows to keyboard-accessible `div role="button"` wrappers while preserving click and Enter/Space toggling behavior.
- Verification: `npm run typecheck` passed; `npm run lint` passed with the existing 12 warnings.
- Remaining risk: browser-level manual QA should confirm each patched card still toggles as expected in its dialog.

## 2026-06-07 - 20-Commit GitHub Publish Handoff

- Prepared the 2026-06-03 artifact version history, large-conversation performance/persistence, and database performance/indexing progress for a deliberate 20-commit publish to `origin/main`.
- Scope for the publish: artifact version migrations/APIs/UI, conversation message paging and incremental persistence, bounded chat context, query caps/indexes for dashboard/admin/files/images/artifacts, focused tests, and the project task log entries above.
- Verification before slicing: `npm run test` passed with 11 files and 45 tests; `npm run typecheck` passed; `npm run lint` passed with the existing 12 warnings; `npm run build` passed with the known Node `module.register()` deprecation warning.
- GitHub note: `gh auth status` reports an invalid token, so this handoff uses direct `git push` to `origin/main` instead of GitHub CLI PR operations.

## 2026-06-03 - Artifact Version History V1

- Added Artifact Version History for saved artifacts:
  - New forward-only migration `neon/migrations/20260603_zenquanta_artifact_versions.sql` creates `zen_artifact_versions`, indexes user/artifact history lookups, and backfills one baseline version per existing artifact.
  - Drizzle schema now includes `zenArtifactVersions` with artifact/user cascade ownership and artifact-type validation.
  - Artifact repository create/update paths now write version snapshots transactionally after successful artifact writes, so all existing save-as-artifact surfaces are covered.
  - Artifact action preview remains unchanged and does not call AI or save automatically; once the user applies the preview and clicks Save, the update snapshot records `metadata.lastArtifactAction.actionType` as `created_by_action`.
- Added protected version APIs:
  - `GET /api/artifacts/[id]/versions`
  - `POST /api/artifacts/[id]/versions/[versionId]/restore`
  - `POST /api/artifacts/[id]/versions/[versionId]/duplicate`
  - Routes require authenticated users and use repository-level `userId` scoping; missing or foreign artifacts/versions return `404`.
- Updated Artifact Studio:
  - Saved artifacts now expose a History button.
  - Users can view version timestamps, artifact type, content length, action label, content, and metadata.
  - Users can copy version content, restore a version into the current artifact, or duplicate a version as a separate artifact.
- Added shared version response types and chat-context helpers for listing/restoring/duplicating versions.
- Added unit coverage for artifact-version action extraction.
- Verification: `npm run test` passed with 11 files and 45 tests; `npm run typecheck` passed; `npm run lint` passed with the existing 12 warnings; `npm run build` passed with the known Node `module.register()` deprecation warning.
- Remaining risks: runtime version backfill/restore/duplicate behavior still needs seeded Neon manual QA; version diffs are metadata/time/content preview only, not a side-by-side textual diff.

## 2026-06-03 - Large Conversation Performance And Persistence Safety

- Implemented hybrid large-conversation loading:
  - `/api/conversations` now returns lightweight conversation shells by default with preserved preview/message counts and empty `messages`.
  - `/api/conversations/[id]?messageLimit=80` returns the newest message page for normal workspace opens.
  - Added `GET /api/conversations/[id]/messages?limit=80&before=...` for older-message pagination.
  - Added optional `messagePageInfo` to conversations so the UI knows loaded count, total count, older-page cursor, and whether more history exists.
- Updated workspace behavior:
  - Initial workspace restore uses shells, then hydrates the remembered active conversation with the latest 80 messages.
  - Selecting/opening a shell conversation loads the newest message page on demand.
  - Chat area now shows a `Load older messages` control when an older-page cursor exists.
  - Sidebar local filtering now uses title, preview, project name, and attachment names; full message search remains the Neon-backed global/project search path.
- Replaced destructive message persistence for normal chat/image sends:
  - Conversation saves now upsert headers/messages instead of deleting and reinserting all messages.
  - Chat and Prism generation persist the user message plus streaming placeholder first, then update the same assistant message on completion.
  - Retry/regenerate/edit flows delete only the intended message tail before writing the new placeholder.
  - Mid-stream failures or user stops mark the persisted assistant placeholder as `error` with safe text and any partial content/sources.
- Added explicit context guards:
  - OpenRouter text context still uses memory plus recent turns, now bounded by per-message and total character caps while always preserving the latest user request.
  - `/api/chat` and `/api/images/generate` load only the newest stored message page for existing conversations and ignore client-sent conversation bodies for stored conversation context.
  - Text streaming now passes the route abort signal into the OpenRouter streaming helper.
- Added unit coverage for message-page merge/dedupe helpers and bounded context selection.
- Verification: `npm run test` passed with 10 files and 42 tests; `npm run typecheck` passed; `npm run lint` passed with the existing 12 warnings; `npm run build` passed with the known Node `module.register()` deprecation warning.
- Remaining risks: repository-level runtime behavior for tail deletion and partial failure persistence still needs seeded Neon integration tests; UI scroll-position preservation after prepending older pages is basic and may need refinement after manual QA with very long histories.

## 2026-06-03 - Database Performance And Indexing Pass

- Added forward-only Neon migration `neon/migrations/20260603_zenquanta_performance_indexes.sql`.
- Indexes added:
  - Scoped recent lists: conversations by user/project/updated and user/assistant/updated, files by user/project/created, playbooks by user/project/updated, playbook runs by user/project/created, Model Duel comparisons by user/project/created, and integration items by user/project/status/import time.
  - Billing/admin filters: usage events by subscription/created and assistant/created, image generation events by subscription/created and model/created, plan requests by status/updated.
  - Private object lookup: files by user/bucket/storage path.
  - Existing ILIKE search paths: enabled `pg_trgm` and added GIN trigram indexes for conversation title/preview, message content, artifact title/content, prompt title/content, file name, generated-image prompt, Model Duel prompt, and custom-assistant name/instructions.
- Mirrored representable b-tree indexes in `lib/db/schema.ts`; trigram/opclass indexes remain migration-only because they are search-performance details rather than table-shape metadata.
- Query and pagination changes:
  - `neonConversationRepository.list` now supports `projectId`, `limit`, `beforeUpdatedAt`, and optional message hydration; `GET /api/conversations` defaults to the latest 100 conversations while preserving the array response shape and full message hydration.
  - `GET /api/images/history` supports `limit` and `before`, defaults Prism Studio history to 80 rows, and fetches usage details only for the returned image message ids.
  - `GET /api/files` supports `limit` and `before`, defaults File Intelligence/Ask Files listing to 100 rows, and applies the cap in SQL.
  - `GET /api/artifacts` supports `limit` and `beforeUpdatedAt`/`before`, keeping the existing max cap of 100 rows.
  - Dashboard API and dashboard page now fetch current-subscription-period usage/image rows and only the recent conversations/image summaries needed for display instead of loading all user history.
  - Admin overview/user rows now resolve plan/user filters first, then fetch user-scoped usage/image events and user-scoped product rows; workflow step runs, Model Duel candidates, and source-backed messages are loaded by scoped parent ids.
  - Pulse Research Room now limits the recent conversation scan in SQL before fetching capped message/source rows.
- Remaining risks: admin activation-funnel semantics still need all-time rows for some "first event" calculations, so product tables are user-scoped but not aggressively date-pruned everywhere; full query-plan proof needs seeded Neon data and `EXPLAIN ANALYZE` outside this code-only pass.
- Verification: `npm run typecheck` passed; `npm run lint` passed with the existing 12 warnings; `npm run build` passed with the known Node `module.register()` deprecation warning.

## 2026-06-03 - File And Object Storage Security Hardening

- Reviewed private upload, generated image storage, protected file reads, file indexing/RAG, File Intelligence/Ask Files surfaces, Prism Studio gallery responses, file deletion/re-index APIs, and GitHub read-only import paths.
- Findings:
  - Protected file reads already checked Neon file ownership before object-store access, and direct object URLs were not exposed through File Intelligence or Prism Studio.
  - Uploads had a 25MB helper limit, but route-level size rejection and shared MIME/data URL/object-ref validation could be tighter.
  - Generated image ingestion rejected obvious non-HTTPS/private IPv4 URLs, but needed stronger data URL validation, image MIME checks, response size checks, and safer stored source URL validation.
  - File indexing failures were safe in UI, but persisted metadata could store raw exception messages.
  - GitHub imports were size-limited and user/project-scoped, but repo paths and skipped error reasons needed stricter normalization/scrubbing.
- Fixes made:
  - Added `lib/storage/security.ts` with shared private-file size caps, MIME normalization, object bucket/key validation, object ref validation, and strict base64 data URL parsing.
  - Enforced safe object refs in `lib/storage/object-store.ts` for local and S3/R2 put/get/delete URL construction and protected app URL creation.
  - Hardened `/api/attachments` and `lib/storage/attachments.ts` with early 25MB rejection, normalized MIME types, and strict imported data URL parsing while preserving unsupported-file upload behavior.
  - Hardened generated-image ingestion in `lib/storage/generated-images.ts` with valid image data URL parsing, HTTPS/non-private URL checks, image response MIME checks, content-length/body size caps, and safe stored `sourceUrl` handling.
  - Updated protected file reads to validate bucket/path params and use stored file names for `Content-Disposition` instead of internal object keys.
  - Made conversation, file intelligence, file chunk, Project Home, and Prism gallery URL hydration tolerant of legacy malformed object refs by omitting protected URLs instead of throwing.
  - Changed RAG indexing failure metadata to store a generic safe reason rather than raw provider/parser exception text.
  - Added GitHub repo path normalization to reject absolute, traversal, backslash, control-character, and malformed paths before listing/fetch/import, and scrubbed raw provider errors from GitHub import skipped reasons.
  - Tightened `/api/files` mixed project/conversation scope validation for Ask Files/File Intelligence listing.
  - Added Vitest coverage for storage security helpers.
- Verification: `npm run test` passed with 8 files and 38 tests; `npm run typecheck` passed; `npm run lint` passed with the existing 12 warnings; `npm run build` passed with the known Node `module.register()` deprecation warning.
- Remaining risks: full runtime proof for private object access, generated-image remote fetch behavior, and GitHub provider failures still needs seeded integration/storage fixtures; this pass keeps those paths foreground, user-scoped, and server-token-only.

## 2026-06-03 - User Scope And Privacy Hardening Pass

- Reviewed protected API route families across search, projects, conversations, artifacts, prompt workflows/AI Playbooks, prompts, custom assistants, Model Duel, Prism/images, attachments/files, dashboard/settings, admin, memory, Pulse, and GitHub integration routes.
- Confirmed safe boundaries that remain in place: normal feature routes use `requireAuthenticatedUser`, admin APIs use `requireAdminApiUser`, search repositories are user-scoped, private file reads stay behind `/api/files/object`, Prism stays on `/api/images/generate`, GitHub integration remains read-only/server-token-only, and admin raw-cost analytics remain admin-only.
- Issues found and fixed:
  - Scrubbed `/api/dashboard` `recentImages` so normal-user responses return safe summaries instead of raw `ImageGenerationEvent` rows with raw cost, margin, or private output URL arrays.
  - Scrubbed `/api/images/history` and `/api/images/history/[id]` so Prism Studio receives protected app image URLs only and does not receive stored provider/source URLs.
  - Validated conversation create/update `projectId` ownership before persisting, preserving `project-inbox` through the owned default-project path.
  - Added early `404` checks in `/api/chat` and `/api/images/generate` when a supplied `conversationId` is missing or foreign, and validated client-supplied new conversation project scope before generation/persistence.
  - Validated AI Playbook create/update `projectId` ownership before repository writes.
  - Tightened mixed `projectId` plus `conversationId` inputs for attachments and playbook runs so both IDs must be owned and the conversation must belong to the supplied project.
- Added `SECURITY_CHECKLIST.md` with route protection expectations for auth, ownership, private file/image URLs, billing/cost data, integrations/secrets, search, and memory.
- Added focused Vitest coverage for safe dashboard image mapping and project/conversation scope helpers.
- Verification: `npm run test` passed with 7 files and 33 tests; `npm run typecheck` passed; `npm run lint` passed with the existing 12 warnings; `npm run build` passed with the known Node `module.register()` deprecation warning.
- Remaining risks: dynamic cross-user route checks still need seeded Neon/API fixtures for full runtime coverage; this pass used code review plus pure unit tests for the highest-risk response mapping and scope-validation seams.

## Post-Feature Product Audit - 2026-06-02

Documentation-only audit after the recent feature wave. No product features, routes, APIs, auth, billing, storage, styling, dependencies, or runtime behavior were changed for this audit.

| Feature | Status | Main files involved | API routes involved | Database tables / migrations | UI entry point | Known risks | Recommended follow-up |
|---|---|---|---|---|---|---|---|
| Command palette | Implemented | `components/chat/command-palette.tsx`, `components/chat/chat-layout.tsx`, `lib/chat-context.tsx` | Uses `/api/search` for workspace search; navigates existing routes | No dedicated migration | Cmd/Ctrl+K in authenticated workspace | Palette now owns many workspace tool entry points, so regressions can affect navigation broadly | Add focused keyboard/navigation tests and keep command labels synced with feature names |
| Global search | Implemented | `lib/db/repositories/search.ts`, `app/api/search/route.ts`, `components/chat/command-palette.tsx` | `GET /api/search` | Existing Neon tables across projects, conversations, messages, artifacts, prompts, workflows, assistants, files, images, comparisons | Command palette search | Simple ILIKE search, no ranking/indexing strategy yet | Add Postgres full-text indexes/ranking after usage patterns settle |
| Onboarding and starter packs | Implemented | `app/api/onboarding/route.ts`, `components/chat/onboarding-dialog.tsx`, `lib/config/onboarding.ts`, `lib/chat-context.tsx` | `POST /api/onboarding`, `/api/settings` | `zen_user_settings` JSONB; optional `zen_projects`, `zen_prompt_library` | First authenticated empty workspace; Settings reopen action | State lives in settings JSON, so schema is flexible but less queryable | Add analytics for completion/skip and starter-pack usefulness |
| Project Home | Implemented | `components/chat/project-home.tsx`, `lib/db/repositories/project-home.ts`, `app/api/projects/[id]/home/route.ts` | `GET /api/projects/[id]/home` | Aggregates `zen_projects`, `zen_conversations`, `zen_files`, `zen_generated_images`, `zen_prompt_workflows`, `zen_artifacts`, integration items | Project selector/sidebar explicit home action | Aggregate query breadth grows as feature count grows | Add pagination/lazy section loading if project data becomes large |
| Project-specific search | Implemented | `lib/db/repositories/search.ts`, `app/api/search/route.ts`, `components/chat/command-palette.tsx` | `GET /api/search?q=&projectId=` | Existing project-scoped Neon tables | Command palette scope toggle; Project Home search action | Prompt library/custom assistants remain global-only because they have no `projectId` | Consider project association for prompts/assistants before expanding scope |
| Artifact Studio | Implemented | `components/chat/artifact-studio.tsx`, `lib/db/repositories/artifacts.ts`, `lib/artifacts/validation.ts` | `GET/POST /api/artifacts`, `GET/PATCH/DELETE /api/artifacts/[id]` | `zen_artifacts`; `20260526_zenquanta_artifacts.sql` | Workspace Artifact Studio, message actions, command palette, Project Home | No version history or rich editor; content stored as text | Add lightweight revisions/version restore before collaborative editing |
| Artifact actions | Implemented | `app/api/artifacts/[id]/actions/route.ts`, `lib/artifacts/actions.ts`, `components/chat/artifact-studio.tsx` | `POST /api/artifacts/[id]/actions` | `zen_artifacts`, `zen_usage_events` | Artifact Studio action preview panel | Preview is not persisted; over-limit users depend on existing billing errors | Add optional save-as-new-version once artifact revisions exist |
| AI Playbooks | Implemented | `components/chat/playbook-studio.tsx`, `lib/db/repositories/prompt-workflows.ts`, `lib/config/playbook-templates.ts` | `/api/prompt-workflows`, `/api/prompt-workflows/[id]`, `/api/prompt-workflows/[id]/runs` | `zen_prompt_workflows`, steps, runs, step runs; prompt workflow migrations | Composer, command palette, Project Home | Foreground execution only; no durable background automation | Add clearer run recovery for interrupted foreground sessions |
| Playbook Builder improvements | Implemented | `components/chat/playbook-studio.tsx`, `lib/utils/prompt-workflows.ts`, `lib/db/repositories/prompt-workflows.ts` | Existing `/api/prompt-workflows*` routes | `zen_prompt_workflows.metadata`; `20260528_zenquanta_playbook_builder_metadata.sql` | Playbook Studio builder | Usage estimate is qualitative only; metadata remains JSONB | Add validation/UI tests for variables, previous-output chaining, and preview |
| Smart Assistant Router | Implemented | `hooks/usePromptPrecheck.ts`, `components/chat/assistant-recommendation-chip.tsx`, `lib/router/*`, `components/chat/composer.tsx` | `POST /api/assistant-recommendations` telemetry | `zen_assistant_recommendation_events` | Composer recommendation chip and send-time fallback | Rule-based recommendations can be noisy for ambiguous prompts | Add telemetry review loop and per-user suppression controls |
| Assistant Handoffs | Implemented | `components/chat/message.tsx`, `lib/assistant-handoffs.ts`, `lib/chat-context.tsx` | Existing `/api/chat` or `/api/images/generate` through send pipeline | Normal conversations/messages and usage events | Assistant message `Send to...` menu | Prompt templates are local and not persisted as handoff metadata | Add analytics for accepted handoff targets and prompt quality tuning |
| Quality-check actions | Implemented | `components/chat/message.tsx`, `lib/assistant-quality-actions.ts`, `lib/chat-context.tsx` | Existing `/api/chat` or `/api/images/generate` through send pipeline | Normal conversations/messages and usage events; artifacts if saved | Assistant message `Quality` menu | V1 stores only normal messages, not action metadata | Add lightweight action outcome telemetry if useful |
| Memory Vault | Implemented | `components/chat/memory-vault.tsx`, `lib/db/repositories/memory-vault.ts`, `lib/ai/memory.ts` | `GET /api/memory-vault`, `PATCH/DELETE /api/conversations/[id]/memory` | `zen_conversations.memory_summary`, `memory_updated_at`, `session_settings`; no new migration | Settings, command palette, Project Home memory status | Project memory is derived from conversation memory; no dedicated preference vault | Add explicit user preference store only after privacy model is designed |
| Model Duel | Implemented | `components/chat/model-comparison-button.tsx`, `lib/db/repositories/model-comparisons.ts`, `app/api/model-comparisons/route.ts` | `POST /api/model-comparisons`, `POST /api/model-comparisons/[id]/choose` | `zen_model_comparisons`, `zen_model_comparison_candidates`; `20260522_zenquanta_model_comparisons.sql` | Composer and command palette | Blind/scoring labels are mostly session-level; text-only by design | Persist scoring labels if users rely on them outside artifact saves |
| Prism Studio | Implemented | `components/chat/prism-studio.tsx`, `lib/db/repositories/generated-images.ts`, `lib/storage/generated-images.ts` | `/api/images/history`, `/api/images/history/[id]`, existing `/api/images/generate` | `zen_generated_images`; `20260528_zenquanta_prism_studio_metadata.sql` | Command palette, composer image tools, Project Home | Four-more-like-this sends multiple normal image requests; old rows may lack project/favorite metadata | Add pagination and stronger gallery asset health checks |
| Pulse Research Room | Implemented | `components/chat/pulse-research-room.tsx`, `lib/db/repositories/pulse-research.ts`, `lib/search/web-search.ts` | `GET /api/pulse/research-room`; research actions use `/api/chat` | `zen_messages.sources`, `zen_artifacts`; no source-table migration | Command palette and Project Home research action | No separate source database; Tavily unavailable cases are not logged in v1 | Add source bookmark/history table and Tavily health telemetry |
| File Intelligence Cards | Implemented | `components/chat/file-intelligence-card.tsx`, `lib/files/intelligence.ts`, `lib/db/repositories/files.ts` | `GET /api/files`, `POST /api/files/[id]/reindex`, `DELETE /api/files/[id]`, `/api/files/object` | `zen_files`, `zen_file_chunks`; file knowledge migration | Chat attachments, Project Home, Settings recent attachments | Re-index requires embeddings plus stored object; external GitHub files lack object downloads | Add bulk file manager and clearer external-file action states |
| Ask Files | Implemented | `components/chat/ask-files-panel.tsx`, `lib/chat-context.tsx`, `lib/rag/retrieval.ts` | Uses `GET /api/files` and normal `/api/chat` with `fileContext` | `zen_files`, `zen_file_chunks` | Command palette, Project Home, File Intelligence Card Ask action | Large project scopes may attach too many indexed files; citations depend on returned chunks | Add selection caps/pagination and richer citation UI |
| PDF text extraction without OCR | Implemented | `lib/rag/extraction.ts`, `lib/rag/indexing.ts`, `lib/utils/files.ts` | Existing upload/reindex APIs | `zen_files.metadata.knowledgeBase`, `zen_file_chunks`; no PDF-only migration | File upload, re-index, Ask Files/File Intelligence status | Scanned/image-only PDFs are skipped; layout/table fidelity is limited | Keep OCR as explicit future milestone and add sample PDF fixtures/tests |
| Usage transparency | Implemented | `components/chat/usage-transparency-hint.tsx`, `components/chat/composer.tsx`, `app/api/dashboard/route.ts` | `GET /api/dashboard` safe summary | Existing subscriptions/usage/image events/plan requests | Chat/image composer | Usage level is qualitative and not a billing quote | Calibrate hints against real usage distribution and user feedback |
| Upgrade nudges | Implemented | `lib/billing/upgrade-nudges.ts`, `components/chat/usage-transparency-hint.tsx`, `app/pricing/page.tsx`, `app/dashboard/page.tsx` | `GET /api/dashboard`, `GET/POST /api/plan-requests` | `zen_plan_change_requests`, `zen_subscriptions`, usage tables | Composer, pricing, dashboard | Dismissal is session-local; rejected admin notes need careful display | Add persistent per-surface dismissal and admin-note length/safety review |
| Admin product analytics | Implemented | `lib/db/repositories/admin.ts`, `app/admin/page.tsx`, `app/api/admin/overview/route.ts` | `GET /api/admin/overview`, admin users/plan routes | Existing usage, profile, project, file, image, workflow, comparison, assistant tables | `/admin` | Computed at request time; Tavily unavailable not logged | Add cached/periodic aggregates if admin data grows |
| Custom Assistant Builder v2 | Implemented | `components/chat/custom-assistant-button.tsx`, `lib/custom-assistants/validation.ts`, `lib/db/repositories/custom-assistants.ts` | `/api/custom-assistants`, `/api/custom-assistants/[id]`, `/api/custom-assistants/test` | `zen_custom_assistants.metadata`; `20260528_zenquanta_custom_assistant_builder_v2.sql` | Private Assistants studio and custom assistant selector | Starter prompts are metadata-linked ids, not a join table; text-only by design | Add project availability only with explicit scoping rules |
| Integration architecture planning | Implemented | `AI_DECISIONS.md`, `AI_TASK_LOG.md`, `AI_PROJECT.md`, `AI_CHECKLIST.md` | None | Future `zen_integration_accounts`/`zen_integration_items` concept; GitHub now implemented | Documentation only | Provider order changed in practice because GitHub was implemented first | Reconcile provider roadmap after GitHub production learnings |
| GitHub read-only integration | Implemented | `lib/integrations/github.ts`, `lib/integrations/github-import.ts`, `components/chat/github-integration-panel.tsx`, `lib/db/repositories/integrations.ts` | `/api/integrations/github/*` | `zen_integration_accounts`, `zen_integration_items`, `zen_files`, `zen_file_chunks`; `20260528_zenquanta_github_readonly_integrations.sql` | Project Home, command palette, GitHub repo context panel | Requires external GitHub App config; no background sync; imported files are not object-store downloads | Validate production GitHub App permissions, add provider health checks, and design optional remove-imported-content flow |

### Cross-Cutting Findings

- New protected feature routes use `requireAuthenticatedUser`; admin analytics routes use `requireAdminApiUser` and admin pages use `requireAdmin`.
- Normal user dashboard/pricing surfaces show displayed usage, while raw cost appears confined to billing internals and admin pages/APIs.
- Prism image generation remains separate through `/api/images/generate`; `/api/chat` rejects Prism/image-mode requests.
- Private files use `/api/files/object` and file intelligence APIs; GitHub-imported files are private Neon knowledge records, not object-store downloads in v1.
- Search is Neon-backed and user-scoped, with project ownership validated before project searches.
- GitHub integration is read-only GitHub App based, foreground-only, and has no issue, PR, commit, branch, webhook-processing, or write behavior.
- No Supabase runtime clients or Stripe/payment automation were found. Historical Supabase migrations remain reference-only.

### Verification

- `npm run typecheck`: passed.
- `npm run lint`: passed with 12 existing warnings in `components/chat/chat-image-message.tsx`, `components/chat/composer.tsx`, `components/chat/message.tsx`, `components/chat/mode-switcher.tsx`, `components/chat/settings-modal.tsx`, `components/chat/sidebar.tsx`, `components/ui/use-toast.ts`, `hooks/use-toast.ts`, `lib/ai/chat.ts`, `lib/db/repositories/model-comparisons.ts`, and `lib/utils/files.ts`.
- `npm run build`: passed with the known Node `module.register()` deprecation warning.

## Product Feature Readiness Audit

Audit date: 2026-05-26. Documentation-only audit before new product features; no runtime behavior changed.

### Implementation Map

- Workspace state management is centralized in `lib/chat-context.tsx` through `ChatProvider` and `useChatContext`. It owns auth/session restore, conversations/current chat, current assistant mode, app/session settings, streaming state, sidebar/settings UI state, sidebar `searchQuery`, projects/selected project, prompt library, prompt workflows, custom assistants, queued workflow prompts, attachment upload, text send, Prism image send, prompt workflow runs, and model comparisons.
- New client features should reuse the existing `requestJson`, `loadAuthedData`, `upsertConversation`, `applyConversationPatch`, `persistConversationMutation`, `uploadAttachments`, `runTextAction`, `runImageAction`, `runPromptWorkflow`, `runModelComparison`, and `chooseModelComparisonResponse` patterns instead of creating a second client store.
- Neon repositories are server-only singleton modules under `lib/db/repositories/*`. User-owned writes generally call `neonUsersRepository.ensureUserReference(userId)` or route handlers call `neonProfilesRepository.ensureFromAuthUser(auth.user)` before repository work. Repositories use Drizzle, row mapper helpers, ISO/JSON normalization helpers, scoped `userId` filters, and `returning()`/upsert patterns.
- API routes in `app/api/*` use Node runtime route handlers, `requireAuthenticatedUser` or `requireAdminApiUser`, defensive JSON parsing, repository calls, `NextResponse.json`, and refreshed session cookies through `appendAuthCookies`. Text chat remains streamed NDJSON from `/api/chat`; Prism image generation remains JSON from `/api/images/generate`.
- Chat UI composition is provider-shell based: `ChatLayout` wraps `AuthGate`, `Sidebar`, `Header`, `ChatArea`, `SettingsPanel`, `SettingsModal`, and assistant dialogs. `components/chat/*` are client components that consume `useChatContext`. `components/ui/*` follow shadcn/Radix-style primitives with `cn`, `data-slot`, CVA variants, `asChild`, dialogs/dropdowns/tooltips, and lucide/local icon buttons.
- Storage locations: projects -> `zen_projects`; conversations -> `zen_conversations`; messages -> `zen_messages`; memory summary -> conversation memory fields; prompts -> `zen_prompt_library`; prompt workflows -> `zen_prompt_workflows`, `zen_prompt_workflow_steps`, `zen_prompt_workflow_runs`, and `zen_prompt_workflow_step_runs`; text model comparisons -> `zen_model_comparisons` and `zen_model_comparison_candidates`; custom assistants -> `zen_custom_assistants`; settings -> `zen_user_settings`; file metadata -> `zen_files`; file chunks/embeddings -> `zen_file_chunks`; generated image metadata -> `zen_generated_images`; image usage/history -> `zen_image_generation_events`; text usage -> `zen_usage_events`; plans/manual activation/admin audit -> `zen_subscriptions`, `zen_usage_limit_overrides`, `zen_plan_change_requests`, and `zen_admin_audit_logs`.
- Files and generated images use the neutral object storage layer in `lib/storage/object-store.ts`, with local development storage plus S3-compatible/R2 support. Private reads go through `/api/files/object`; raw files stay outside Neon.
- Usage enforcement remains in `lib/billing/enforce.ts`, estimation in `lib/billing/costs.ts`, and logging/counter increments in `lib/billing/log-usage.ts`.
- Package manager evidence is split: repo docs and scripts use `npm install` / `npm run ...`, but the only lockfile is `pnpm-lock.yaml` and `AI_CHECKLIST.md` notes `node_modules/.pnpm`. Treat npm scripts as the current documented workflow, but do not change dependencies or lockfiles until npm vs pnpm is explicitly standardized.

### Feature Readiness Risks

- Global search: sidebar search is currently client-side workspace filtering only; there is no dedicated global search API or indexed search surface across projects, conversations, prompts, files, and generated images. Any server search must stay user-scoped and avoid exposing private file object paths.
- Project home: projects and conversations are Neon-backed, but `projectId` is a text field on several tables rather than a foreign-keyed relationship to `zen_projects`; project surfaces must tolerate missing/deleted project ids and should reuse existing project/conversation repositories first.
- Artifacts: messages support attachments, generated-image attachments, sources, usage, and metadata, but there is no dedicated artifact/version table. Artifact work should first define a minimal Neon metadata model and preserve private object access controls.
- Playbooks: prompt workflows are implemented and tracked, but execution is intentionally client-queued through normal chat/image sends, not a durable background automation engine. Richer playbooks must not bypass billing, memory, web search, file context, or transport separation.
- Memory vault: conversation memory fields exist, but there is no cross-conversation memory vault table or user-facing consent/scoping model. This is privacy-sensitive and should follow explicit project/user scoping.
- Pulse research: Tavily-backed Pulse/webSearch is implemented and degrades without `TAVILY_API_KEY`, but it is source-snippet context injection, not a crawler, saved research archive, or long-running research workflow.
- Prism gallery: `/api/images/history` reads image usage events and `zen_generated_images` stores durable metadata, but a gallery should prefer private stored image URLs/metadata and avoid assuming all historical output URLs are durable or public.
- Onboarding: first-run setup now stores state in the user settings payload and creates starter prompts/projects through Neon repositories. There is still no dedicated onboarding table.
- Cross-cutting risks: conversation saves still delete/reinsert messages; local object storage is development-oriented and S3/R2 must be validated for production; the hardcoded admin fallback in `lib/db/repositories/profiles.ts` remains; OCR/image-only PDF RAG is not implemented; lint currently passes with existing warnings; there is no dedicated test script.

### Recommended Feature Build Order

1. Verification and hardening baseline: standardize package manager, clean lint warnings, keep typecheck/lint/build meaningful, validate Neon migrations and S3/R2 production storage.
2. Read-only global search v1 over already-Neon-backed projects, conversations/messages, prompts/workflows, custom assistants, file metadata, and generated-image metadata, with strict user scoping.
3. Project home using existing projects, conversations, prompts/workflows, files, usage, and dashboard data.
4. Prism gallery using `zen_generated_images`, `zen_image_generation_events`, and private object URLs.
5. Artifacts metadata model/UI layered over messages, files, generated images, and sources.
6. Playbooks v2 on top of prompt workflows, keeping execution through existing chat/image routes.
7. Pulse research improvements: clearer source UX, Tavily limit handling, optional saved research snapshots in Neon.
8. Memory vault after explicit consent, scoping, retention, and admin/privacy rules are designed.
9. Onboarding after the main workspace surfaces are stable, reusing auth/profile/settings/subscription state.

### Verification

- `npm run typecheck` passed after the audit entry.
- `npm run lint` passed after the audit entry with 14 existing warnings: `<img>` usage in chat image/message components, hook dependency cleanup in `components/chat/composer.tsx`, several unused variables/imports, and the existing toast action type warning.

## Completed Work

### 2026-06-03 - Playwright E2E Smoke Test Setup

- Added a small Playwright route/form smoke suite with `npm run test:e2e`, `playwright.config.ts`, and `tests/e2e/smoke.spec.ts`.
- Covered service-free unauthenticated flows: root auth gate, sign-in form, sign-up form, protected dashboard/pricing/admin redirects, and public assistant pages for Nova, Velora, Axiom, Forge, Pulse, and Prism.
- Documented authenticated E2E limitations in `tests/e2e/README.md`: workspace rendering, command palette, and global search need a future seeded Neon test database/session fixture rather than mocked production credentials or weakened auth.
- Updated `AI_CHECKLIST.md` with E2E commands, scope, and the Playwright Chromium install fallback.
- Preserved constraints: no real OpenRouter, Tavily, Neon data setup, S3/R2, GitHub, Supabase, Stripe, production credentials, auth bypass, or runtime behavior changes.
- Verification: `npx playwright install chromium` was required once locally; `npm run test:e2e` passed with 12 Chromium smoke tests; `npm run test` passed with 6 files and 29 tests; `npm run typecheck` passed; `npm run lint` passed with the existing 12 warnings; `npm run build` passed with the known Node `module.register()` deprecation warning.

### 2026-06-03 - Basic Automated Test Setup

- Added a lightweight Vitest unit-test foundation with `npm run test` and `npm run test:watch`, using `vitest.config.ts` with Node environment and the existing `@/` alias.
- Added pure unit coverage for assistant routing/config helpers, prompt precheck recommendations, pricing/billing display helpers, upgrade nudge helpers, file utility/status helpers, custom assistant validation, playbook variable/interpolation helpers, and search result normalization/sorting helpers.
- Extracted pure search result helper logic into `lib/search/search-result-utils.ts` and kept the Neon search repository behavior unchanged by reusing that helper from `lib/db/repositories/search.ts`.
- Updated `AI_CHECKLIST.md` with the new test commands and the unit-test boundary: no OpenRouter, Tavily, Neon, object storage, GitHub, Supabase, Stripe, browser automation, paid services, or real secrets required.
- Preserved existing uncommitted smoke-test documentation and did not change runtime routes, auth, billing, storage, AI gateways, payment behavior, or external service integrations.
- Verification: `npm run test` passed with 6 files and 29 tests; `npm run typecheck` passed; `npm run lint` passed with the existing 12 warnings; `npm run build` passed with the known Node `module.register()` deprecation warning.

### 2026-06-03 - Manual Product Smoke Test Checklist

- Added `docs/manual-product-smoke-test.md` as a documentation-only manual QA checklist covering auth, core workspace, projects, search, artifacts, AI Playbooks, assistants, files/RAG, Pulse, Prism, usage/plans, admin, GitHub read-only integration, and final regression checks.
- The checklist includes test run metadata, environment prerequisites, safe-test warnings, pass/fail/blocked fields, steps, expected results, related routes/APIs, and notes for each smoke test.
- Preserved constraints: no route/API/auth/billing/storage/runtime behavior changes, no Supabase runtime, no Stripe/payment automation, OpenRouter remains the AI gateway, Prism stays on `/api/images/generate`, and private files stay behind protected file routes.
- Verification: `git diff --check` passed; `npm run typecheck` passed; `npm run lint` passed with the existing 12 warnings; `npm run build` passed with the known Node `module.register()` deprecation warning.

### 2026-05-28 - GitHub Read-Only Integration V1

- Added read-only GitHub App integration scaffolding with Neon `zen_integration_accounts` and `zen_integration_items` tables, plus protected `/api/integrations/github/*` routes for connect callback, status, repo listing, safe file listing, selected import, explicit re-import, and local disconnect.
- Implemented server-only GitHub App JWT and installation-token helpers using Node crypto/fetch only; no OAuth package, webhook processor, write endpoint, Supabase, Stripe, external vector DB, or new AI gateway was added.
- Imports are foreground and user-selected. V1 offers README, `package.json`, and safe text/source files under per-file and total size limits, skips dependencies/build outputs/lockfiles/secrets-like paths/binaries, and stores imported content as private `zen_files` metadata plus `zen_file_chunks` through the existing RAG indexing path.
- Added a GitHub repo context workspace panel, command palette action, and Project Home GitHub section with connected account, imported repo/file counts, last import, re-import, disconnect, and Ask Files handoff.
- Historical note: at the time, GitHub App env placeholders were added to `.env.example`; current setup now documents these keys as `.env.local` placeholders instead.
- Verification: `npm run typecheck` passes; `npm run lint` passes with the existing 12 warnings; `npm run build` passes with the existing Node `module.register()` deprecation warning.
- Remaining risks: GitHub App installation must be configured externally with read-only Metadata/Contents permissions; v1 stores imported snapshots in Neon chunks/file metadata rather than object-store snapshots, so protected file download is not available for GitHub-imported external files; imports are capped foreground operations with no scheduled sync or webhook refresh.

### 2026-05-28 - Read-Only Integrations Architecture Plan

- Added a documentation-only `AI_DECISIONS.md` section titled “Read-Only Integrations Architecture Plan.”
- Planned future Google Drive, Notion, GitHub, and later Slack/Discord integrations as read-only, user-selected, Neon-backed sources that import selected content into the existing private `zen_files` and `zen_file_chunks` knowledge path.
- Documented future `zen_integration_accounts` and `zen_integration_items` concepts, encrypted server-only token storage, foreground import/refresh/revoke flows, Project Home/Ask Files/File Intelligence surfaces, and Google Drive as the recommended first integration.
- Preserved constraints: no OAuth implementation, no connector code, no OAuth packages, no schema migration, no runtime behavior change, no Supabase, no Stripe, no MCP runtime, no external vector DB, and no background-job system.
- Verification: not run because this was Markdown documentation only.

### 2026-05-28 - Private Custom Assistant Builder V2

- Added additive Neon metadata support for private custom text assistants through `zen_custom_assistants.metadata`, with structured tone, response style, suggested use cases, pinned state, and attached starter prompt ids.
- Added protected `POST /api/custom-assistants/test` for unsaved assistant drafts. The route validates the draft, rejects Prism/image modes through existing text-mode validation, runs through the existing OpenRouter text generation helpers, enforces plan/model limits, logs text usage, and returns scrubbed user-safe usage only.
- Upgraded the workspace custom assistant UI into a Private Assistants studio with assistant cards, pin/favorite, edit, duplicate, delete, structured builder fields, prompt-library attachment metadata, and a billed test panel.
- Preserved constraints: custom assistants remain private/user-owned and text-only; no public marketplace, no new AI gateway, no billing bypass, no raw cost exposure, no Supabase, and no Stripe.
- Verification: `npm run typecheck` passes; `npm run lint` passes with 12 existing warnings; `npm run build` passes with the known Node `module.register()` deprecation warning.
- Remaining risks: v2 starter prompts attach existing prompt-library records by id; it does not create a separate assistant-prompt join table or project-specific availability enforcement.

### 2026-05-28 - PDF Text Extraction V1

- Added `pdf-parse` as a server dependency through pnpm for in-process text extraction from text-based PDFs. Dependency justification: v2 is TypeScript/cross-platform, runs locally on private uploaded bytes, and exposes `PDFParse#getText()` for plain text extraction.
- Updated uploaded-file knowledge extraction so text/code files keep the existing path while PDFs are parsed server-side, normalized, chunked, embedded, stored in `zen_file_chunks`, and surfaced through the same File Intelligence status metadata.
- Image-only or empty PDFs are marked as skipped with the clear no-OCR reason: `No embedded text was found. OCR/image-only PDFs are not supported yet.`
- Password-protected or malformed PDFs are marked unsupported with safe user-facing reasons, while unexpected extraction/indexing failures continue to be recorded as failed metadata without blocking upload completion.
- Removed the old client-side PDF printable-string scraping from pending attachments so raw PDF bytes no longer inject noisy excerpts into chat context.
- Preserved constraints: no OCR, no external parsing service, no external vector DB, no Supabase, no storage changes, no new APIs, and embeddings remain server-only.
- Verification: `npm run typecheck` passes; `npm run lint` passes with 12 existing warnings; `npm run build` passes with the known Node `module.register()` deprecation warning.
- Remaining risks: PDF text extraction quality depends on embedded text quality and PDF structure; tables/layout reconstruction and scanned PDFs remain out of scope.

### 2026-05-28 - File Intelligence Cards V1

- Added protected `/api/files`, `/api/files/[id]/reindex`, and `/api/files/[id]` DELETE APIs for user-scoped file intelligence, safe re-indexing, and removal.
- Added file intelligence normalization over existing `zen_files.metadata.knowledgeBase` and chunk counts from `zen_file_chunks`, with safe statuses for indexed, skipped, unsupported, failed, and pending files.
- Added reusable File Intelligence Cards across chat attachments, Settings recent attachments, and Project Home uploaded files, including protected view/download links, status badges, safe reasons, Ask, Re-index, and Remove actions.
- Extended workspace state so “Ask about this file” prepares a draft with the existing file attachment and does not send automatically.
- Preserved constraints: no schema migration, no direct bucket URL exposure, no Supabase, no new storage provider, no OCR extraction, no billing changes, and no knowledge claims when files are not indexed.
- Verification: `npm run typecheck` passes; `npm run lint` passes with the existing 12 warnings; `npm run build` passes with the existing Node `module.register()` deprecation warning.
- Remaining risks: deleting a file intentionally preserves historical attachment labels while removing private object access refs; scanned/image-only PDF OCR indexing remains unsupported.

### 2026-05-28 - Pulse Research Room V1

- Added protected `GET /api/pulse/research-room` backed by a server-only Neon aggregate repository over owned conversations, message-attached web sources, projects, and Pulse research artifacts.
- Added shared Pulse Research Room types and workspace state support for opening the room from the command palette and Project Home.
- Added the Pulse Research Room workspace panel with recent Pulse conversations, recent source-backed message sources, derived search prompt history, saved source artifacts, project/query filtering, Tavily availability messaging, and polished empty/loading/error states.
- Added source actions for opening, copying citations, preparing a Pulse follow-up draft, and saving a source as a user-owned `pulse_report` research artifact without AI calls.
- Added research actions for summarizing sources, finding opposing views, creating research briefs, and comparing sources through editable prompts that send via the existing `/api/chat` Pulse path only after confirmation.
- Preserved constraints: no crawler, no new search provider, no source database or migration, no background jobs, no OpenRouter bypass, no billing bypass, no Tavily key exposure, no Supabase, and no Stripe.
- Verification: `npm run typecheck` passes; `npm run lint` passes with the existing 14 warnings; `npm run build` passes with the existing Node `module.register()` deprecation warning.
- Remaining risks: v1 saved sources are Pulse artifacts rather than a dedicated bookmark table; source/search history exists only when prior messages persisted web sources.

### 2026-05-26 - AI-Assisted Artifact Actions V1

- Added protected `/api/artifacts/[id]/actions` for owned saved artifacts. The route validates the requested action, builds a bounded artifact prompt, selects a text assistant mode by action, enforces usage limits, generates through the existing OpenRouter text helper, logs text usage, and returns scrubbed client-safe usage.
- Added shared artifact action types/config for Improve writing, Make shorter, Make more professional, Expand with more detail, Turn into checklist, Turn into email, Create summary, and Find weaknesses.
- Extended Artifact Studio with an action picker, loading/error states, generated preview, Copy/Dismiss/Apply controls, and draft-only apply behavior so users still save explicitly.
- Preserved constraints: no image route calls, no background jobs, no Stripe, no Supabase, no external storage, no artifact version table, no raw model cost exposure, and no billing bypass.
- Verification: `npm run typecheck` passed; `npm run lint` passed with the existing 14 warnings; `npm run build` passed with the existing Node `[DEP0205]` `module.register()` deprecation warning; unauthenticated `POST /api/artifacts/test-artifact/actions` returned `401` on the already-running dev server at `http://localhost:3001`.

### 2026-05-26 - Artifact Studio V1

- Added Neon migration and Drizzle schema support for `zen_artifacts`, with user/project/source metadata, source/type checks, indexes, and updated-at trigger.
- Added protected artifact CRUD APIs and a server-only artifact repository with user-scoped list/get/create/update/delete operations plus owned project, conversation, and source-message validation.
- Added Artifact Studio as an authenticated workspace dialog with list/search/filter, project assignment, markdown/plain-text editing, create/update/delete, copy, and `.md` export.
- Added assistant-message and model-comparison candidate save-to-artifact actions without OpenRouter calls or billing events.
- Extended Project Home and global/project search to include artifacts and command-palette artifact targets.
- Preserved constraints: no Supabase, no Stripe, no external artifact storage, no realtime collaboration, no background AI generation, and no billing/auth behavior changes.
- Verification: `npm run typecheck` passed; `npm run lint` passed with the existing 14 warnings; `npm run build` passed with the existing Node `[DEP0205]` `module.register()` deprecation warning; unauthenticated `GET /api/artifacts` returned `401`.

### 2026-05-26 - Project Search V1

- Extended `/api/search` with optional authenticated `projectId` scoping and response scope metadata while preserving global search behavior.
- Added project-scoped search filtering in the Neon search repository for conversations, messages, files, generated images linked through project conversations, project-scoped workflows, and project-scoped model comparisons.
- Updated the command palette with “Search everywhere” and “Search this project” scope controls, grouped search results, scoped loading/error/empty states, and project-default scope when a concrete project is active.
- Wired Project Home’s search quick action to open the command palette in project scope while leaving the local Project Home dashboard filter intact.
- Preserved constraints: no vector/semantic search, no external search provider, no schema/dependency/auth/billing/storage changes, no Supabase or Stripe.
- Verification: `npm run typecheck` passed; `npm run lint` passed with the existing 14 warnings; `npm run build` passed with the existing Node `[DEP0205]` `module.register()` deprecation warning; unauthenticated `GET /api/search?q=test&projectId=project-inbox` returned `401`.

### 2026-05-26 - Project Home V1

- Added protected `/api/projects/[id]/home` backed by a Neon aggregate repository for authenticated, user-scoped project summaries.
- Added the workspace Project Home view with overview counts, recent conversations, uploaded file metadata, generated image metadata, project-scoped workflow/playbook summaries, memory status, suggested next actions, local project-home filtering, and quick actions for chat, upload, workflows, Prism, and Pulse.
- Wired Project Home into the sidebar project selector and command palette while keeping plain project selection as a chat filter.
- Preserved constraints: no OpenRouter calls on page load, no billing/auth/storage-provider/schema/dependency changes, no Supabase or Stripe, and private file reads still go through `/api/files/object`.
- Verification: `npm run typecheck` passed; `npm run lint` passed with the existing 14 warnings; `npm run build` passed with the existing Node `[DEP0205]` `module.register()` deprecation warning; unauthenticated `GET /api/projects/project-inbox/home` returned `401`.
- Remaining risks: Project Home uses current project ID text fields rather than foreign-keyed project relationships; prompt library items remain global, so project playbooks are represented by project-scoped prompt workflows only.

### 2026-05-26 - First-Run Onboarding V1

- Added onboarding state to the existing Neon-backed user settings payload with normalized `not_started`, `completed`, and `skipped` states.
- Added protected `/api/onboarding` for skip/complete actions. Completion updates default assistant settings and creates optional deterministic starter projects plus deterministic user-owned prompt library items.
- Added starter pack config for Student, Founder, Developer, Content Creator, Small Business, Research, and Agency packs. V1 installs prompt library items only; it does not create prompt workflow records or run AI calls.
- Added the authenticated workspace onboarding dialog, automatic display for empty workspaces with no completed/skipped onboarding state, Settings reopen control, and an empty-state personalization action.
- Preserved constraints: no auth security changes, no Stripe/payment automation, no Supabase runtime, no OpenRouter calls during onboarding, no billing behavior changes, and no assistant/model-limit changes.
- Verification: `npm run typecheck` passed; `npm run lint` passed with the existing 14 warnings; `npm run build` passed with the existing Node `[DEP0205]` `module.register()` deprecation warning; local dev server responded at `http://localhost:3001`; unauthenticated `POST /api/onboarding` returned `401`.

### 2026-05-26 - Global Search V1 And Command Palette

- Added protected `/api/search` with authenticated, user-scoped Neon/Postgres search across projects, conversations, messages, prompt library items, prompt workflows, custom assistants, uploaded file metadata, generated image metadata, and model comparisons.
- Added normalized search result types and a server-only `neonSearchRepository` using existing Drizzle/Postgres query patterns and simple `ILIKE` matching. No external search provider, vector database, RAG/embedding changes, Supabase, Stripe, billing behavior, or auth behavior changes were added.
- Added an authenticated workspace command palette opened from the header or Cmd/Ctrl+K. It supports workspace search, new chat, new project, dashboard/pricing navigation, assistant switching, prompt workflow runs, prompt library/model comparison/custom assistant dialogs, Prism image history navigation, project opening, recent conversation opening, and message-result scroll anchors.
- Extended `lib/chat-context.tsx` with reusable local actions for opening conversations and requesting existing workspace tool dialogs, so the palette uses current workspace state instead of creating a parallel store.
- Verification: `npm run typecheck` passed; `npm run lint` passed with the existing 14 warnings; `npm run build` passed with the existing Node `[DEP0205]` `module.register()` deprecation warning.
- Remaining risks: search is intentionally simple `ILIKE` over current user-owned Neon rows and is not ranked/indexed full-text search yet; file results expose only metadata/navigation and still depend on the private object-storage access layer for raw file reads.

### 2026-05-26 - Project Context Export

- Created `ZENQUANTA_PROJECT_CONTEXT.md` as a self-contained current project export for a new AI assistant conversation.
- Documented inspected repo facts: fresh Neon runtime data/auth, neutral private storage, OpenRouter-only AI gateway, Tavily-backed Pulse/webSearch, uploaded-file RAG, prompt workflows, text model comparison, custom text assistants, manual plan requests, and admin controls.
- Preserved current constraints: no Stripe/payment automation, no Supabase runtime reintroduction, no Supabase data or storage migration, and manual admin-driven plan activation.
- Verified after the documentation-only edit: `npm run typecheck` passed, `npm run lint` passed with 14 existing warnings, and `npm run build` passed with Node `[DEP0205]` `module.register()` deprecation warnings.

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

### 2026-05-22 - Neon Database Migration Implementation (Superseded)

- Historical attempt that added Neon database driver dependency and a storage-layer Neon helper.
- Historical attempt that added a Neon initial schema and moved app data stores from Supabase REST calls to Neon SQL.
- Superseded by the fresh Neon foundation direction: no Supabase database rows should be imported or preserved, and runtime routes remain Supabase-backed until later explicit milestones.

### 2026-05-22 - Neon Foundation Boundary Correction (Superseded)

- Corrected the milestone back to foundation-only.
- Restored runtime `lib/storage/*` persistence stores to Supabase REST.
- Moved the Neon foundation to `lib/db/client.ts` and `lib/db/schema.ts`.
- Kept the earlier Neon SQL schema migration and env documentation for later migration work.
- Confirmed Supabase remains current for runtime app persistence, Auth, and Storage.
- Superseded by the fresh Neon foundation baseline.

### 2026-05-22 - Neon Repository Layer

- Added parallel server-only Neon repositories under `lib/db/repositories/*`.
- Covered profiles, subscriptions, usage, image generation events, plan requests, admin audit logs, projects, conversations/messages, prompts, settings, and assistant recommendation events.
- Kept routes, auth, billing, UI, file storage, and `lib/storage/*` runtime wiring on Supabase.
- Documented that repositories are migration targets only until routes are explicitly swapped.

### 2026-05-22 - First Low-Risk Neon Route Slice (Superseded)

- Migrated `/api/prompts`, `/api/prompts/[id]`, `/api/settings`, and `/api/assistant-recommendations` from Supabase storage modules to Neon repositories.
- Kept Supabase Auth, refreshed auth cookie handling, request/response shapes, and route validation behavior unchanged.
- Deferred chat, image generation, attachments, conversations, projects, dashboard, plan requests, admin flows, billing helpers, auth routes, and import-local bootstrap.
- Superseded by the fresh Neon foundation direction; runtime routes were restored to Supabase-backed stores.

### 2026-05-22 - Project And Conversation Neon Route Slice (Superseded)

- Migrated project, conversation, message, and conversation memory persistence to Neon repositories.
- Wired project/conversation API routes, text chat saves, Prism conversation saves, dashboard recent conversations, and local import project/conversation/prompt/settings writes through Neon.
- Kept Supabase Auth, Supabase Storage attachment upload/signing, billing enforcement, usage logging, plan requests, admin flows, subscriptions, and profiles on existing Supabase-backed paths.
- Superseded by the fresh Neon foundation direction; runtime routes were restored to Supabase-backed stores.

### 2026-05-22 - Fresh Neon Foundation Direction

- Changed direction so Neon starts as a fresh database, not a Supabase data migration target.
- Restored uncommitted route-level Neon wiring so runtime routes stay on the existing Supabase-backed stores.
- Replaced the old Neon initial migration with a fresh baseline schema for Zenquanta product concepts.
- Documented that Supabase rows should not be imported, copied, backfilled, or preserved in Neon.

### 2026-05-22 - Fresh Neon Repository Completion

- Completed the server-only fresh Neon repository layer under `lib/db/repositories/*`.
- Added fresh Neon user/auth identity anchoring plus metadata repositories for files and generated images.
- Made user-owned repository writes create fresh `zen_users` references when needed.
- Kept runtime routes, auth, file uploads, billing behavior, UI, and Supabase-backed stores unchanged.

### 2026-05-22 - First Active Fresh Neon Route Slice

- Migrated `/api/settings`, `/api/prompts`, `/api/prompts/[id]`, and `/api/assistant-recommendations` to Neon repositories.
- Kept Supabase Auth and refreshed auth cookie behavior unchanged.
- Ensured each migrated route creates or refreshes a fresh Neon user/profile from the current session identity.
- Kept chat, image generation, attachments, conversations, projects, dashboard, plan requests, admin routes, billing helpers, auth routes, and import-local on Supabase-backed runtime paths.
- Did not import, copy, backfill, or preserve Supabase database rows.

### 2026-05-22 - Project And Conversation Fresh Neon Route Slice

- Migrated project CRUD routes, conversation CRUD routes, message persistence, and conversation memory fields to Neon repositories.
- Moved conversation persistence inside `/api/chat` and `/api/images/generate` to Neon while keeping assistant execution, billing enforcement, and usage logging behavior unchanged.
- Moved dashboard recent conversations and local browser import app-data writes to Neon.
- Kept Supabase Auth, Supabase Storage attachments, plan requests, billing/admin plan data, admin mutations, usage records, and image history on existing Supabase-backed paths.
- Switched admin conversation/recommendation read panels to Neon so old Supabase chats are not surfaced after the conversation migration.
- Did not import, copy, backfill, or preserve old Supabase conversations or messages.

### 2026-05-22 - Usage, Manual Plan, And Admin Neon Route Slice

- Migrated billing-adjacent runtime data to fresh Neon repositories.
- Moved subscriptions, usage overrides, text usage events, image generation events, plan requests, admin audit logs, image history, dashboard data, admin data, pricing plan request flows, and profile/role hydration to Neon.
- Kept Supabase Auth sessions and Supabase Storage attachments in place.
- Preserved manual plan requests and admin activation; no payment automation was added.
- Did not import, copy, backfill, or preserve Supabase usage, subscription, or plan request rows.

### 2026-05-22 - Fresh Neon Credentials Auth

- Replaced Supabase Auth with custom Neon-backed ID/password credentials auth.
- Added local auth credentials and session tables.
- Stored password hashes with per-user salts and used opaque HTTP-only session cookies.
- Kept Supabase only for private attachment Storage.
- Did not import, copy, backfill, or preserve Supabase Auth users, sessions, or passwords; existing users need to sign up again.

### 2026-05-22 - Neutral Private File Storage

- Replaced active Supabase Storage upload/signing paths with a neutral server-only object storage abstraction.
- Added local development storage and S3-compatible/R2 production storage support.
- Added authenticated private file reads through `/api/files/object`.
- Stored new upload metadata in `zen_files` and generated-image metadata in `zen_generated_images`.
- Persisted newly generated Prism images into the same storage layer before saving conversation messages.
- Did not import, copy, backfill, or preserve old Supabase Storage objects.

### 2026-05-22 - Supabase Runtime Removal

- Removed remaining Supabase runtime clients and old Supabase-backed storage/data modules.
- Kept `supabase/migrations/*` as historical reference only and documented that they are not part of active setup.
- Kept Neon Postgres, Neon credentials auth, neutral private file storage, OpenRouter, and manual plan/admin activation as the active platform stack.
- Did not import, copy, backfill, or preserve old Supabase rows, users, sessions, passwords, or storage objects.

### 2026-05-22 - Pulse Tavily Web Search

- Added real server-side Tavily search for Pulse and the existing `webSearch` setting.
- Added source metadata to streamed and persisted assistant messages.
- Kept OpenRouter as the only AI model gateway and kept web search provider keys server-only.
- Search degrades without source claims when `TAVILY_API_KEY` is not configured.

### 2026-05-22 - Uploaded File Knowledge V1

- Added first-version project knowledge/RAG for uploaded text and code-like files.
- Added server-side text extraction, chunking, OpenAI-compatible embeddings, and Neon pgvector chunk storage.
- Wired `/api/chat` to retrieve scoped file chunks when `fileContext` is enabled and inject only relevant excerpts.
- Kept raw files private in object storage and left scanned/image-only PDF OCR handling for later.

### 2026-05-22 - Reusable Prompt Workflows V1

- Added Neon-backed reusable prompt workflows as an extension of the existing prompt library.
- Added ordered workflow steps that target Nova, Velora, Axiom, Forge, Pulse, or Prism and support `{{variable}}` placeholders.
- Added workflow CRUD APIs and lightweight workflow run/step-run tracking.
- Wired the composer prompt popover with Prompts and Workflows tabs.
- Kept workflow execution simple: each step queues a normal chat or Prism image send, so existing chat/image routes, billing, memory, file context, and web search remain the execution path.
- Did not add payment automation, background jobs, or Supabase import/backfill logic.

### 2026-05-22 - Text Model Comparison V1

- Added a text-only comparison mode that sends one prompt to multiple available text assistants through OpenRouter.
- Added Neon tables, repository, and APIs for comparison records and generated candidates.
- Logged usage for every successful candidate and stored displayed usage/latency/model metadata for comparison.
- Added a composer comparison dialog with side-by-side candidate review and a "Save as best" action.
- Saving a candidate appends only the selected response to the conversation.
- Kept normal chat, Prism image generation, billing model, and manual plan upgrades unchanged.

### 2026-05-24 - Model Comparison V1 Polish

- Hardened text model comparison so foreign or missing conversation IDs return controlled `404` errors.
- Filtered requested comparison assistants to models available on the user's tier or admin override before generation.
- Added controlled failures for inaccessible target sets and all-candidate generation failure.
- Surfaced comparison API errors in the composer dialog instead of failing silently.
- Kept comparison text-only, OpenRouter-only, Neon-backed, and free of payment automation.

### 2026-05-23 - Admin Cost And Margin Controls

- Added filter-aware admin analytics over Neon usage, image, subscription, override, profile, and plan request data.
- Added admin dashboard controls for date range, plan, assistant, and user filtering.
- Added admin-only visibility for raw model cost, displayed usage, estimated plan margin, text/image cost split, risky users near limits, high raw-cost users, expensive models, and assistant usage.
- Kept manual plan requests, admin activation, user dashboard displayed-cost behavior, and payment automation scope unchanged.

### 2026-05-25 - Admin Cost And Margin Polish

- Polished existing Neon-backed admin analytics without changing billing or plan activation behavior.
- Added display-name support in admin profile matching/display, clearer selected-period context, and manual-plan revenue labels.
- Added margin-rate and raw-cost-per-active-user detail to plan margin analytics.
- Improved risky-user ordering and avoided unusual raw-cost flags when data is too sparse.
- Kept raw costs admin-only and did not add payment automation.

### 2026-05-25 - Custom Assistant Builder V1

- Added private Neon-backed custom text assistants layered over existing built-in text modes.
- Added authenticated custom assistant CRUD routes and composer UI for create/edit/select/delete.
- Wired selected custom assistants into `/api/chat` through base-mode model routing, existing usage limits, and bounded extra system instructions.
- Kept Nova, Velora, Axiom, Forge, Pulse, and Prism unchanged; image assistants, marketplace sharing, arbitrary raw model selection, Supabase, and payment automation remain out of scope.

### 2026-05-24 - Verification Tooling Hardening

- Added an ESLint flat config for the current Next.js/TypeScript app.
- Added `npm run typecheck` as `tsc --noEmit`.
- Removed Next's TypeScript build-error ignore setting so `npm run build` runs TypeScript validation.
- Verified `npm run typecheck`, `npm run build`, and `npm run lint` run successfully, with lint warnings still present as existing cleanup work.

### 2026-05-24 - Post-Neon Cutover Hardening

- Added Neon-backed sign-in attempt limiting and stronger local password/session handling.
- Tightened private object reads, attachment scope validation, and generated-image fetch safety.
- Added focused validation for manual plan requests, admin mutations, recommendation telemetry, and workflow run conversation scope.
- Made text/image usage counter updates atomic and dashboard displayed usage period-scoped.
- Kept Supabase runtime removed, avoided data imports/backfills, and kept manual plan requests/admin activation.

### 2026-05-24 - Pulse Web Search Verification

- Verified the current Pulse/webSearch path uses server-only Tavily retrieval, injects source context into `/api/chat`, streams source metadata, and persists sources on assistant messages.
- Added a total snippet budget to web search source normalization so retrieved snippets stay bounded before model injection.
- Expanded current/research prompt signals so Pulse is recommended for more source-backed, verification, and current-landscape prompts.
- Kept OpenRouter as the only model gateway and did not add Supabase or payment automation.

### 2026-05-24 - Uploaded File RAG V1 Gap-Fill

- Verified the existing uploaded-file RAG path uses neutral storage, Neon file metadata, pgvector chunks, server-only embeddings, and `/api/chat` retrieval when `fileContext` is enabled.
- Added stricter attachment metadata validation before uploads are linked to file metadata and knowledge chunks.
- Batched embedding requests for large text/code uploads and cleared stale chunks when extraction produces no usable chunks.
- Kept v1 focused on text/code-like files; no Supabase import, scanned PDF/OCR expansion, or payment automation was added.

### 2026-05-24 - Prompt Workflow Tracking Completion

- Added authenticated workflow run and step-run status updates around the existing client-side queued workflow execution path.
- Kept workflow execution simple: each step still goes through the normal chat or Prism image send path.
- Preserved prompt library behavior, workflow CRUD, Neon persistence, and normal usage logging as the billing source of truth.
- Did not add background jobs, Supabase runtime, or payment automation.

## Current Work

- Neon database foundation is complete at the code/schema level.
- Neon repositories exist as future route-by-route migration scaffolding and now cover the fresh schema, including user anchors, file metadata, and generated image metadata.
- Settings, prompt library, assistant recommendation telemetry, projects, conversations, messages, conversation memory, subscriptions/manual plans, usage overrides, text/image usage records, plan requests, dashboard data, image history, admin data, and profile/role hydration are now backed by fresh Neon repositories.
- Chat and image routes still use existing assistant execution paths, but their conversation, billing enforcement, and usage logging data now use Neon.
- Neutral private file storage is active for new uploads and generated images.
- Reusable prompt workflows are active in the composer prompt library popover.
- Text model comparison is active in the composer for text prompts.
- Admin cost and margin analytics are active on `/admin` and are backed by stored Neon usage data.
- Local verification now includes `npm run typecheck`, production build with TypeScript validation, and ESLint flat-config linting.

## Proposed Next Work

- Decide whether the repo should standardize on npm or pnpm.
- Clean up existing lint warnings when there is a dedicated cleanup milestone.
- Validate Tavily production limits and source display behavior for Pulse/webSearch.
- Validate embeddings provider cost/limits and pgvector query quality for uploaded-file knowledge.
- Apply and validate the fresh Neon foundation migration in a real Neon database.
- Plan remaining non-storage database route migrations, if any, as explicit bounded milestones.
- Validate S3-compatible/R2 configuration for production storage.
- Do not backfill existing Supabase Postgres data into Neon.
- Keep historical Supabase migrations as reference-only unless the team explicitly decides to remove or archive them elsewhere.

## Active Bugs / Issues

- `npm run lint` runs successfully but currently reports warnings.
- Package manager guidance is unclear because `pnpm-lock.yaml` exists while `README.md` says `npm install`.
- Generated image persistence should be reviewed.

## Architecture Concerns

- Text and image transports are intentionally separate and should remain separate.
- Neon is the source of truth for runtime app data and auth sessions; neutral object storage is the source for new private uploads and generated images.
- Neon Postgres is a fresh database foundation, not an imported copy of Supabase data.
- OpenRouter is the only AI model gateway.
- Tavily is the server-side web search provider for Pulse/webSearch source context.
- Uploaded-file knowledge uses server-only embeddings and Neon pgvector; raw files remain private.
- Prompt workflows run through the existing queued send path; they are not a durable background automation engine.
- Model comparison v1 is text-only; Prism/image comparison remains separate because image generation uses a different transport and wallet.
- Billing is currently manual/admin-driven, not payment-provider-driven.
- Server-only secrets must remain out of client components.

## Testing Status

- No dedicated test script is defined in `package.json`.
- Current scripts are `dev`, `build`, `start`, `lint`, and `typecheck`.
- `npm run typecheck` runs `tsc --noEmit`.
- `npm run lint` uses the root ESLint flat config.
- `npm run build` runs Next production build with TypeScript validation enabled.

## Known Risks

- Existing lint warnings remain and should be cleaned up in a focused follow-up.
- Package manager ambiguity.
- Pulse/webSearch requires `TAVILY_API_KEY` for live retrieval; without it the chat path continues without source claims.
- Uploaded-file knowledge requires an embeddings key and pgvector migration; unsupported files are skipped rather than blocking uploads.
- Payment automation is out of scope unless explicitly requested.
- Partial Neon migration can create split-system risk; future route migrations should be explicit and bounded.
- Supabase runtime clients and old Supabase-backed storage/data modules have been removed; only historical migrations remain.

## AI Handoff Summaries

### 2026-05-28 - Prism Studio V1

- Added Prism Studio as an authenticated workspace panel for generated-image gallery browsing, project/search/date/favorite filters, protected previews, prompt copy/reuse/remix, favorites, and prompt-to-Artifact saves.
- Added additive Neon metadata support for `zen_generated_images.project_id` and `is_favorite`, including backfill/index migration `20260528_zenquanta_prism_studio_metadata.sql`.
- Extended `/api/images/history` to return user-scoped durable generated-image metadata and added protected `PATCH /api/images/history/[id]` for favorite/project updates.
- Wired Prism Studio from the composer, command palette, Project Home, and generated-image search targets; reuse/remix prepares the Prism composer without sending.
- Added explicit creative action previews: four Prism variations still dispatch through `/api/images/generate`, while ad concept/caption/campaign prompts dispatch through normal Velora text chat.
- Preserved constraints: no image generation through `/api/chat`, no image credit bypass, no external image storage, no direct private object URLs, no Supabase, and no Stripe.
- Verification: `npm run typecheck` passes; `npm run lint` passes with the existing 14 warnings; `npm run build` passes with the existing Node `module.register()` deprecation warning; `git diff --check` passes.
- Remaining risks: production databases must apply the new Prism Studio migration; “Generate 4 more” intentionally queues four one-image Prism requests because the image route remains one image per request.

### 2026-05-28 - Model Duel V1 Polish

- Polished the existing text model comparison feature into user-facing Model Duel while preserving `/api/model-comparisons`, `/api/model-comparisons/[id]/choose`, Neon comparison tables, plan/model filtering, and billing enforcement.
- Upgraded the composer dialog with premium Model Duel language, prompt preview, selected-assistant count, text-only notices, explicit usage warning, Blind Mode, and 2-4 assistant selection across Nova, Velora, Axiom, Forge, and Pulse.
- Added clearer side-by-side candidate cards with hidden identity support, completion/failure states, latency, displayed usage, token/source counts, scoring labels, winner save, and Save as Artifact actions.
- Artifact saves now include Model Duel metadata plus assigned scoring labels; winner saves still use the existing choose endpoint and append the selected response to the conversation.
- Preserved constraints: no Prism/image comparison, no new API route, no migration, no new AI gateway, no billing bypass, no raw model cost exposure, no Supabase, and no Stripe.
- Verification: `npm run typecheck` passes; `npm run lint` passes with the existing 14 warnings; `npm run build` passes with the existing Node `module.register()` deprecation warning.
- Remaining risks: Blind Mode and scoring labels are local review-state only in v1; only Artifact saves preserve scoring labels in metadata.

### 2026-05-28 - Ask Files V1

- Added an authenticated Ask Files workspace panel that lets users scope questions to selected indexed files or all indexed files in a concrete project.
- Reused existing protected file intelligence data and the normal `sendMessage` pipeline; Ask Files submits through `/api/chat` with `fileContext` enabled, selected file attachments attached, Nova/general mode by default, and normal billing/usage enforcement preserved.
- Added honest empty/config states for missing embeddings, no indexed files, unsupported/skipped/pending/failed file states, and project-wide scope requiring a concrete project.
- Wired Ask Files from Command Palette, Project Home, File Intelligence Cards in chat attachments, and Settings recent attachments. Project Home also has an Ask Files quick action.
- Updated assistant message source display so file-backed RAG sources show returned snippets when chunk-level sources exist; if no snippets are returned, the UI only shows file/source labels.
- Preserved constraints: no external vector database, no OCR extraction, no private bucket URL exposure, no Supabase, no Stripe, and no AI calls until the user submits a question.
- Verification: `npm run typecheck` passes; `npm run lint` passes with 12 existing warnings; `npm run build` passes with the known Node `module.register()` deprecation warning; `git diff --check` passes.
- Remaining risks: Ask Files depends on existing embeddings/pgvector setup and indexed text/code-like or text-based PDF uploads; project-wide scope attaches all indexed project files in v1, so very large projects may need selection caps or pagination later.

### 2026-05-28 - Memory Vault V1

- Added a protected Memory Vault workspace panel for viewing and controlling existing Neon-backed conversation memory summaries.
- Added `/api/memory-vault` plus `/api/conversations/[id]/memory` PATCH/DELETE routes backed by a user-scoped Neon memory repository. Project memory is derived by grouping owned conversation summaries by project; no project memory table or vector store was added.
- Added global memory default control through existing settings, per-conversation memory enable/disable, clear summary, copy summary, open conversation, recent memory, project memory, and saved-preference explanation UI.
- Wired Memory Vault into workspace tools, Settings, Command Palette, and Project Home memory status while preserving existing memory injection behavior in `lib/ai/memory.ts`.
- Preserved constraints: no OpenRouter calls on vault load/clear, no hidden memory store, no migrations, no billing/auth/gateway/storage behavior changes, no Supabase, and no Stripe.
- Verification: `npm run typecheck` passes; `npm run lint` passes with the existing 14 warnings; `npm run build` passes with the existing Node `module.register()` deprecation warning; `git diff --check` passes.
- Remaining risks: V1 preferences are only visible lines parsed from conversation summaries because there is no separate editable global preference model yet.

### 2026-05-28 - Quality Check Actions V1

- Added message-level Quality actions for completed assistant responses, using local prompt templates and an editable preview before anything is sent.
- Added general, Axiom, Pulse, Forge, Velora, and Prism action groups, including shorter/detail/table/action-plan transforms, source verification prompts, code review/test prompts, tone/copy prompts, and visual prompt actions.
- Quality actions dispatch through the existing `sendMessage` pipeline: text actions use `/api/chat`, Prism visual actions use `/api/images/generate`, and selected custom assistants are bypassed so action targets stay explicit.
- Kept Save as Artifact available as the existing direct action and surfaced it near the Quality menu without changing artifact APIs.
- Preserved current project/conversation context and did not add API routes, migrations, gateways, billing changes, Supabase, Stripe, or automatic AI calls.
- Verification: `npm run typecheck` passes; `npm run lint` passes with the existing 14 warnings; `npm run build` passes with the existing Node `module.register()` deprecation warning; `git diff --check` passes.
- Remaining risks: quality prompts are template-based in v1 and will likely need tuning from real user examples.

### 2026-05-28 - Assistant Handoffs V1

- Added response-level assistant handoffs from completed assistant messages through a new “Send to” menu and editable preview dialog.
- Added local handoff target config and bounded prompt generation for Nova, Velora, Axiom, Forge, Pulse, and Prism.
- Handoff sends reuse the existing `sendMessage` pipeline: text targets route through `/api/chat`, Prism targets route through `/api/images/generate`, and normal billing/usage enforcement remains in place.
- Explicit handoffs bypass the currently selected custom assistant so “Send to Forge” uses built-in Forge rather than a custom assistant layer.
- Preserved current project/conversation context and did not add API routes, migrations, gateways, Supabase, Stripe, or automatic AI calls.
- Verification: `npm run typecheck` passes; `npm run lint` passes with the existing 14 warnings; `npm run build` passes with the existing Node `module.register()` deprecation warning.
- Remaining risks: handoff prompt quality is template-based in v1 and may need product tuning after real usage.

### 2026-05-28 - Smart Assistant Router UI V1

- Added a subtle inline composer recommendation chip powered by the existing local prompt classifier and assistant precheck hook.
- The chip appears only for high-confidence assistant mismatches while recommendations are enabled, shows the recommended assistant, reason, and a simple confidence label, and supports explicit Use/Ignore actions.
- Accepting a recommendation switches the assistant locally without sending; Prism recommendations switch the composer into image mode without calling `/api/images/generate` until the user sends.
- Kept the existing send-time recommendation dialog as a fallback for immediate paste-and-send flows and continued logging telemetry through `/api/assistant-recommendations` without OpenRouter calls.
- Updated Settings copy to describe the composer suggestion instead of a modal-only flow.
- Verification: `npm run typecheck` passes; `npm run lint` passes with the existing 14 warnings; `npm run build` passes with the existing Node `module.register()` deprecation warning.
- Remaining risks: shown telemetry is keyed to debounced draft snapshots, so very long paused editing sessions may still create more than one shown event for materially changed drafts.

### 2026-05-28 - AI Playbook Builder V1 Improvement

- Added additive Neon/Drizzle workflow metadata support with `zen_prompt_workflows.metadata` for category, expected output type, suggested assistant, and private visibility.
- Extended Prompt Workflow/AI Playbook shared types, API validation, and repository normalization for workflow metadata plus step metadata (`stepType`, `outputLabel`, `includePreviousOutput`) while preserving existing route/table names.
- Upgraded Playbook Studio with structured builder fields, step metadata controls, editable variable labels/defaults/required flags, expanded prompt preview before run, required-variable validation, and low/medium/high usage warnings without raw cost exposure.
- Updated foreground playbook execution so steps that opt in receive the previous completed step output while still dispatching through the normal text chat or Prism image path and recording step `messageId`s.
- Updated starter templates with structured metadata and output labels.
- Verification: `npm run typecheck` passes; `npm run lint` passes with the existing 14 warnings; `npm run build` passes with the existing Node `module.register()` deprecation warning.
- Remaining risks: the usage indicator is intentionally rough and not a billing quote; production Neon databases must apply `20260528_zenquanta_playbook_builder_metadata.sql`.

### 2026-05-28 - Usage Transparency V1

- Added a composer-level usage transparency hint that shows friendly low/medium/high expectations before chat sends or Prism image generation.
- The hint surfaces safe, qualitative badges for premium model routing, web search, file context, and image-credit usage without exposing raw model costs or changing billing calculations.
- Reuses the existing authenticated `/api/dashboard` displayed-usage summary to show the current plan and remaining displayed usage credits when available; plan limits still remain enforced by the existing chat/image routes on send.
- Added Fast, Balanced, Best quality, and Lowest usage controls as disabled/coming-soon UI affordances so no model routing or profile behavior changes silently.
- Prism drafts now show an image-credit reminder before generation, and Model Duel’s existing warning now more clearly states that each selected assistant can generate a separate usage-consuming response.
- Preserved constraints: no Stripe, no payment automation, no Supabase, no new billing route, no raw cost display, no plan-limit bypass, and no changes to `/api/chat` or `/api/images/generate`.
- Verification: `npm run typecheck` passes; `npm run lint` passes with the existing 12 warnings; `npm run build` passes with the existing Node `module.register()` deprecation warning; `git diff --check` passes.
- Remaining risks: usage level is intentionally a rough product hint, not a quote; the profile selector is UI-only until a later milestone safely maps it to existing response/model settings.

### 2026-05-28 - Manual Plan Request And Upgrade Nudge Polish

- Extended the safe `/api/dashboard` response with user-facing limit snapshots for daily messages, daily images, image credits, displayed credits, plus latest/pending plan request status. No raw costs, margin, secrets, or override internals are returned.
- Added reusable upgrade-nudge helpers for 80% near-limit detection, manual request status labels, safe admin-note display, and existing enforcement-error recognition.
- Composer usage transparency now shows dismissible manual upgrade nudges for near-limit usage or pending plan requests, linking to `/pricing` instead of creating payment automation.
- Chat errors and Model Duel errors that come from plan/model/usage enforcement now show a clear manual-plan CTA while preserving the existing blocking behavior.
- Model Duel and high-usage AI Playbooks now include manual request nudges for Free/Basic users without pending requests; no AI call, billing, or routing behavior changed.
- Pricing now shows clear no-request, pending, approved, activated, and rejected states; duplicate pending requests stay disabled, rejected admin notes are shown only as short plain text, and admin activation remains unchanged.
- Dashboard now shows the latest plan request status card with a link back to pricing.
- Verification: `npm run typecheck` passes; `npm run lint` passes with the existing 12 warnings; `npm run build` passes with the existing Node `module.register()` deprecation warning; `git diff --check` passes.
- Remaining risks: near-limit nudges are session-dismissed only in v1; persistent dismissal or finer per-limit thresholds can be added later if the prompts feel too frequent.

### 2026-05-28 - Admin Product Analytics V1

- Extended the admin overview data with Product Analytics for activation funnel, feature adoption, file indexing outcomes, and operational signals using existing Neon tables.
- Added activation counts for signed-up users, first text message, first non-default project, first file upload, first playbook run, first Prism image, and first Model Duel, with existing admin date/plan/assistant/user filters applied where relevant.
- Added feature adoption counts for projects, prompt saves, playbook runs, Model Duel runs, Prism generations, Pulse source-backed chats, file uploads/indexing status, and custom assistants.
- Added operational signals for failed Prism metadata rows, file indexing skipped/unsupported/failed, failed playbook runs, failed Model Duel candidates, users near limits, top raw-cost model, and an honest “Tavily unavailable not logged in v1” signal.
- Added safe failed Prism metadata logging after image request preparation so admin analytics can count generation failures without exposing private object URLs or changing image-credit enforcement.
- Updated the admin dashboard UI with Activation funnel, Feature adoption, File indexing outcomes, and Operational signals cards while preserving existing admin-only cost/margin sections.
- Preserved constraints: no third-party analytics, no Stripe, no Supabase, no payment automation, no new public routes, no raw cost exposure to normal-user APIs.
- Verification: `npm run typecheck` passes; `npm run lint` passes with the existing 12 warnings; `npm run build` passes with the existing Node `module.register()` deprecation warning; `git diff --check` passes.
- Remaining risks: analytics are computed at request time from current tables; Tavily unavailable cases remain unlogged until a future explicit telemetry slice.

### 2026-05-26 - AI Playbooks V1 Polish

- Polished Prompt Workflows into user-facing AI Playbooks while preserving the existing `/api/prompt-workflows*` routes, Neon tables, repository names, and foreground execution model.
- Added `components/chat/playbook-studio.tsx`, mounted it in the authenticated workspace shell, and wired it from the composer, command palette, Project Home quick actions, and project-scoped playbook links.
- Added starter AI Playbook templates in `lib/config/playbook-templates.ts`; templates install only after user action and create normal user-owned prompt workflow records.
- Added protected `GET /api/prompt-workflows/[id]/runs` plus repository run-history enrichment with step output messages when `messageId` exists.
- Updated the client playbook runner to execute each step through the normal text/Prism send path and record completed step `messageId` values for future run history/final output review.
- Added final-output review actions in Playbook Studio, including open conversation, copy/export, and Save as Artifact with `sourceType: workflow_run` and `artifactType: workflow_output`.
- Verification: `npm run typecheck` passes; `npm run lint` passes with the existing 14 warnings; `npm run build` passes with the existing Node `module.register()` deprecation warning.
- Remaining risks: older run records without step `messageId` show output unavailable; playbooks remain foreground/user-triggered and are not durable background automation.

### 2026-05-22

Shared memory files were created to give Codex, Claude Code, and future agents a consistent understanding of the repo. Future agents should begin by reading `AGENTS.md`, `AI_PROJECT.md`, `AI_TASK_LOG.md`, `AI_DECISIONS.md`, and `AI_CHECKLIST.md`.

## Future Feature Ideas

- Prism Studio polish for richer image metadata such as dimensions/title extraction.
- Workflow templates, sharing, duplication, and richer run history.
- Automated test suite for auth, billing, routing, recommendations, and chat streaming.
- Safer incremental conversation persistence.
- Auth and storage strategy decision after the database migration plan is clear.

## Open Questions

- Should the package manager be standardized on pnpm or npm?
- Should local storage remain the default development adapter, or should all deployed environments require R2/S3?
- Should admin role management become database-only with no hardcoded fallback?
