# Zenquanta AI Project State

## Project Name

Zenquanta AI

## Current Purpose

Zenquanta AI is a Next.js App Router AI workspace with branded assistant families for text chat, image generation, prompt organization, usage tracking, and admin-managed subscription access.

This is the current six-assistant platform, not the old four-mode version.

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS v4
- shadcn/ui-style components built on Radix UI
- Supabase for current app persistence, Auth, and Storage
- Neon Postgres foundation for planned database migration
- Drizzle schema definitions for Neon foundation
- Parallel Neon repositories for later route-by-route migration
- OpenRouter for AI model access
- Vercel Analytics

## Implemented Features

- Authenticated workspace.
- ID/password auth backed by Supabase.
- Six assistant families.
- Streamed text chat.
- Prism image generation.
- Conversation persistence.
- Conversation-scoped memory summaries.
- File uploads through Supabase Storage.
- Local prompt precheck and assistant recommendations.
- Projects.
- Prompt library.
- User dashboard.
- Admin dashboard.
- Per-user admin controls.
- Manual plan request flow.
- Usage tracking for text and image requests.
- Public assistant pages.

## Assistant Families

- `Nova`: general work and practical assistance.
- `Velora`: creative writing, tone, copy, and ideation.
- `Axiom`: structured reasoning and decision support.
- `Forge`: coding, debugging, architecture, and implementation.
- `Pulse`: current-context and research-style branded assistant.
- `Prism`: image generation.

Mode mapping:

- `general` -> `nova`
- `creative` -> `velora`
- `logic` -> `axiom`
- `code` -> `forge`
- `live` -> `pulse`
- `image` -> `prism`

## Main Routes

- `/`: main chat workspace.
- `/dashboard`: user usage dashboard.
- `/pricing`: plan overview and manual plan request flow.
- `/admin`: admin overview and user/request management.
- `/admin/users/[id]`: per-user admin detail.
- `/auth/reset-password`: password reset completion page.
- `/nova`, `/velora`, `/axiom`, `/forge`, `/pulse`, `/prism`: public assistant pages.

## Main APIs

- `/api/chat`: streamed text chat.
- `/api/images/generate`: Prism image generation.
- `/api/images/history`: image generation history.
- `/api/conversations` and `/api/conversations/[id]`: conversation persistence.
- `/api/projects` and `/api/projects/[id]`: project management.
- `/api/prompts` and `/api/prompts/[id]`: prompt library.
- `/api/settings`: user settings.
- `/api/attachments`: attachment upload.
- `/api/dashboard`: user dashboard data.
- `/api/assistant-recommendations`: recommendation telemetry.
- `/api/plan-requests`: user plan requests.
- `/api/admin/*`: admin overview, users, and plan requests.
- `/api/auth/*`: session, sign-in, sign-up, sign-out, magic link, and password reset/update.
- `/api/bootstrap/import-local`: local browser data import into the server-backed stores.

## Auth Status

Auth is implemented through Supabase Auth in `lib/auth/session.ts`.

Current user-facing auth is ID/password-first. Login IDs are converted to synthetic emails using the `login.zenquanta.local` domain. Auth cookies are managed by the app.

## Database Status

Supabase Postgres remains the current runtime app database. The app stores in `lib/storage/*` use Supabase REST through `lib/storage/supabase.ts`.

Neon Postgres has been added as a foundation for a later database migration. The initial Neon schema lives in `neon/migrations/20260522_zenquanta_neon_initial.sql`, and typed Drizzle table definitions live in `lib/db/schema.ts`.

Parallel Neon repositories now live in `lib/db/repositories/*`. They are not wired into runtime routes yet; current app behavior still uses `lib/storage/*`.

The Neon migration creates:

- projects, conversations, messages, prompt library, and settings
- conversation memory columns
- profiles, subscriptions, usage overrides, usage events, image events, plan requests, and admin audit logs
- assistant recommendation events

Supabase migrations still exist because Supabase remains the active runtime system for app persistence, Auth, and Storage.

Neon migration order:

1. `20260522_zenquanta_neon_initial.sql`

Supabase migration order documented in `README.md`:

1. `20260401_zenquanta_projects_prompts.sql`
2. `20260401_zenquanta_conversation_memory.sql`
3. `20260401_zenquanta_billing_admin_platform.sql`
4. `20260401_zenquanta_assistant_recommendations.sql`

## Billing And Usage Status

Billing and usage tracking exist, but payment automation does not.

