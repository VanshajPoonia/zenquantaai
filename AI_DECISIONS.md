# AI Architecture Decisions

## OpenRouter Is The Only AI Gateway

Decision: Use OpenRouter as the only AI gateway in current code.

Evidence:

- Model gateway config uses `gateway: 'openrouter'`.
- Runtime client lives in `lib/ai/openrouter.ts`.
- `OPENROUTER_API_KEY` and `OPENROUTER_BASE_URL` are the AI gateway env vars.

## Neon Is The App Data Source Of Truth After Sign-In

Decision: Persist authenticated application data in Neon Postgres while keeping Supabase Auth and Supabase Storage.

Evidence:

- Neon-backed stores live in `lib/storage/*`.
- Auth is implemented in `lib/auth/session.ts`.
- Neon migrations create conversations, projects, prompts, settings, profiles, subscriptions, usage events, plan requests, admin audit logs, and recommendation events.

Note: Supabase remains current for auth and private attachment storage.

## Database Persistence Should Migrate To Neon Postgres

Decision: Migrate the Postgres/database layer from Supabase to Neon Postgres in phases.

Planned sequence:

1. Move Postgres-backed persistence first. Completed for the app stores.
2. Keep Supabase Auth and Supabase Storage during the first phase. (inferred)
3. Decide separately whether auth and file storage should remain on Supabase or move later. (inferred)

Reason:

- Supabase currently handles more than Postgres.
- Neon is a Postgres database target, not a direct replacement for Supabase Auth or Supabase Storage.
- Usage records, plan requests, subscriptions, admin data, conversations, projects, prompts, settings, recommendation events, and message data now use the Neon data layer.

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
