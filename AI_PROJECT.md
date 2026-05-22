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
- Supabase for Auth and Storage
- Fresh Neon Postgres for migrated app persistence
- Drizzle schema definitions for the fresh Neon foundation
- Neon repositories for fresh database access and explicit route migrations
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

Neon Postgres is the active runtime database for migrated app data. Supabase Postgres is no longer the active source for the migrated settings, prompts, recommendations, projects, conversations, billing/admin, usage, plan request, dashboard, and image history flows.

The fresh Neon schema lives in `neon/migrations/20260522_zenquanta_fresh_initial.sql`, and typed Drizzle table definitions live in `lib/db/schema.ts`.

Neon repositories live in `lib/db/repositories/*`. They cover fresh Neon users/auth identity mapping, profiles, subscriptions, usage, plan requests, admin audit logs, projects, conversations/messages/memory, prompts, settings, assistant recommendations, file metadata, and generated image metadata.

Active Neon runtime data paths are:

- `/api/settings`
- `/api/prompts`
- `/api/prompts/[id]`
- `/api/assistant-recommendations`
- `/api/projects`
- `/api/projects/[id]`
- `/api/conversations`
- `/api/conversations/[id]`
- conversation persistence inside `/api/chat`
- billing enforcement and text usage logging inside `/api/chat`
- conversation persistence inside `/api/images/generate`
- billing enforcement and image usage logging inside `/api/images/generate`
- `/api/images/history`
- `/api/dashboard` and `/dashboard`
- `/pricing` and `/api/plan-requests`
- `/api/admin/*`, `/admin`, and `/admin/users/[id]`
- auth profile/role hydration
- local browser import app-data writes

These routes use clean Neon records going forward. Existing Supabase rows are not imported, copied, backfilled, or preserved.

The Neon migration creates:

- app-owned users and auth identity mapping placeholders
- profiles, subscriptions, manual plan requests, usage overrides, text/image usage events, and admin audit logs
- projects, conversations, messages, conversation memory fields, prompt library, and user settings
- assistant recommendation events, file metadata, and generated image metadata

Supabase migrations still exist because Supabase remains active for Auth and private attachment Storage. They are reference/current-runtime setup only, not prerequisites for Neon.

Neon migration order:

1. `20260522_zenquanta_fresh_initial.sql`

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

Supabase has not been removed. Supabase currently handles auth sessions and private attachment storage.

Implemented foundation and migration slices:

1. Add Neon dependency and server-only client in `lib/db/client.ts`.
2. Add typed Drizzle schema definitions in `lib/db/schema.ts`.
3. Add handwritten fresh Neon SQL schema migration for the current Zenquanta product.
4. Add server-only Neon repositories in `lib/db/repositories/*` as the fresh database access layer.
5. Migrate the first low-risk runtime routes: settings, prompts, and assistant recommendation telemetry.
6. Migrate projects, conversations, messages, and conversation memory to Neon, including chat/image persistence saves and dashboard recent conversations.
7. Move usage, image history, manual plan requests, subscriptions, usage overrides, admin audit logs, dashboard data, admin routes, admin pages, pricing plan request flows, and profile/role hydration to fresh Neon repositories.
8. Keep Supabase Auth and Supabase Storage until separate decisions are made.

Planned migration direction:

1. Start fresh in Neon. Do not import or backfill Supabase database rows.
2. Use Supabase database/schema only as reference for product capabilities.
3. Continue migrating runtime routes to Neon through explicit, bounded milestones.
4. Preserve Supabase Auth and Supabase Storage until separate decisions are made.
5. Decide later whether auth and storage should remain on Supabase or move to separate services.

Neon is not a direct replacement for Supabase Auth or Supabase Storage. Do not create Supabase-to-Neon copy/import migrations.

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
- Neon starts fresh and does not preserve old Supabase rows.
- Settings, prompts, assistant recommendation telemetry, projects, conversations, messages, conversation memory, billing/admin data, usage records, plan requests, dashboard data, image history, and admin mutations are wired to Neon.
- Supabase remains required for Auth and private attachment storage.
