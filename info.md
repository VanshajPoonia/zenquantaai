# Zenquanta AI Repository Inspection

This document summarizes the current repository state based on a read-only inspection.

## Project Memory Files

The requested project-memory files are missing at the repo root, and `rg` did not find them elsewhere:

- `AGENTS.md`
- `CLAUDE.md`
- `AI_PROJECT.md`
- `AI_TASK_LOG.md`
- `AI_DECISIONS.md`
- `AI_CHECKLIST.md`

## What This Project Is

Zenquanta AI is a Next.js App Router AI workspace with six branded assistant families:

- `Nova` for general practical assistance
- `Velora` for creative writing, tone, copy, and ideation
- `Axiom` for structured reasoning and decisions
- `Forge` for coding and implementation help
- `Pulse` for current-context and research-style work
- `Prism` for image generation

The app includes a real chat workspace, Supabase-backed auth/storage, Neon-backed app persistence, OpenRouter model calls, user/admin dashboards, manual plan requests, usage tracking, file uploads, and public assistant pages.

Important entrypoints:

- `app/page.tsx` renders the main chat app.
- `app/layout.tsx` defines metadata, fonts, dark theme, and Vercel Analytics.
- `components/chat/chat-layout.tsx` wraps the chat UI in `ChatProvider`.
- `lib/chat-context.tsx` manages most client-side app state and chat flow.

## Framework, Package Manager, And Commands

Framework and stack:

- Next.js `16.2.0`
- React `19.2.4`
- TypeScript
- Tailwind CSS v4
- shadcn-style UI components
- Radix UI primitives
- lucide-react icons
- Vercel Analytics
- Neon Postgres for app data
- Supabase Auth and Supabase Storage
- OpenRouter

Package-manager state is mixed:

- `pnpm-lock.yaml` exists, and `node_modules/.pnpm` exists, so the install appears pnpm-based.
- `README.md` says to use `npm install`.
- `package.json` has no `"packageManager"` field.

Available scripts in `package.json`:

- `dev`: `next dev`
- `build`: `next build`
- `start`: `next start`
- `lint`: `eslint .`

Observed verification issue:

- `npm run lint` fails because the repo is missing an ESLint flat config file.

## Major Folders And Files

- `app/`: App Router pages, API routes, and server actions.
- `app/api/`: backend route handlers for chat, images, auth, dashboard, admin, projects, prompts, settings, attachments, and plan requests.
- `app/(assistants)/`: public assistant pages for Nova, Velora, Axiom, Forge, Pulse, and Prism.
- `components/chat/`: main chat UI, sidebar, header, composer, messages, settings, mode switcher, and recommendation dialog.
- `components/auth/`: sign-in/sign-up gate.
- `components/admin/`: admin plan limit controls.
- `components/assistants/`: branded assistant page component.
- `components/ui/`: shadcn/Radix UI primitives.
- `lib/ai/`: chat orchestration, OpenRouter client, memory handling, and system prompts.
- `lib/config/`: assistant mappings, model routing, mode display config, presets, pricing, and image models.
- `lib/storage/`: Neon-backed stores for conversations, settings, projects, prompts, profiles, subscriptions, usage events, plan requests, recommendations, and admin views, plus Supabase Storage helpers for attachments.
- `lib/billing/`: usage estimation, enforcement, and logging.
- `lib/router/`: local prompt classifier and assistant recommendation rules.
- `types/index.ts`: shared domain types.
- `neon/migrations/`: current app database schema for Neon.
- `supabase/migrations/`: historical Supabase database migrations and current storage/auth setup context.
- `data/seed/`: seeded/demo conversations and default settings.

## Implemented Features

Implemented in code:

- Authenticated chat workspace.
- ID/password Supabase auth using synthetic login-ID emails.
- Six assistant modes/families.
- Text streaming through `/api/chat`.
- Prism image generation through `/api/images/generate`.
- Optimistic user and assistant messages.
- Queued sends while another generation is active.
- Stop generation.
- Regenerate, retry, edit last user message, and ask another mode.
- Local prompt precheck with assistant recommendation dialog.
- Recommendation telemetry endpoint.
- Conversation-scoped memory summary.
- Projects and project assignment.
- Prompt library.
- File, image, PDF, text, and code attachments.
- Supabase Storage upload for attachments.
- Signed URLs for stored attachments.
- Markdown and JSON chat export.
- User dashboard.
- Admin dashboard.
- Per-user admin page.
- Manual plan request flow.
- Plan tiers, token/image wallets, daily limits, usage events, and admin override logic.
- Public assistant brand pages at `/nova`, `/velora`, `/axiom`, `/forge`, `/pulse`, and `/prism`.

