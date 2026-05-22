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
- Supabase Auth, Postgres, REST, and Storage
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
- `/api/bootstrap/import-local`: local browser data import into Supabase.

## Auth Status

Auth is implemented through Supabase Auth in `lib/auth/session.ts`.

Current user-facing auth is ID/password-first. Login IDs are converted to synthetic emails using the `login.zenquanta.local` domain. Auth cookies are managed by the app.

## Database Status

Supabase migrations exist for:

- projects, conversations, messages, prompt library, settings, and attachments bucket
- conversation memory columns
- profiles, subscriptions, usage overrides, usage events, image events, plan requests, and admin audit logs
- assistant recommendation events

Migration order documented in `README.md`:

1. `20260401_zenquanta_projects_prompts.sql`
2. `20260401_zenquanta_conversation_memory.sql`
3. `20260401_zenquanta_billing_admin_platform.sql`
4. `20260401_zenquanta_assistant_recommendations.sql`

## Billing And Usage Status

Billing and usage tracking exist, but payment automation does not.

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

- Stripe checkout
- Stripe subscription sync
- automated billing webhooks

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
- Supabase REST wrappers in `lib/storage/supabase.ts`
- auth helpers in `lib/auth/session.ts`
- billing helpers in `lib/billing/*`

## Environment Variables

Required or expected variables:

- `OPENROUTER_API_KEY`
- `OPENROUTER_BASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`

Accepted aliases in code include:

- `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Known Incomplete Systems

- No Stripe or automated subscription billing.
- Pulse has current-context branding, and `webSearch` appears in settings, but real web search/retrieval was not confirmed in code.
- No automated test script is defined.
- No `typecheck` script is defined.

## Known Risks

- `npm run lint` may fail because ESLint 9 expects `eslint.config.js`.
- `next.config.mjs` sets `typescript.ignoreBuildErrors: true`.
- Package manager is ambiguous: `pnpm-lock.yaml` exists, while `README.md` documents `npm install`.
- `lib/storage/profiles.ts` contains a hardcoded fallback admin identity that should be reviewed before production.
- Supabase server persistence uses configured API keys directly; service-role configuration should be handled carefully.
- Conversation saves currently delete and reinsert messages, which may be risky for large histories or concurrent writes.
