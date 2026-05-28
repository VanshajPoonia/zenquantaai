# AI Architecture Decisions

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
