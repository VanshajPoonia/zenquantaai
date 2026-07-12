# AI Architecture Decisions

## Context Engine Is Tiered Memory + Governed Budget, Not A 5-Table Rewrite

Decision: Build the context/memory system as three additive tiers (rolling conversation summary → durable scoped memory items → cross-chat recall) plus a token governor, reusing the existing pgvector/embeddings/cheap-model plumbing — NOT the 5-table, 19-phase "context_memories + project_states + checkpoints + retrieval_logs + external_tool_results + dynamic tool selection" design from the external brief. Full plan and reconciliation live in `AI_CONTEXT_ENGINE.md`.

Rationale:

- Zenquanta has **no tool/function-calling surface** (text is streamed from OpenRouter), so the brief's dynamic-tool-selection and large-tool-result-externalization phases solve problems that don't exist here — cut.
- There is **no workspace tier** — scope is `global → project → conversation` (+ `mode` as ranking metadata only). Memory is user-global by default and project-scoped inside projects, **never mode-scoped**, because mode-scoping would defeat the user's explicit "all chats refer to each other" goal.
- pgvector @ 1536 dims (`zen_file_chunks`), `lib/rag/embeddings.ts`, cheap catalog models (`google/gemini-2.5-flash`, `deepseek/...`), and per-request token estimation already exist and are reused rather than rebuilt.
- Deferred (with build-triggers documented in `AI_CONTEXT_ENGINE.md`): dedicated `project_states` / `checkpoints` / `retrieval_logs` tables. The rolling structured summary covers checkpointing; project status folds into a memory-item `kind` first.

Invariants adopted from the external brief (its strongest ideas): **raw messages are the permanent source of truth** (summaries/memories are additive read-time optimizations, never destructive); **exact evidence** (IDs, code, routes, numbers) bypasses lossy compression; **supersession** (a correction beats stale memory via a canonical key); every phase ships **behind an env flag with the old path kept live**; prompt ordering keeps a **stable prefix first** for provider prompt caching.

Phase 1 (shipped, behind `MEMORY_V2`): replaced the regex "memory summary" in `lib/ai/memory.ts` with an async cheap-model structured summary (`lib/ai/memory-summary.ts`), run off the critical path after the response streams. See the 2026-07-11 Context Engine entry in `AI_TASK_LOG.md`.

## The Cheap-Model Summary Runs Async And Never Blocks Chat

Decision: All context-engine write work (summary now; durable-memory extraction later) runs AFTER the response has fully streamed, is gated behind flags, and is wrapped so it can never throw into the chat path.

Rationale: memory maintenance is a background optimization, not part of the user-visible turn. Adding an LLM call to the critical path would regress latency — the whole point is *cheaper and better context*, not slower responses. `maybeUpdateRollingSummary` no-ops when the flag or conversation memory is off, swallows all errors, and its DB write deliberately does not bump `updated_at` so it won't reorder the conversation list. If OpenRouter is unconfigured or returns unusable output, the existing summary is left untouched — degrading exactly like `fileContext`/`webSearch` already do.

## Durable Memory Extraction Is Its Own Cheap Call, And The Inbox Is Global

Decision (Phase 3, behind `MEMORY_EXTRACTION`): the durable-memory write gate (`lib/ai/memory-extraction.ts`) runs as a **separate** `google/gemini-2.5-flash` call, not merged into the Phase 1 rolling-summary call — even though `AI_CONTEXT_ENGINE.md` §4.1 originally sketched "one call, two jobs."

Rationale: independent flags mean independent rollout and rollback. `MEMORY_EXTRACTION` and `MEMORY_V2` must be enable-able and revert-able separately; a shared call would couple them and force a combined prompt shape. A second flash call over a ~16k-char window is a fraction of a cent and runs off the critical path (after the `done` event), so the cost is immaterial next to the safety of independent flags and independently unit-testable modules. Merging into one call *when both flags are on* is a documented cost follow-up, not a v1 requirement.

Decision: the **default inbox (`project-inbox`) and any no-project conversation map to the global memory bucket** (`project_id = null`); real projects keep their id. `resolveMemoryProjectScope` (`lib/context/memory-scope.ts`) is the single shared rule for both write and read.