## Mock Or Demo Behavior

The main mock behavior is OpenRouter fallback:

- If `OPENROUTER_API_KEY` is missing, text responses stream from `buildMockResponse` in `lib/ai/chat.ts`.
- If OpenRouter image config is missing, Prism returns a generated placeholder SVG attachment from `lib/utils/generated-image.ts`.
- Seed/demo conversations live in `data/seed/conversations.ts` and are re-exported by `lib/mock-data.ts`, but no active imports of `MOCK_CHATS` were found during inspection.

## Backend, APIs, Auth, Database, And Billing

There is a backend implemented with Next route handlers, Neon SQL-backed data stores, and Supabase Auth/Storage wrappers.

Main API routes include:

- `/api/chat`
- `/api/images/generate`
- `/api/images/history`
- `/api/conversations`
- `/api/conversations/[id]`
- `/api/projects`
- `/api/projects/[id]`
- `/api/prompts`
- `/api/prompts/[id]`
- `/api/settings`
- `/api/attachments`
- `/api/dashboard`
- `/api/assistant-recommendations`
- `/api/plan-requests`
- `/api/admin/overview`
- `/api/admin/users`
- `/api/admin/users/[id]`
- `/api/admin/plan-requests`
- `/api/admin/plan-requests/[id]`
- `/api/auth/session`
- `/api/auth/magic-link`
- `/api/auth/sign-out`
- `/api/auth/password/sign-in`
- `/api/auth/password/sign-up`
- `/api/auth/password/reset-request`
- `/api/auth/password/update`
- `/api/bootstrap/import-local`

Auth exists:

- Implemented in `lib/auth/session.ts`.
- Login IDs are converted to synthetic emails like `id@login.zenquanta.local`.
- Auth cookies are `zenquanta-access-token` and `zenquanta-refresh-token`.
- The UI is in `components/auth/auth-gate.tsx`.
- Supabase sessions are restored through `/api/auth/session`.

Database exists through migrations:

- `20260401_zenquanta_projects_prompts.sql` creates projects, conversations, messages, prompt library, user settings, and the private `zen-attachments` bucket.
- `20260401_zenquanta_conversation_memory.sql` adds `memory_summary` and `memory_updated_at`.
- `20260401_zenquanta_billing_admin_platform.sql` creates profiles, subscriptions, overrides, usage events, image events, plan requests, admin audit logs, and related RLS policies.
- `20260401_zenquanta_assistant_recommendations.sql` creates recommendation telemetry storage.

Billing/subscription logic exists, but payment automation does not:

- Plan constants are in `lib/config/pricing.ts`.
- Subscription persistence is in `lib/storage/subscriptions.ts`.
- Usage enforcement is in `lib/billing/enforce.ts`.
- Usage logging is in `lib/billing/log-usage.ts`.
- There is no Stripe checkout, webhook, invoice, or subscription automation.
- Paid plan upgrades are manual requests reviewed and activated by admins.

## Chat Flow

The current chat flow is:

1. `ChatProvider` restores the auth session and loads settings, projects, prompts, and conversations.
2. `Composer` submits content, attachments, and optional image intent.
3. `usePromptPrecheck` runs local classification through `lib/router/promptClassifier.ts`.
4. If a high-confidence mismatch is found, `AssistantRecommendationDialog` asks whether to switch assistants.
5. `useSendMessage` resolves the send transport as text or image.
6. The client creates optimistic user and assistant placeholder messages.
7. Text requests go to `/api/chat` and stream NDJSON events.
8. Image requests go to `/api/images/generate` and return JSON.
9. The server persists the conversation, logs usage, updates subscription counters, and returns final state.

Text stream events include:

- `start`
- `working`
- `delta`
- `done`
- `error`

These event types are defined in `types/index.ts`.

## Modes, Models, State, And Mock Data

Assistant and mode mapping:

- `general` -> `nova`
- `creative` -> `velora`
- `logic` -> `axiom`
- `code` -> `forge`
- `live` -> `pulse`
- `image` -> `prism`

Key config files:

- Assistant family mapping and copy: `lib/config/assistants.ts`
- Mode UI config: `lib/config/modes.ts`
- Text model routing and response-profile overrides: `lib/config/models.ts`
- Image model routing: `lib/config/image-models.ts`
- Plan pricing and limits: `lib/config/pricing.ts`
- System presets: `lib/config/presets.ts`
- System prompts: `lib/ai/prompts/*`

State management:

