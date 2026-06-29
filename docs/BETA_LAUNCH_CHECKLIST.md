# Zenquanta AI — Beta Launch Checklist & Bug Bash Plan

Purpose: prepare Zenquanta AI for a small, invite-only private beta. This is an
operational checklist, not a code change. Work top to bottom; everything must be
green (or knowingly deferred) before sending invites.

- **Audience**: operator/admin running the beta + the small group of invited testers.
- **Scope**: single environment (treat staging/production env vars as the source of truth).
- **Non-goals**: payment automation, Stripe, public sign-ups, marketing launch.
- **Fast path**: most service-config items can be verified at a glance from the
  admin **System Health** page (`/admin/system-health`). Use it first, then walk
  the manual checks below for anything it cannot prove (privacy, billing, UX).

> Env note: secrets live only in `.env.local` (local) or the deployment's
> environment variables (staging/production). There is **no committed
> `.env.example`**. Never paste real secret values into this doc, screenshots,
> bug reports, or logs.

---

## 1. Required environment variables

Set these in the deployment environment (or `.env.local` for a local beta). Names
only below — never record values here.

**Required for the app to function at all:**

- `DATABASE_URL` — Neon Postgres connection string. Accepted aliases in code:
  `NEON_DATABASE_URL`, `POSTGRES_URL` (`DATABASE_URL` preferred).
- `OPENROUTER_API_KEY` — AI model gateway. Without it, text/image fall back to
  mock/degraded behavior.
- `OPENROUTER_BASE_URL` — usually `https://openrouter.ai/api/v1`.

**Feature-gated (app still runs without them, with honest degradation):**

- `TAVILY_API_KEY` — Pulse / `webSearch` live retrieval. Missing → Pulse answers
  without source claims.
- `OPENAI_API_KEY` **or** `EMBEDDINGS_API_KEY` — uploaded-file knowledge (RAG)
  embeddings. Missing → uploads still work but are not indexed/retrievable.
- `EMBEDDINGS_BASE_URL`, `EMBEDDINGS_MODEL` — optional embeddings overrides
  (default model targets `text-embedding-3-small`).
- `WEB_SEARCH_MAX_RESULTS` — optional Tavily tuning.

**File storage:**

- `FILE_STORAGE_PROVIDER` — `local` | `s3` | `r2`.
- `FILE_STORAGE_BUCKET` — e.g. `zenquanta-files`.
- `FILE_STORAGE_LOCAL_DIR` — used when provider is `local` (default `.storage/zenquanta`).
- `FILE_STORAGE_ENDPOINT`, `FILE_STORAGE_REGION`, `FILE_STORAGE_ACCESS_KEY_ID`,
  `FILE_STORAGE_SECRET_ACCESS_KEY` — **required when provider is `s3` or `r2`**.

**GitHub repo context (optional integration — skip if not used in beta):**

