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

## Prompt Workflows Use The Existing Chat Queue

Decision: Reusable prompt workflows are persisted in Neon, but v1 execution uses the existing queued chat/image send path instead of a new automation engine.

Evidence:

- Workflow schema and repository code live with the Neon database layer.
- Workflow CRUD routes are additive under `/api/prompt-workflows`.
- Workflow steps target assistant families and map back to existing Zenquanta modes.
- Running a workflow queues each step as a normal text chat or Prism image request.

Note: Workflow run and step-run rows are lightweight usage metadata. Billing and usage accounting still come from the normal text/image usage events.

## Custom Assistants Layer Over Built-In Text Modes

Decision: Custom assistant builder v1 creates private user-owned text assistants in Neon, layered over existing built-in text modes.

Evidence:

- Custom assistants store bounded user instructions/default settings and a `baseMode` limited to `general`, `creative`, `logic`, `code`, or `live`.
- `/api/chat` loads the custom assistant by authenticated user, uses its base mode for model routing/usage enforcement, and injects its instructions as an additional system context block.
- Default model selection uses existing response-profile/model-override values, not arbitrary raw provider model IDs.

Out of scope:

- Prism/image custom assistants.
- Marketplace/public sharing.
- Model-limit bypasses.

## Model Comparison Uses Text Assistants Only In V1

Decision: Model comparison v1 compares text assistants through OpenRouter and does not include Prism image generation.

Evidence:

- `/api/model-comparisons` generates text candidates with the existing OpenRouter text path.
- Comparison candidates store assistant family, model, latency, content, sources, and displayed usage metadata in Neon.
- Usage logging runs for every successful candidate, while only the selected candidate is saved into the conversation.
- `/api/model-comparisons/[id]/choose` appends the chosen response as the assistant message.

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
