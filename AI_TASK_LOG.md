# AI Task Log

## Current Status

The repository contains a real Zenquanta AI platform backed by Neon for runtime app data and credentials auth, neutral private file storage for new uploads/generated images, and OpenRouter for AI transport. Shared AI project memory files exist at the repo root. The workspace now includes Neon-backed global search through `/api/search`, a Cmd/Ctrl+K command palette, first-run onboarding through `/api/onboarding`, Artifact Studio through `/api/artifacts`, Prism Studio through `/api/images/history`, and a Memory Vault for visible conversation memory controls. The prompt library includes reusable Neon-backed prompt workflows, the composer includes Model Duel for text assistant comparisons, and the admin dashboard includes filtered cost/margin analytics.

Current direction: plan upgrades remain manual/admin-driven, payment automation is out of scope unless explicitly requested, and Neon/storage start fresh without importing Supabase database rows or storage objects.

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
- Cross-cutting risks: conversation saves still delete/reinsert messages; local object storage is development-oriented and S3/R2 must be validated for production; the hardcoded admin fallback in `lib/db/repositories/profiles.ts` remains; advanced PDF/OCR RAG is not implemented; lint currently passes with existing warnings; there is no dedicated test script.

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
- Kept raw files private in object storage and left advanced PDF/OCR handling for later.

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
- Kept v1 focused on text/code-like files; no Supabase import, OCR/PDF expansion, or payment automation was added.

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