Payment automation is out of scope unless explicitly requested later. Plan upgrades should remain manual plan requests with admin activation for now.

Implemented:

- plan tiers: `free`, `basic`, `pro`, `ultra`, `prime`
- core token wallet
- tier token wallet
- image credit wallet
- daily message limits
- daily image limits
- text usage events
- image generation events
- manual admin activation
- usage limit overrides

Not implemented:

- automated checkout
- automated subscription sync
- automated billing webhooks
- customer portal

## Storage Status

Supabase Storage is used for attachments through the private `zen-attachments` bucket. Attachment upload code lives in `lib/storage/attachments.ts` and `app/api/attachments/route.ts`.

Generated image durability should be reviewed. Provider/data URLs can be attached to messages, but generated-image storage is not clearly equivalent to uploaded attachment storage.

## Model Routing Status

OpenRouter is the only AI gateway in current code.

Key files:

- `lib/config/assistants.ts`
- `lib/config/models.ts`
- `lib/config/image-models.ts`
- `lib/ai/openrouter.ts`
- `lib/ai/chat.ts`

Text assistant routing and response profile overrides are centralized in config. Prism image routing is separate from text chat.

## Neon Postgres Migration Status

Supabase has not been removed. Supabase currently handles runtime app persistence, auth sessions, and private attachment storage.

Implemented foundation:

1. Add Neon dependency and server-only client in `lib/db/client.ts`.
2. Add typed Drizzle schema definitions in `lib/db/schema.ts`.
3. Add handwritten Neon SQL schema migration for the current `zen_*` tables.
4. Add parallel Neon repositories in `lib/db/repositories/*`.

Planned migration direction:

1. Migrate Postgres-backed persistence from Supabase to Neon Postgres in a later explicit store/API migration.
2. Swap one feature area at a time from `lib/storage/*` to `lib/db/repositories/*`, verify behavior, then continue.
3. Preserve Supabase Auth and Supabase Storage during the first database migration phase.
4. Decide later whether auth and storage should remain on Supabase or move to separate services.

Neon is not a direct replacement for Supabase Auth or Supabase Storage. Any implementation plan should inventory current tables, storage buckets, auth identity usage, RLS/policy assumptions, admin data, usage records, plan requests, and subscription records before changing runtime code.

## Frontend Structure

The main workspace is composed from:

- `components/chat/chat-layout.tsx`
- `lib/chat-context.tsx`
- `components/chat/sidebar.tsx`
- `components/chat/header.tsx`
- `components/chat/chat-area.tsx`
- `components/chat/composer.tsx`
- `components/chat/message.tsx`
- `components/chat/settings-panel.tsx`
- `components/chat/settings-modal.tsx`

The auth gate is `components/auth/auth-gate.tsx`.

## Backend Structure

Backend logic is implemented with Next route handlers and server actions:

- route handlers under `app/api/*`
- server actions in `app/admin/actions.ts` and `app/pricing/actions.ts`
- Neon database foundation in `lib/db/client.ts` and `lib/db/schema.ts`
- Parallel Neon repositories in `lib/db/repositories/*`
- Supabase REST and Storage helpers in `lib/storage/supabase.ts`
- auth helpers in `lib/auth/session.ts`
- billing helpers in `lib/billing/*`

## Environment Variables

Required or expected variables:

- `OPENROUTER_API_KEY`
- `OPENROUTER_BASE_URL`
- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`

Accepted aliases in code include:

- `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEON_DATABASE_URL`
- `POSTGRES_URL`

## Known Incomplete Systems

- No payment automation or automated subscription billing; manual plan requests and admin activation remain the intended flow.
- Pulse has current-context branding, and `webSearch` appears in settings, but real web search/retrieval was not confirmed in code.
- No automated test script is defined.
- No `typecheck` script is defined.
- Auth and storage replacement decisions are still incomplete.

## Known Risks

- `npm run lint` may fail because the repo is missing an ESLint flat config file.
- `next.config.mjs` sets `typescript.ignoreBuildErrors: true`.
- Package manager is ambiguous: `pnpm-lock.yaml` exists, while `README.md` documents `npm install`.
- `lib/storage/profiles.ts` contains a hardcoded fallback admin identity that should be reviewed before production.
- Supabase Storage uses configured API keys directly; service-role configuration should be handled carefully.
- Conversation saves currently delete and reinsert messages, which may be risky for large histories or concurrent writes.
- Neon repositories are not active runtime persistence yet; routes and storage stores should not import them until a later migration milestone.
