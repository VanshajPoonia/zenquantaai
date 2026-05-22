# AI Architecture Decisions

## OpenRouter Is The Only AI Gateway

Decision: Use OpenRouter as the only AI gateway in current code.

Evidence:

- Model gateway config uses `gateway: 'openrouter'`.
- Runtime client lives in `lib/ai/openrouter.ts`.
- `OPENROUTER_API_KEY` and `OPENROUTER_BASE_URL` are the AI gateway env vars.

## Supabase Remains Current For Auth And Storage

Decision: Keep Supabase Auth sessions and Supabase private attachment Storage while migrated app database slices use fresh Neon repositories.

Evidence:

- Attachment upload routes still use Supabase Storage helpers.
- Auth session creation, refresh, and cookies still use Supabase Auth.
- Auth profile/role hydration now uses Neon profiles so admin role updates stay aligned with migrated admin data.
- Auth is implemented in `lib/auth/session.ts`.
- Supabase migrations still define the historical/current Auth and Storage setup.

Note: Supabase remains current for Auth and private attachment storage until later explicit decisions.

## Neon Starts Fresh

Decision: Neon is a fresh database foundation. Do not import, copy, backfill, or preserve Supabase database rows.

Evidence:

- Neon client setup lives in `lib/db/client.ts`.
- Drizzle schema definitions live in `lib/db/schema.ts`.
- Fresh Neon migration lives in `neon/migrations/20260522_zenquanta_fresh_initial.sql`.
- The migration creates app-owned `zen_users` and product tables directly.
- The migration does not reference Supabase `auth.users`, `auth.uid()`, RLS policies, storage objects, or Supabase data-copy steps.

## Neon Repositories Back Migrated Runtime Data

Decision: Use the completed Neon repository layer for migrated runtime database data while keeping Supabase Auth and Storage in place.

Evidence:

- Parallel repositories live in `lib/db/repositories/*`.
- Repository exports use `neon*Repository` names and cover the fresh Neon schema, including users/auth identities, file metadata, and generated image metadata.
- Active Neon-backed runtime data now includes settings, prompt library, assistant recommendation telemetry, projects, conversations, messages, conversation memory, subscriptions, usage overrides, text usage events, image generation events, plan requests, admin audit logs, dashboard data, image history, pricing plan request flows, admin data, and profile/role hydration.
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
6. Keep Supabase Auth and Supabase Storage until separate decisions are made. (inferred)
7. Decide separately whether auth and file storage should remain on Supabase or move later. (inferred)

Reason:

- Supabase currently handles more than Postgres.
- Neon is a Postgres database target, not a direct replacement for Supabase Auth or Supabase Storage.
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

- `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `OPENROUTER_API_KEY` are used by server-side code.
- Client components should only use public env vars or API routes.

## Pulse Current-Context Branding Without Confirmed Retrieval

Decision: Treat Pulse as current-context branded, but do not claim real web search/retrieval is implemented. (inferred)

Reason:

- Pulse copy and prompt describe current-context research.
- A `webSearch` setting exists.
- No concrete retrieval or web search implementation was confirmed during inspection.