- Most client-side state is centralized in `lib/chat-context.tsx`.
- Chat send helpers live in `hooks/useSendMessage.ts` and `lib/chat/sendMessage.ts`.
- Prompt precheck state lives in `hooks/usePromptPrecheck.ts`.
- Browser `localStorage` is used by `lib/storage/browser.ts` for legacy import, selected chat ID, selected project ID, and sidebar width.
- Persistent user data goes through `lib/storage/*` stores.

Mock/seed data:

- `data/seed/conversations.ts`
- `data/seed/settings.ts`
- `lib/mock-data.ts`

## UI Structure

The main workspace layout is:

- `ChatLayout`
  - `ChatProvider`
  - `AuthGate` when unauthenticated
  - `Sidebar`
  - `Header`
  - `ChatArea`
  - `Composer`
  - `SettingsPanel`
  - `SettingsModal`
  - `AssistantHelpDialog`

The UI is dark-themed by default through `app/globals.css`.

`styles/globals.css` is also tracked but not imported by `app/layout.tsx`, which imports `app/globals.css`.

## Dependencies

Major dependencies include:

- `next`
- `react`
- `react-dom`
- `typescript`
- `tailwindcss`
- `@tailwindcss/postcss`
- `tw-animate-css`
- `@vercel/analytics`
- `lucide-react`
- `zod`
- `date-fns`
- `next-themes`
- `react-hook-form`
- `@hookform/resolvers`
- `class-variance-authority`
- `clsx`
- `tailwind-merge`
- `sonner`
- `cmdk`
- `embla-carousel-react`
- `react-day-picker`
- `react-resizable-panels`
- `recharts`
- `vaul`
- many `@radix-ui/react-*` packages

## Environment Variables

Environment variables listed in `.env.example`:

- `OPENROUTER_API_KEY`
- `OPENROUTER_BASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`

Neon database connection:

- `DATABASE_URL`
- accepted aliases: `NEON_DATABASE_URL`, `POSTGRES_URL`

Supabase Auth/Storage code also accepts aliases:

- `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Important implementation detail:

- Server data persistence now goes through Neon SQL in `lib/storage/neon.ts`.
- Supabase remains required for Auth and private attachment storage.

## Incomplete Or Risky Areas

- `npm run lint` is currently broken because the repo is missing an ESLint flat config file.
- `next.config.mjs` has `typescript.ignoreBuildErrors: true`, which can hide real TypeScript failures.
- `lib/storage/profiles.ts` includes a hardcoded admin fallback identity.
- No automated test script exists in `package.json`.
- The `webSearch` setting is exposed in UI/settings, but no actual web search or retrieval implementation was found.
- Pulse is branded as current-context/research, but it appears to be prompt/model routing only.
- `styles/globals.css` and `app/globals.css` duplicate global CSS roles, but only `app/globals.css` is imported by the app.
- Conversation saves delete and reinsert all messages in `lib/storage/conversations.ts`, which is simple but risky for large histories or concurrent writes.
- PDF extraction in `lib/utils/files.ts` is a crude printable-string scan, not a real PDF parser.
- Generated image persistence is unclear. Uploaded user files go to Supabase Storage, but generated images can remain provider/data URLs in message attachments.
- Admin update logic is duplicated between server actions and API routes.
- Some imports use `@/lib/types`, which re-exports `@/types` and `@/lib/config`; this works but blurs boundaries between domain types and runtime config.

## Safest Next Build Order

1. Fix project verification first:
   - Add an ESLint flat config.
   - Stop ignoring TypeScript build errors.
   - Add a `typecheck` script.
   - Confirm `build` and typecheck pass.
2. Lock the package manager:
   - Choose pnpm or npm.
   - Add `"packageManager"` to `package.json`.
   - Update `README.md` to match.
3. Harden auth and admin:
   - Remove the hardcoded admin fallback.
   - Add stronger validation for admin forms/routes.
   - Document required Supabase Auth/Storage key behavior.
4. Make incomplete UI honest:
   - Implement real web search/retrieval for Pulse, or hide/disable the `webSearch` toggle.
5. Improve persistence robustness:
   - Avoid full message delete/reinsert saves.
   - Apply and validate the Neon migration against a real Neon database.
   - Backfill any existing Supabase Postgres production data before cutting traffic over.
   - Store generated images durably.
   - Improve attachment and PDF extraction.
6. Add tests around:
   - Chat routing
   - Billing enforcement
   - Subscription rebasing
   - Prompt recommendations
   - Auth/session flows
7. Add real billing automation only after the platform basics are hardened.
