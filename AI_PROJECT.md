# AI_PROJECT.md

Current shared project context for AI agents.

## Project Name

Zenquanta AI

## Project Purpose

Zenquanta AI is a premium multi-assistant AI workspace. The repository is intended to support a real AI wrapper platform where users do not need their own provider API keys, requests are routed to models by assistant mode and subscription tier, and backend systems track usage, persistence, limits, admin controls, and future billing.

## Current Implemented Features

Based on the repository and README, the app currently includes:

- dark-mode chat workspace
- six assistant families: Nova, Velora, Axiom, Forge, Pulse, Prism
- mode switching and mode-branded assistant UI
- streamed text response UI with working notes
- separate image generation flow for Prism
- prompt precheck and assistant recommendation modal
- prompt library
- projects for organizing chats
- conversation memory summary support
- file attachments with private Supabase storage code
- markdown and JSON export helpers
- auth UI and API routes for ID/password, magic link, reset, session, and sign-out
- user dashboard
- admin dashboard and user controls
- pricing page and manual plan request flow
- branded public assistant pages under `(assistants)`
- OpenRouter text and image transport code
- usage estimation, enforcement, and logging code

## Frontend Structure

- `app/page.tsx` renders `ChatLayout`.
- `components/chat/` contains the primary chat UI: layout, sidebar, header, chat area, composer, message rendering, mode switcher, settings panel, settings modal, assistant help, and recommendation dialog.
- `components/ui/` contains reusable UI primitives.
- `components/admin/`, `components/auth/`, and `components/assistants/` contain feature-specific UI.
- Styling is Tailwind CSS v4 with shadcn/ui-style components and CSS variables in `app/globals.css`.

## Backend/API Status

The repository already includes Next.js route handlers. Important current routes include:

- `/api/chat` for text chat execution and streamed NDJSON events
- `/api/images/generate` for Prism image generation
- `/api/images/history` for image history
- `/api/conversations` and `/api/conversations/[id]`
- `/api/projects` and `/api/projects/[id]`
- `/api/prompts` and `/api/prompts/[id]`
- `/api/settings`
- `/api/dashboard`
- `/api/attachments`
- `/api/assistant-recommendations`
- `/api/plan-requests`
- `/api/admin/*`
- `/api/auth/*`

OpenRouter is currently the only AI gateway documented in the repo. Mock text and image fallbacks exist when OpenRouter configuration is missing.

## Auth Status

Auth is Supabase-based. The current primary user-facing flow is ID/password, with supporting routes for magic link, session restore, sign-out, password reset, password update, and callback handling.

Unknown: live Supabase project status and production auth configuration.

## Database Status

Supabase migrations exist for:

- projects, conversations, messages, prompt library, user settings, and attachment storage policies
- conversation memory columns
- profiles, subscriptions, usage overrides, usage events, image generation events, plan requests, and admin audit logs
- assistant recommendation telemetry

Unknown: whether these migrations have been applied to any live Supabase project.

## State Management

Primary client state is centralized in `lib/chat-context.tsx`. Send orchestration is split across `hooks/useSendMessage.ts`, `hooks/usePromptPrecheck.ts`, and `lib/chat/sendMessage.ts`.

Persistent user data is accessed through store wrappers under `lib/storage/`. Browser storage helpers remain for local preferences and local import compatibility.

## Important Folders and Files

- `app/api/chat/route.ts`: text chat route and streaming response orchestration.
- `app/api/images/generate/route.ts`: Prism image route.
- `lib/ai/chat.ts`: conversation preparation, provider call selection, mock fallback, completion handling.
- `lib/ai/openrouter.ts`: OpenRouter client and streaming parsing.
- `lib/config/assistants.ts`: assistant family mapping and tier model selection.
- `lib/config/models.ts`: route config resolution and model override profiles.
- `lib/config/pricing.ts`: plan defaults and model pricing estimates.
- `lib/billing/`: usage enforcement, estimates, and logging.
- `lib/storage/`: Supabase store wrappers.
- `supabase/migrations/`: database schema.
- `types/index.ts`: shared app types.

## Current Priorities

- Establish shared AI-agent workflow files before product work.
- Preserve the existing UI while hardening backend behavior.
- Turn existing backend scaffolding into production-safe routing, usage, and persistence.
- Keep users on server-owned provider credentials rather than requiring user API keys.
- Prepare for future billing without adding billing prematurely.

## Incomplete Systems

- Real billing automation is not implemented; current plan upgrades are manual/admin-driven.
- Web search is represented as a session setting, but no real retrieval/search backend was verified.
- Mock fallback behavior remains when provider config is missing.
- Provider usage appears estimated locally; provider-reported usage capture should be verified or added later.
- No automated test script exists in `package.json`.
- No type-check script exists in `package.json`.
- ESLint config now exists, but `pnpm run lint` currently fails on existing React/Next lint findings.

## Technical Debt and Risks

- Usage counters and limit enforcement may need atomic database operations before production use.
- `conversationStore.save()` deletes and rewrites messages, which may be risky for concurrent sends or partial failures.
- Model pricing values are configurable estimates and may drift from OpenRouter pricing.
- The project verification workflow now uses pnpm because `pnpm-lock.yaml` exists and frozen install succeeds.
- A hardcoded admin fallback identity exists according to README and should be reviewed before production.
- Production builds need network access for Google Fonts unless font handling changes.
- Production deployment status is unknown.
