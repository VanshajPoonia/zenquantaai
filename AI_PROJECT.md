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