- `GITHUB_APP_ID`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_PRIVATE_KEY`,
  `GITHUB_APP_CALLBACK_URL`.

**Deployment/app URL:**

- `NEXT_PUBLIC_APP_URL` (or rely on `VERCEL_URL` on Vercel) — used for absolute
  links such as share URLs.

Checklist:

- [ ] All **required** vars present in the beta environment.
- [ ] All storage vars consistent with the chosen `FILE_STORAGE_PROVIDER`.
- [ ] Server-only secrets are **not** prefixed `NEXT_PUBLIC_` (only `NEXT_PUBLIC_APP_URL` should be public).
- [ ] `/admin/system-health` shows no `missing` rows for required services.

---

## 2. Neon migration checklist

Apply all migrations in order to a fresh Neon database (`psql "$DATABASE_URL" -f <file>`
or the Neon SQL editor). Do **not** import/backfill Supabase rows.

Order (authoritative as of 2026-06-17, 19 files):

1. `neon/migrations/20260522_zenquanta_fresh_initial.sql`
2. `neon/migrations/20260522_zenquanta_local_auth.sql`
3. `neon/migrations/20260522_zenquanta_message_sources.sql`
4. `neon/migrations/20260522_zenquanta_file_knowledge.sql`
5. `neon/migrations/20260522_zenquanta_prompt_workflows.sql`
6. `neon/migrations/20260522_zenquanta_model_comparisons.sql`
7. `neon/migrations/20260524_zenquanta_auth_attempts.sql`
8. `neon/migrations/20260525_zenquanta_custom_assistants.sql`
9. `neon/migrations/20260526_zenquanta_artifacts.sql`
10. `neon/migrations/20260528_zenquanta_playbook_builder_metadata.sql`
11. `neon/migrations/20260528_zenquanta_prism_studio_metadata.sql`
12. `neon/migrations/20260528_zenquanta_custom_assistant_builder_v2.sql`
13. `neon/migrations/20260528_zenquanta_github_readonly_integrations.sql`
14. `neon/migrations/20260603_zenquanta_artifact_versions.sql`
15. `neon/migrations/20260603_zenquanta_performance_indexes.sql`
16. `neon/migrations/20260616_zenquanta_artifact_shares.sql`
17. `neon/migrations/20260616_zenquanta_feedback_events.sql`
18. `neon/migrations/20260616_zenquanta_incremental_performance_indexes.sql`
19. `neon/migrations/20260617_zenquanta_template_shares.sql`

Checklist:

- [ ] Fresh Neon project/branch created for the beta.
- [ ] All 19 migrations applied in order, no errors.
- [ ] `pgvector` extension available/installed (needed for file knowledge) — confirm via `/admin/system-health` "pgvector" row.
- [ ] Required tables present (System Health checks `zen_users`, `zen_subscriptions`, `zen_auth_sessions`, `zen_artifact_shares`, `zen_template_shares`).
- [ ] No Supabase import/backfill scripts were run.

---

## 3. Admin account setup

Admin is gated by an admin role in `zen_profiles` (enforced by `requireAdmin` /
`requireAdminApiUser`).

Checklist:

- [ ] Operator signs up through the normal ID/password flow (`/sign-up`).
- [ ] Operator's `zen_profiles` row is promoted to the admin role (DB update).
- [ ] Operator can open `/admin`, `/admin/users/[id]`, and `/admin/system-health`.
- [ ] A non-admin test account is **redirected/denied** from all admin routes (negative test).
- [ ] At least one backup operator knows how to set the admin role in case the primary is locked out.

---

## 4. Storage provider checklist

- [ ] `FILE_STORAGE_PROVIDER` decided for beta (`local` is fine for a tiny beta but
      is **not durable** across redeploys/instances; prefer `s3`/`r2` if uploads
      must persist).
- [ ] If `s3`/`r2`: endpoint, region, bucket, access key, secret key all set and
      server-only; `/admin/system-health` "File Storage" group is healthy.
- [ ] Bucket is **private** (no public/anonymous read).
- [ ] Upload a file → it lands in the bucket; read it back only through
      `/api/files/object` (protected), never a raw bucket URL.
- [ ] Generated Prism images persist and load via protected URLs.
- [ ] Local-provider-in-production shows as a `degraded` warning on System Health
      (expected) — acknowledge or switch to s3/r2.

---

## 5. OpenRouter verification

- [ ] `OPENROUTER_API_KEY` present (System Health "AI Services" healthy).
- [ ] Send a text prompt to each text family (Nova, Velora, Axiom, Forge) and
      confirm streamed responses via `/api/chat` (no mock/fallback text).
- [ ] Confirm a usage record is logged after a send (visible in `/dashboard`).
- [ ] Confirm raw model cost is **not** exposed to non-admin users.

---

## 6. Tavily / Pulse verification

- [ ] `TAVILY_API_KEY` present (or knowingly run beta without live search).
- [ ] Ask Pulse a current-events question → response includes source context and
      sources render in the message.
- [ ] Toggle `webSearch` on a non-Pulse send and confirm sources appear.
- [ ] **No-key degradation**: with the key removed, Pulse answers without claiming
      live verification and does not error the chat.
- [ ] Pulse Research Room shows only owned message sources/artifacts and an honest
      empty state when none exist.

---

## 7. Embeddings / RAG verification

- [ ] Embeddings key present and `/admin/system-health` "RAG / Embeddings" healthy.
- [ ] pgvector confirmed (see §2).
- [ ] Upload a text/code file **and** a text-based PDF; enable `fileContext`; ask a
      question → chat cites uploaded-file source snippets.
- [ ] Open **Ask Files**, pick an indexed file + project scope, ask a question →
      uses normal `/api/chat`, returns snippets only when RAG returns them, and
      never exposes private file URLs.
- [ ] Image-only/scanned PDF shows a **skipped / no-OCR** status (not "indexed").
- [ ] With embeddings key removed: uploads still succeed but show "not indexed",
      and Ask Files shows an honest disabled/empty state.

---

## 8. GitHub integration verification (present)

GitHub repo context is implemented as a read-only integration under
`/api/integrations/github/*` (GitHub App with **Metadata + Contents read-only**).

- [ ] GitHub App env vars set; otherwise UI shows "configuration required" (not a
      false "connected" state).
- [ ] Connect a read-only installation from Command Palette / Project Home.
- [ ] Import selected README/package/source files into a project; confirm they
      become user-owned `zen_files` + `zen_file_chunks`.
- [ ] Forge / Ask Files can retrieve imported snippets.
- [ ] Installation tokens / provider URLs are **never** returned to the client.
- [ ] Import skips unsafe/oversized/binary/secrets-like files.
- [ ] If GitHub is **out of scope for this beta**, leave the App env vars unset and
      tell testers the feature is disabled.

---

## 9. Manual plan request verification

Payment is manual: users request, admins activate. No checkout/Stripe.

- [ ] On `/pricing`, a beta user can submit a plan request.
- [ ] The request appears in `/admin` plan requests.
- [ ] Request stores the intended tier (`free` | `basic` | `pro` | `ultra` | `prime`).
- [ ] No payment/checkout UI is shown or implied anywhere.

---

## 10. Admin activation verification

- [ ] Admin can activate a requested plan from `/admin` / `/admin/users/[id]`.
- [ ] After activation, the user's `zen_subscriptions` tier updates and new limits
      apply (token wallets, daily message/image limits).
- [ ] Usage overrides can be applied per user and take effect.
- [ ] Admin actions write to the admin audit log.
- [ ] Downgrade/deactivation path works and limits revert.

---

## 11. File privacy checks

- [ ] Uploaded files are only readable by their owner via `/api/files/object`.
- [ ] User A cannot read User B's file by guessing an ID (owned-lookup enforced → 401/403/404).
- [ ] File Intelligence Cards show only protected URLs and honest `knowledgeBase`
      status (pending/skipped/unsupported/failed), never raw storage keys.
- [ ] Deleting a file removes metadata, chunks, and object access (see §19).
- [ ] No raw object-store credentials or direct bucket URLs appear in any client response.

---

## 12. Search privacy checks

- [ ] Global search (`/api/search`) returns only the signed-in user's data.
- [ ] Project-scoped search does **not** leak other projects' data.
- [ ] Command palette search respects the same user/project scoping.
- [ ] Shared templates/artifacts public pages expose only the shared content — no
      `userId`, `projectId`, `conversationId`, run history, or workflow outputs.
- [ ] Revoked/expired share links return 404 at both API and page level.

---

## 13. Usage / billing enforcement checks

- [ ] Sending text decrements the correct wallet (core/tier token) and logs a usage event.
- [ ] Daily message limit blocks further sends once exhausted (with a clear message).
- [ ] Free tier limits are enforced for a fresh account.
- [ ] Enforcement happens **server-side** in `/api/chat` and `/api/images/generate`
      (not just client-side UI gating).
- [ ] `/dashboard` shows displayed usage only; raw cost/margin stays admin-only.
- [ ] Admin cost/margin analytics reconcile with logged usage for a test window.

---

## 14. Prism / image credit checks

- [ ] Generating an image decrements the **image credit wallet** and logs an image event.
- [ ] Daily image limit blocks further generations once exhausted.
- [ ] A failed Prism generation records a safe `status = failed` metadata row with
      **no** raw object URL, bucket creds, or provider secret.
- [ ] Prism Studio gallery shows owned images only, with working favorites/filters
      and protected preview URLs.
- [ ] Image credits are independent from text token wallets (exhausting one does
      not wrongly block the other).

---

## 15. Mobile responsive checks

Test on a real phone or device emulation (≤ 390px wide) and a tablet width.

- [ ] Sign-in / sign-up usable on mobile.
- [ ] Chat workspace: composer, message list, and assistant switcher usable; no
      horizontal overflow.
- [ ] Sidebar / navigation collapses appropriately.
- [ ] Settings modal, Command Palette, and dialogs are reachable and scrollable.
- [ ] `/dashboard`, `/pricing`, and `/admin/system-health` render without clipped content.
- [ ] Prism image results and Artifact Studio editor are usable on small screens.

---

## 16. Known limitations to tell beta users

State these up front so testers don't file them as bugs:

- **Manual billing**: plans are activated by an admin after a request; there is no
  checkout, card entry, or instant upgrade.
- **Password reset is admin-assisted, not self-serve email reset**: there is no
  reset email/token flow. A locked-out tester should contact the admin with their
  Zenquanta ID; the admin sets a new password from `/admin/users/[id]` (this signs
  the user out of all existing sessions). Tell testers up front so a forgotten
  password doesn't read as a bug.
- **Self-serve deletion exists, but is irreversible** — users can delete workspace
  data or the full account from Settings; admins can purge another user from
  `/admin/users/[id]`. Manual operator cleanup remains the fallback if an object
  cleanup failure needs follow-up (see §19).
- **Pulse search needs Tavily**; if it's off for the beta, answers won't cite live sources.
- **File knowledge (RAG)** only indexes text/code files and **text-based** PDFs.
  Scanned/image-only PDFs are **not** OCR'd or indexed.
- **GitHub repo context** is read-only and import-on-demand (no auto-sync/webhooks);
  may be disabled for this beta.
- **Custom assistants** are private and text-only (built on existing text modes).
- **Model Duel** is text-only (no image comparison).
- **Local file storage** (if used) may not persist across redeploys — durable
  storage requires s3/r2.
- **Memory Vault** only shows summaries that have actually been generated; older
  chats may show empty memory.
- Expect occasional latency/rate-limit hiccups from upstream model providers.

---

## 17. Bug report template

Ask testers to file each bug using this template (shared doc / issue tracker /
form). **No secrets, tokens, or full connection strings.**

```
**Title**: <short summary>

**Area**: Chat / Pulse / Files / Prism / Projects / Artifacts / Playbooks /
          Model Duel / Admin / Billing / Auth / Mobile / Other

**Severity**: Blocker / Major / Minor / Cosmetic

**Account**: <beta username or email> (do NOT include password)
**Plan tier**: free / basic / pro / ultra / prime
**Device / browser**: <e.g. iPhone 15 Safari, Chrome desktop>
**Date/time (with timezone)**:

**Steps to reproduce**:
1.
2.
3.

**Expected**:
**Actual**:

**Screenshot / screen recording**: <attach; redact any secrets/tokens>
**Console / network errors**: <paste, redact secrets>
**Reproducible?**: every time / sometimes / once
```

Triage labels for the operator: `blocker`, `privacy`, `billing`, `data-loss`,
`ux`, `mobile`, `needs-info`.

---

## 18. Rollback plan

- [ ] **Tag/record the current deploy** (commit SHA + build) before inviting testers.
- [ ] Know the one-click rollback path (e.g. redeploy previous Vercel build / revert SHA).
- [ ] **DB safety**: take a Neon backup/branch snapshot **before** beta and before
      any new migration. Migrations in this repo are additive; avoid destructive
      changes during beta.
- [ ] If a migration must be rolled back, do it on a Neon branch first, then
      promote — never hand-edit production tables under pressure.
- [ ] **Kill switch for degraded services**: removing `TAVILY_API_KEY` /
      `EMBEDDINGS_API_KEY` cleanly disables Pulse search / RAG without breaking core
      chat — use this instead of a full rollback when only one integration misbehaves.
- [ ] If OpenRouter is the problem, the app degrades to mock/fallback text rather
      than hard-failing; communicate the outage to testers.
- [ ] Have a short "beta paused" message ready to send invitees if you need to halt.

---

## 19. Data deletion / manual cleanup notes

Self-serve deletion is implemented as foreground, authenticated routes:

- User workspace-data preview/delete: `/api/account/delete-data/preview` and
  `/api/account/delete-data` with confirmation `DELETE DATA`.
- User full-account preview/delete: same routes with confirmation equal to the
  user's login ID when present, otherwise `DELETE ACCOUNT`.
- Admin target-user preview/purge: `/api/admin/users/[id]/purge/preview` and
  `/api/admin/users/[id]/purge` with confirmation `<target user id> PURGE`.

Verification status (2026-06-20): pure helper, service orchestration, route
ownership/admin-gate, safe-response, and partial object-cleanup failure tests are
automated. A guarded Playwright fixture now seeds every current purge category,
but its destructive run remains intentionally pending until an empty/schema-only
Neon branch is supplied with `PURGE_E2E_CONFIRM=dedicated-neon-branch` and
`PURGE_E2E_DATABASE_URL`. Do not mark the environment checks below complete from
unit tests or from the guard-only skipped run.

Expected behavior:

- [ ] User workspace-data deletion leaves sign-in working but removes chats,
      projects, uploads, generated images, artifacts, playbooks, prompts,
      integrations, usage/plan data, recommendation/feedback telemetry, and
      settings.
- [ ] User full-account deletion also removes credentials/sessions/integration
      tokens, tombstones `zen_users` / `zen_profiles`, clears auth cookies, and
      redirects to `/` with an account-deleted acknowledgement.
- [ ] Admin purge is blocked for the currently authenticated admin and writes safe
      `admin_user_purge_previewed` / `admin_user_purged` audit rows for other
      users.
- [ ] Preview/result payloads show grouped counts only, never bucket names,
      storage keys, source URLs, raw costs, content, secrets, or provider tokens.
- [ ] Protected file/generated-image URLs return 404 after database access is
      revoked, even if object deletion needs manual follow-up.

Manual cleanup fallback:

- [ ] Use `docs/support/per-user-cleanup-sql.md` as the operator SQL playbook
      when the self-serve/admin purge flow fails or cannot be used.
- [ ] If a purge reports object cleanup failures, inspect server logs/storage
      tooling and delete the remaining private objects without copying keys into
      user-facing reports.
- [ ] If a route fails mid-request, re-run preview for the target user and verify
      whether DB access is already revoked before touching object storage.
- [ ] Log the deletion request and completion (date, who, scope, safe counts) —
      keep no secrets.

---

## 20. First 10 beta-user tasks

Give each tester this scripted run so coverage is even and bugs surface fast:

1. **Sign up** with ID/password, then sign out and sign back in.
2. **Chat with Nova** (general) — send a multi-turn conversation; confirm it streams
   and is saved when you return.
3. **Switch assistants** — try Velora (creative), Axiom (logic), and Forge (code) on
   the same question and compare tone.
4. **Use Pulse** for a current-events question and check whether sources appear.
5. **Upload a file** (a `.txt`/`.md`/code file and a text PDF), enable file context,
   and ask a question that should cite it; then try **Ask Files**.
6. **Generate an image with Prism**, then open Prism Studio, favorite it, and reuse
   the prompt.
7. **Create a project**, move a conversation/artifact into it, and open Project Home.
8. **Save an Artifact** from a chat answer, edit it, run an AI action, and **create a
   share link**; open the link in a private/incognito window to confirm it shows
   only the shared content.
9. **Build a Playbook** (prompt workflow) with 2 steps and run it; check run history.
   Then **run Model Duel** comparing two text assistants and save a winner.
10. **Hit a limit on purpose** (send until the daily message limit blocks you),
    **submit a plan request** on `/pricing`, and check `/dashboard` usage — then
    report anything confusing via the bug template.

Bonus (optional): try the whole flow on a phone (covers §15), and test Memory Vault
+ Command Palette search.

---

## Beta readiness sign-off

- [ ] §1–§4 (env, migrations, admin, storage) fully green.
- [ ] §5–§8 (services) green or knowingly degraded with testers informed.
- [ ] §9–§14 (billing/privacy/credits) verified server-side.
- [ ] §15 mobile pass on at least one real device.
- [ ] §16 limitations sent to testers; §17 bug template shared.
- [ ] §18 rollback path + DB snapshot confirmed; §19 cleanup query set drafted.
- [ ] §20 task script sent to the first cohort.

`/admin/system-health` is the fastest pre-flight: open it last and confirm 0
`missing` rows for required services before sending invites.