Rationale: this is what makes "all chats refer to each other" true for the common case — most chats live in the inbox, so a fact learned in one inbox chat surfaces in every other inbox chat. Real projects still get isolation (their memories don't leak across projects), and global memories additionally surface inside any project. Write uses an exact-scope match so a correction supersedes the right prior item; read unions globals with the current project. Every query filters by `user_id` at the SQL level — cross-user leakage is not possible.

Related invariant: durable items store fragile tokens **verbatim** and the read path (`buildDurableMemoryBlock`) routes items flagged by `containsExactEvidence` into a "reuse verbatim — never paraphrase" section, realizing the brief's exact-evidence idea without a raw-history rescan.

## Cross-Chat Recall Is User-Scoped, And Recalled Chats Are Context Not Commands

Decision (Phase 4, behind `CROSS_CHAT_RECALL`): cross-chat *summary* recall (`searchConversationSummaries` + `retrieveCrossChatContext`) is **user-scoped, not project-scoped** — it can surface a summary of any of the user's other conversations, excluding only the current one.

Rationale: the product goal is "all chats refer to each other." A user's own threads referencing each other across projects is the feature, not a leak — every query filters by `user_id`, and only a short *summary* is exposed, never raw messages. This intentionally differs from durable memory *items* (Phase 3), which respect project isolation, because items are atomic facts injected as authoritative memory whereas a recalled conversation summary is softer, lower-stakes background. Documented so the asymmetry is deliberate, not an oversight.

Decision: the recalled-conversation block (`buildCrossChatBlock`) explicitly frames the summaries as **background context, not instructions from the user**.

Rationale: a recalled past conversation is untrusted-ish relative to the current turn — the user is not re-issuing those requests now. Framing them as context (not commands) prevents a stale past instruction from being re-executed and keeps the current message authoritative.

Decision: the Phase 4 **write depends on `MEMORY_V2`** — the summary embedding is produced inside `maybeUpdateRollingSummary`, embedding the fresh rendered summary.

Rationale: cross-chat recall retrieves *summaries*, so it needs summaries to exist and to be embedded at the moment they're regenerated (embedding a stale, one-turn-old summary from the route would be wrong). Coupling the embed to the summary job keeps it fresh and cheap (one extra embedding call, off the critical path). The read side stays independent of `MEMORY_V2`.

## TOON Is An Opt-In Swap Gated On A Measured Win Vs The Block's Current Rendering

Decision (Phase 5, `TOON_SERIALIZATION`): TOON encoding (`lib/context/toon.ts`) is never applied unconditionally. `formatWebSearchBlock` / `formatFileKnowledgeBlock` build their normal readable rendering, and `maybeToonSourceList` swaps in the TOON table only when the flag is on, there are ≥ `MIN_TOON_ROWS` (4) rows, AND `isToonWorthwhile` confirms the TOON candidate (preamble included) is ≥10% fewer estimated tokens than that readable rendering. The comparison baseline is **the block's current rendering, not minified JSON.**

Rationale:

- Comparing against what we actually ship (the readable block) — rather than a hypothetical JSON baseline — is what *guarantees no regression*: TOON can only ever replace a block with something strictly smaller, so flag-on-but-not-worthwhile is byte-identical to flag-off, which is byte-identical to today. A JSON baseline could "win" on paper while still being larger than the readable form we'd otherwise emit.
- The gate makes the honest ROI from `AI_CONTEXT_ENGINE.md` §8 self-enforcing: the source blocks are dominated by long free-text (snippets, titles), so the per-row structural saving rarely clears 10% and TOON usually stays inert. That is the correct outcome — the capability is present, correct, and unit-tested, and will engage automatically only on a genuinely uniform, short-field, high-cardinality block, without anyone having to predict where that is.
- Deliberately **not** applied to the durable-memory block: its exact-evidence vs soft-context split (and the "reuse verbatim" instruction) is worth more than a few percent of tokens, and flattening it into a table would lose that. Neighbor retrieval and extractive compression remain deferred-with-trigger rather than built speculatively.

## Durable Memory Is User-Visible And Forgettable, And Forget Is A Soft Expire

Decision (Phase 3c): the Memory Vault surfaces the durable `zen_memory_items` a user has accumulated (kind, scope, content, source chat) and lets them **forget** any item. Forgetting flips `status` to `expired` (via `neonMemoryItemsRepository.expire`) rather than hard-deleting the row. The Vault only queries durable memory when `MEMORY_EXTRACTION` is on, so a flag-off deployment pays no extra query and shows an explained empty state.

Rationale:

- The Vault's stated purpose is to "review and **control**" the memory Zenquanta reuses; showing durable facts a user can't remove would be a trust/privacy gap. Forget mirrors the existing per-conversation "Clear summary" affordance exactly (same `AlertDialog` pattern), so it adds control without a new interaction model.
- Soft-expire (not delete) keeps the system consistent with the engine's core invariant — raw is truth, this layer is additive — and preserves the supersession chain (`supersedes_id`) and any audit trail; expired rows are simply excluded from every retrieval `where status = 'active'`. `expire` is user-scoped, so it can never touch another user's memory.
- Gating the Vault's durable fetch on `MEMORY_EXTRACTION` keeps the "flag off ⇒ inert, and identical cost" discipline that every other phase follows: no feature flag means no rows exist anyway, so the query would only ever return empty — better to skip it and explain the state.

## OpenRouter Is The Only AI Gateway

Decision: Use OpenRouter as the only AI model gateway in current code.

Evidence:

- Model gateway config uses `gateway: 'openrouter'`.
- Runtime client lives in `lib/ai/openrouter.ts`.
- `OPENROUTER_API_KEY` and `OPENROUTER_BASE_URL` are the AI gateway env vars.

## Tavily Powers Pulse Web Search

Decision: Use Tavily as the first server-side web search provider for Pulse and the existing `webSearch` setting.

Evidence:

- Search helper lives in `lib/search/web-search.ts`.
- `/api/chat` requests web context when the generation mode is Pulse (`live`) or `settings.webSearch` is enabled.
- Search sources stream to the client and persist on assistant messages.
- `TAVILY_API_KEY` remains server-only.

Note: If Tavily is not configured or returns no usable sources, chat continues without claiming live verification.

## Uploaded File Knowledge Uses Neon Pgvector

Decision: Use Neon Postgres with pgvector for first-version uploaded-file knowledge retrieval.

Evidence:

- Upload indexing code lives in `lib/rag/*`.
- Text/code-like files are extracted and chunked server-side.
- Embeddings use an OpenAI-compatible `/embeddings` API with server-only keys.
- Chunks and vectors are stored in Neon `zen_file_chunks`.
- `/api/chat` retrieves scoped chunks only when `fileContext` is enabled.

Note: Raw files remain private in object storage. Advanced PDF/OCR handling is out of scope for this first version.

## Read-Only Integrations Architecture Plan

Decision: Future Google Drive, Notion, GitHub, and later Slack/Discord integrations should start as read-only, user-selected sources that import selected content into Zenquanta's existing private file and RAG knowledge model.

Core approach:

- Integrations may list and select external files, pages, repositories, or message/thread snapshots, but the first version must not write back to external services.
- Imported content becomes Zenquanta-owned metadata and chunks only after explicit user action.
- V1 should avoid automatic background crawling, scheduled sync, webhooks, delta cursors, durable retry queues, and broad workspace scanning.
- Foreground authenticated actions should handle connect, browse, import selected, refresh selected, revoke, and remove imported content.

Future Neon tables:

- `zen_integration_accounts`: user-owned provider account records with `user_id`, provider, external account id/email/name, granted scopes, status, connected/revoked timestamps, encrypted token payload metadata, and safe sync state.
- `zen_integration_items`: selected external file/page/repo/message metadata with `user_id`, provider, external id, title, mime/content type, source URL, optional `project_id`, sync status, content hash, last seen/imported timestamps, and linked `zen_files.id` when imported.
- Project links are optional and must be validated through existing project ownership.

Token storage:

- OAuth access and refresh tokens must be stored only in encrypted server-side fields, never in client-visible settings, route responses, file metadata, or logs.
- Use envelope encryption with a server-only key such as `INTEGRATION_TOKEN_ENCRYPTION_KEY`; key rotation and revocation behavior must be designed before implementation.
- Provider credentials, OAuth secrets, refresh tokens, raw provider API responses, and private source URLs must not be exposed to the browser.

Import and knowledge flow:

- Imported documents/files should create or link a `zen_files` row with `provider: 'external'`, `visibility: 'private'`, external source metadata, and no direct bucket URL unless Zenquanta stores a private imported snapshot in the neutral object store.
- Text extraction should run server-side, then chunk/embed through `lib/rag/*` and write scoped rows to `zen_file_chunks`.
- Retrieval should continue through the existing `/api/chat` file-context path and remain scoped by user/project/file ids.
- If external content cannot be extracted, is unsupported, or embeddings are unavailable, store safe skipped/failed knowledge status like File Intelligence Cards do today.

Revocation and removal:

- Revoking an integration disables the account, deletes encrypted tokens, and prevents future refresh/import calls.
- Already imported Zenquanta knowledge remains private user-owned data unless the user also chooses to remove imported content.
- Removing imported content should delete linked `zen_files` and `zen_file_chunks` rows plus connector item links, following current file privacy rules.

Product surfaces:

- Project Home should show connected source counts, recently imported items, failed/skipped sync states, and quick actions to import or refresh selected sources.
- Ask Files should treat imported indexed items like other private project files, with honest states for not indexed, embeddings unavailable, and unsupported content.
- File Intelligence Cards should display provider/source badges without exposing tokens, raw provider responses, or private external URLs.

Provider order:

1. Google Drive first, because Drive files, Docs, PDFs, and text-like assets map directly to the existing private file metadata, PDF/text extraction, File Intelligence, Project Home, and Ask Files flow.
2. Notion second, because pages and databases are valuable project knowledge but need careful page/block export normalization.
3. GitHub third, because repo and code imports are valuable for Forge/code projects, but repository size, file selection, and GitHub App versus OAuth choices should follow a proven import pipeline.
4. Slack/Discord later, treated as explicit message/thread snapshot imports, not live bot participation or background workspace indexing.

## GitHub Read-Only Integration Uses GitHub Apps

Decision: GitHub is implemented as a read-only GitHub App installation for Forge/project context, not as a broad OAuth repo-token connector.

Evidence:

- The integration routes live under `/api/integrations/github/*` and require the existing Neon-backed authenticated session.
- Server-side helpers in `lib/integrations/github.ts` create GitHub App JWTs and short-lived installation tokens using Node crypto/fetch only.
- Connection metadata is stored in `zen_integration_accounts`; selected repo/file imports are stored in `zen_integration_items`.
- Imported repository files become private `zen_files` records and are indexed through `lib/rag/*` into `zen_file_chunks`, so Forge and Ask Files reuse the existing file-context retrieval path.

Constraints:

- GitHub App permissions must remain read-only: Metadata and Contents. Do not add issue, pull request, commit, branch, status, webhook-processing, or repository write behavior in this integration.
- No GitHub tokens, installation tokens, private keys, raw provider payloads, or private source URLs may be returned to the browser.
- V1 is foreground-only: connect, list repositories, list safe files, import selected, re-import selected/project files, and disconnect local access. Scheduled sync and webhooks remain out of scope.
- Imported GitHub content remains private, user-owned, and project-scoped in Neon. Disconnecting GitHub disables future provider calls but does not delete already imported private project knowledge unless a future explicit removal flow is added.

Still out of scope after GitHub v1:

- OAuth package installation for GitHub, OAuth-style broad repo tokens, and connector routes for Google Drive/Notion/Slack/Discord.
- Supabase, Stripe, payment automation, MCP connector runtime, external vector databases, third-party analytics, or new AI gateways.
- Provider writeback, live sync claims, background jobs, crawlers, or automatic workspace indexing.

## Prompt Workflows Use The Existing Chat Queue

Decision: Reusable prompt workflows are persisted in Neon, but v1 execution uses the existing queued chat/image send path instead of a new automation engine.

Evidence:

- Workflow schema and repository code live with the Neon database layer.
- Workflow CRUD routes are additive under `/api/prompt-workflows`.
- Workflow steps target assistant families and map back to existing Zenquanta modes.
- Running a workflow queues each step as a normal text chat or Prism image request.

Note: Workflow run and step-run rows are lightweight usage metadata. Billing and usage accounting still come from the normal text/image usage events.

## Custom Assistants Layer Over Built-In Text Modes

Decision: Custom assistant builder v2 creates private user-owned text assistants in Neon, layered over existing built-in text modes, with structured metadata and billed draft testing.

Evidence:

- Custom assistants store bounded user instructions/default settings and a `baseMode` limited to `general`, `creative`, `logic`, `code`, or `live`.
- Custom assistant builder metadata lives in `zen_custom_assistants.metadata` for tone, response style, suggested use cases, pin state, and attached prompt-library shortcuts.
- `/api/chat` loads the custom assistant by authenticated user, uses its base mode for model routing/usage enforcement, and injects its instructions as an additional system context block.
- `/api/custom-assistants/test` validates an unsaved assistant draft and runs a test prompt through the existing OpenRouter text helpers, plan/model checks, and text usage logging.
- Default model selection uses existing response-profile/model-override values, not arbitrary raw provider model IDs.

Out of scope:

- Prism/image custom assistants.
- Marketplace/public sharing.
- Model-limit bypasses.

## Model Comparison Uses Text Assistants Only In V1

Decision: Model Duel v1 is the user-facing polish layer for text model comparison. It compares text assistants through OpenRouter and does not include Prism image generation.

Evidence:

- `/api/model-comparisons` generates text candidates with the existing OpenRouter text path.
- Comparison candidates store assistant family, model, latency, content, sources, and displayed usage metadata in Neon.
- Usage logging runs for every successful candidate, while only the selected candidate is saved into the conversation.
- `/api/model-comparisons/[id]/choose` appends the chosen response as the assistant message.
- Blind Mode and scoring labels are local UI review affordances; scoring labels are preserved only when saving a candidate as an Artifact.

Reason:

- Text chat and Prism image generation use separate transports and separate usage wallets.
- Keeping comparison text-only avoids mixing side-by-side text responses with image-credit generation in the first version.

## Artifacts Are Editable Neon Snapshots

Decision: Artifact Studio v1 stores user-owned, editable artifact snapshots in Neon instead of object storage, realtime documents, or AI-generated background summaries.

Evidence:

- Artifact records live in `zen_artifacts`.
- Artifact routes are protected under `/api/artifacts`.
- Artifact content is markdown/plain text stored in Neon `content`, with source details in `metadata`.
- Artifacts can be project-scoped and can reference source conversations/messages when available.
- Saving or editing artifacts does not call OpenRouter and does not create usage events.

Out of scope:

- Realtime collaboration.
- Version history.
- Full rich-document editing.
- External artifact storage.
- Background AI summarization or rewriting.

## Artifact Actions Reuse Text Billing

Decision: AI-assisted Artifact Actions run through a protected artifact route that reuses the existing OpenRouter text generation helpers and billing enforcement instead of creating a separate AI gateway or background job.

Evidence:

- Artifact action requests live under `/api/artifacts/[id]/actions`.
- The route verifies artifact ownership before generation.
- Actions use text-only assistant modes: Velora/creative, Axiom/logic, and Nova/general.
- Usage is enforced with `enforceTextUsage` and logged with `logTextUsage`.
- Client responses scrub raw model cost and margin fields.

Out of scope:

- Artifact version tables.
- Prism/image routes.
- Automatic replacement of artifact content without preview.

## Memory Vault Uses Visible Conversation Summaries

Decision: Memory Vault v1 exposes and controls existing conversation memory summaries instead of creating hidden cross-conversation memory or project-level memory tables.

Evidence:

- Conversation memory lives on `zen_conversations.memory_summary` and `memory_updated_at`.
- `/api/memory-vault` groups owned conversation memory by project for visibility.
- `/api/conversations/[id]/memory` toggles that conversation's `sessionSettings.memory` or clears its saved summary.
- Opening or clearing the vault does not call OpenRouter and does not generate new memory.

Out of scope:

- Hidden user preference memory.
- Project memory tables.
- Vector search or external memory stores.

## Neutral Private File Storage Replaces Supabase Storage

Decision: Use a neutral private object storage abstraction for new uploads and generated images.

Evidence:

- Attachment upload routes use `lib/storage/attachments.ts`.
- Provider-neutral storage lives in `lib/storage/object-store.ts`.
- Authenticated private file reads go through `/api/files/object`.
- New upload metadata is stored in `zen_files`.
- Generated image metadata is stored in `zen_generated_images`.
- Local development storage is supported, and production can use S3-compatible/R2 storage through server-only env vars.
- Auth session creation, password verification, and cookies use Neon-backed credentials auth.
- Auth profile/role hydration uses Neon profiles so admin role updates stay aligned with migrated admin data.
- Supabase migrations remain historical/product reference only.
- Supabase runtime clients and old Supabase-backed storage modules have been removed.

Note: Old Supabase-hosted files are not imported, copied, backfilled, or preserved.

## Prism Studio Uses Generated Image Metadata

Decision: Prism Studio v1 is a workspace UI over stored `zen_generated_images` metadata and protected object-store previews, while Prism generation remains exclusively on `/api/images/generate`.

Evidence:

- Gallery reads owned generated-image metadata through `/api/images/history`.
- Favorites and project assignment are additive fields on `zen_generated_images`.
- Private previews use `/api/files/object` URLs created by the storage abstraction.
- Prompt reuse/remix prepares the local Prism composer draft and does not call AI.
- Four-image variation actions queue four normal Prism sends, so image credit enforcement stays in the existing image route.
- Caption/ad/campaign actions dispatch through normal Velora text chat after explicit user confirmation.

Out of scope:

- External image storage providers beyond the existing object-store abstraction.
- Image generation through `/api/chat`.
- Background image jobs or automatic generation on gallery load.

## Neon Credentials Auth Starts Fresh

Decision: Supabase Auth is replaced by custom Neon-backed ID/password auth.

Evidence:

- Local credentials and sessions are stored in Neon auth tables.
- Sessions use opaque HTTP-only cookies.
- Passwords are hashed with per-user salts.
- Supabase Auth users, sessions, and passwords are not imported, copied, backfilled, or preserved.
- Existing users must sign up again.

## Full Account Deletion Uses Tombstoned Users

Decision: Self-serve full-account deletion and admin user purge remove user-owned data, credentials, sessions, integrations, and PII, but tombstone `zen_users` / `zen_profiles` instead of hard-deleting those rows.

Reason:

- Admin audit logs reference user rows and should remain intact after a deletion request.
- Tombstoning preserves referential integrity while removing login IDs, email/display names, external auth identifiers, credentials, sessions, provider tokens, and product data.
- Object storage cleanup is best-effort after database access is revoked, so protected file/image URLs stop working even if private bucket cleanup needs manual follow-up.
- Workspace-data deletion is intentionally less destructive: it clears user-owned workspace/product data while leaving the account, credentials, session baseline, subscription baseline, and role available.

## Neon Starts Fresh

Decision: Neon is a fresh database foundation. Do not import, copy, backfill, or preserve Supabase database rows.

Evidence:

- Neon client setup lives in `lib/db/client.ts`.
- Drizzle schema definitions live in `lib/db/schema.ts`.
- Fresh Neon migration lives in `neon/migrations/20260522_zenquanta_fresh_initial.sql`.
- The migration creates app-owned `zen_users` and product tables directly.
- The migration does not reference Supabase `auth.users`, `auth.uid()`, RLS policies, storage objects, or Supabase data-copy steps.

## Neon Repositories Back Migrated Runtime Data

Decision: Use the completed Neon repository layer for migrated runtime database data while neutral storage handles new file objects.

Evidence:

- Parallel repositories live in `lib/db/repositories/*`.
- Repository exports use `neon*Repository` names and cover the fresh Neon schema, including users/auth identities, file metadata, generated image metadata, prompt workflow records, and model comparison records.
- Active Neon-backed runtime data now includes auth, settings, prompt library, prompt workflows, text model comparisons, assistant recommendation telemetry, projects, conversations, messages, conversation memory, subscriptions, usage overrides, text usage events, image generation events, plan requests, admin audit logs, dashboard data, image history, pricing plan request flows, admin data, and profile/role hydration.
- The repository export names use a `neon*Repository` prefix to reduce accidental swaps.

Note: Repositories create fresh Neon records going forward and must not import, copy, backfill, or preserve Supabase database rows.

## Database Persistence Moves To Neon In Bounded Slices

Decision: Runtime database persistence moves to Neon through explicit route/store milestones, but never by copying Supabase data.

Planned sequence:

1. Establish fresh Neon client, schema definitions, env vars, and SQL migration.
2. Move the first low-risk runtime slice to Neon: settings, prompts, and assistant recommendation telemetry.
3. Move projects, conversations, messages, and conversation memory to Neon.
4. Move usage, manual plan, and admin data to Neon repositories.
5. Move any remaining non-storage database slices one bounded milestone at a time.
6. Replace Supabase Auth with Neon credentials auth.
7. Replace Supabase Storage with neutral private file storage.

Reason:

- Supabase runtime helper modules have been removed; only historical migrations remain for reference.
- Supabase tables are product reference only; they are not a source for Neon imports.

## Text And Image Transport Are Separate

Decision: Text chat and image generation use separate API routes.

Evidence:

- Text chat uses `/api/chat`.
- Prism image generation uses `/api/images/generate`.
- `/api/chat` rejects image-mode requests.

## Six Branded Assistant Families

Decision: The current platform uses six assistant families.

Evidence:

- `lib/config/assistants.ts` maps modes to `nova`, `velora`, `axiom`, `forge`, `pulse`, and `prism`.
- Public assistant pages exist for all six families.

## Manual Plan Request Flow

Decision: Plan upgrades are manual and admin-driven.

Evidence:

- Plan request routes and admin actions exist.
- Pricing page submits manual requests.
- No automated checkout, customer portal, or billing webhook implementation was found.

## Admin Cost Analytics Use Stored Neon Usage Data

Decision: Admin cost and margin views read real stored Neon usage, image generation, subscription, override, profile, and plan request data.

Evidence:

- Admin analytics live in `lib/db/repositories/admin.ts`.
- `/admin` and `/api/admin/overview` support date range, plan, assistant, and user filters.
- Admin views include raw model cost, displayed usage, estimated gross margin, plan-level margin, text/image split, high raw-cost users, users near limits, model rankings, and assistant rankings.

Note: Raw cost is admin-only. User dashboard surfaces should continue to show displayed usage only.

## Payment Automation Is Out Of Scope

Decision: Do not plan payment automation unless explicitly requested later.

Reason:

- The current product direction keeps plan upgrades as manual plan requests plus admin activation.
- Subscription and usage state still matter, but they should not imply automated payments.

## Separate Usage Buckets

Decision: Track usage with separate wallets for `core_tokens`, `tier_tokens`, and `image_credits`.

Evidence:

- Wallet types are defined in `types/index.ts`.
- Billing enforcement and logging use separate text and image counters.
- Plan config includes core tokens, tier tokens, and image credits.

## Conversation-Scoped Memory

Decision: Memory is scoped to a conversation.

Evidence:

- Conversation rows have `memory_summary` and `memory_updated_at`.
- `lib/ai/memory.ts` builds and injects conversation memory when enabled.

## Prompt Precheck Before Assistant Mismatch Sends

Decision: Run a local prompt classifier before sending when assistant recommendations are enabled.

Evidence:

- `hooks/usePromptPrecheck.ts` calls `getAssistantRecommendation`.
- `lib/router/*` contains assistant rules and classifier logic.
- Recommendation telemetry is sent to `/api/assistant-recommendations`.

## Admin-Managed Tier Activation

Decision: Admins activate and manage tiers.

Evidence:

- Admin pages and API routes update subscriptions and plan request statuses.
- Manual plan requests can be approved, rejected, or activated.

## Server-Only Secrets

Decision: Secret keys must remain server-only. (inferred)

Reason:

- `FILE_STORAGE_ACCESS_KEY_ID`, `FILE_STORAGE_SECRET_ACCESS_KEY`, and `OPENROUTER_API_KEY` are used by server-side code.
- Client components should only use public env vars or API routes.

## AI Playbooks Are A Product Layer Over Prompt Workflows

Decision: Use "AI Playbooks" in the workspace UX while preserving existing prompt workflow routes, Neon tables, and repository names.

Reason:

- Existing prompt workflow data remains compatible.
- Renaming backend tables/routes would add migration risk without changing product behavior.
- Playbooks remain foreground, user-triggered runs through normal chat or Prism image transports; they are not a background automation engine, cron system, worker queue, or billing bypass.

## Usage Enforcement Uses Atomic Reserve-Then-Reconcile, Not Check-Then-Act

Decision: `/api/chat` and `/api/images/generate` claim usage against the wallet/daily-limit atomically, in a single conditional `UPDATE ... WHERE ... RETURNING` against the live subscription row, before generation starts — not by checking an in-memory snapshot and deducting afterward.

Reason:

- The prior design (`enforceTextUsage`/`enforceImageUsage` checking a subscription object fetched once, with the real deduction landing only after the full LLM stream/image call completed) was a check-then-act race: concurrent requests from the same user (e.g. multiple tabs) could all read the same pre-deduction snapshot and all pass, so daily-message and wallet limits provided no real ceiling under parallel load. Found during the 2026-07-10 bug review (see `AI_TASK_LOG.md`).
- Text reservation claims a worst-case estimate (`estimatedPromptTokens + requestedMaxOutputTokens`) since actual completion length isn't known ahead of generation, then adjusts down to actual usage on success via `finalizeTextUsage`. Per-request output caps (800–8,000 tokens across plans) are tiny relative to wallet sizes (1M–8M tokens), so the worst-case claim doesn't meaningfully block legitimate concurrent usage.
- Image reservation claims the exact credit cost, since it's deterministic per model/tier — no reconciliation step needed, only release-on-failure.
- Any failure or client abort after a successful reservation calls `releaseTextUsage`/`releaseImageUsage` to fully refund the claim, preserving the existing "never charge for failed generations" behavior.
- New repository methods live in `lib/db/repositories/subscriptions.ts` (`reserveTextUsage`, `releaseTextUsage`, `finalizeTextUsage`, `reserveImageUsage`, `releaseImageUsage`). The original `incrementTextUsage`/`incrementImageUsage` and `logTextUsage`/`logImageUsage` are unchanged and still used by `app/api/artifacts/[id]/actions/route.ts`, `app/api/model-comparisons/route.ts`, and `app/api/custom-assistants/test/route.ts`, which were out of scope for this fix and remain check-then-act. If those routes see meaningful concurrent traffic, they should be migrated to the same pattern.
- `enforceTextUsage`/`enforceImageUsage` are still called first, purely for fast/specific error messages against the point-in-time snapshot; the atomic reservation is the authoritative gate and can still reject with a generic "usage limit reached" error even when the informative pre-check passed, if a concurrent request won the race.

## The Six Assistant Hues Are The Product's Signature, Not A Color Scheme

Decision: The per-mode accent colors (`--general`/`--creative`/`--logic`/`--code`/`--live`/`--image` in `app/globals.css`, consumed via `lib/mode-utils.tsx`) are the one thing agents should reach for when a surface needs a distinctive visual identity, instead of introducing a new generic gradient/glow. The 2026-07-11 design pass built `components/chat/spectrum-arc.tsx` (`SpectrumArc`) directly on top of these six existing tokens rather than inventing new brand colors.

Reason:

- The 2026-06-29 redesign pass already decided to keep these six colors as "the signature device, not replaced" rather than adopting one of the generic AI-app palette defaults (warm-cream+serif, near-black+single-accent, broadsheet). This pass reaffirms that and extends it: the six hues are unusually strong, non-generic brand material because they map 1:1 to real product concepts (Nova/Velora/Axiom/Forge/Pulse/Prism) that don't exist anywhere else, and the product name itself ("Zenquanta") plus a literal "Prism" assistant make a spectrum/refraction motif directly grounded in the subject rather than arbitrary decoration.
- `SpectrumArc` is intentionally used sparingly — `EmptyState` and `AuthGate` only — per the design skill's restraint principle ("spend your boldness in one place"). It should not be copy-pasted onto every page; if a new hero surface wants the same treatment, extend the existing component rather than duplicating its geometry.
- A serif display face (`Instrument_Serif`, `--font-display` / `.font-display` in `app/globals.css` and `app/layout.tsx`) was added as the one other deliberate identity risk this pass took, reserved for hero/wordmark text only — never dense UI chrome — so it stays legible and doesn't fight the existing Geist-based UI density.

## Neon Repositories Must Not Use Drizzle's `db.transaction()`

Decision: Database repository code must not call `db.transaction(...)` on the Drizzle client returned by `getDatabaseClient()`. Multi-statement atomicity, where actually needed, goes through the raw Neon client's own `sql.transaction([...])` batch API (`getNeonSql()`) instead, or is accepted as sequential non-atomic statements when the raw batch API doesn't fit.

Reason:

- `lib/db/client.ts` builds `getDatabaseClient()` with `drizzle-orm/neon-http`, whose driver is `@neondatabase/serverless`'s stateless HTTP client (`neon(databaseUrl)`). This driver has no persistent connection/session to hold an interactive transaction open across statements, so Drizzle's ORM-level `db.transaction(async (tx) => {...})` throws `Error: No transactions support in neon-http driver` on every call — it cannot ever work with this client, in any environment.
- Found live on 2026-07-10: `lib/db/repositories/artifacts.ts`'s `create()` used `db.transaction(...)` to insert an artifact row and its initial version row together; every Save Artifact call failed with a 500. Fixed by making the two inserts sequential instead of transactional — if the second insert fails, an artifact exists without an initial version, which is a acceptable degraded outcome (not worse than the prior 100%-broken state) and versions are added on every subsequent edit anyway.
- `lib/db/repositories/user-purge.ts` already does this correctly: its destructive multi-table delete uses `getNeonSql().transaction((tx) => [...])`, the raw Neon HTTP client's own batching API, which genuinely does support atomic multi-statement execution over HTTP. That is the right tool when atomicity across several statements is actually required against this driver — `db.transaction()` is not.
