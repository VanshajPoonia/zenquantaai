# Zenquanta AI Project Context

## 1. Executive Summary

Zenquanta AI is a premium Next.js App Router AI workspace organized around six branded assistant families: Nova, Velora, Axiom, Forge, Pulse, and Prism. It is the current six-assistant product, not the older four-mode chat app.

The product solves the problem of giving users one authenticated workspace for general AI help, creative writing, structured reasoning, coding, current-context research, image generation, prompts, projects, custom assistants, usage tracking, and admin-managed access.

The project is past the initial Neon cutover at the code level. Runtime app data now uses fresh Neon Postgres and custom Neon-backed credentials auth. New uploads and generated image objects use a neutral object storage abstraction rather than Supabase Storage. AI generation routes through OpenRouter. Pulse web search uses Tavily when configured. Uploaded text/code knowledge uses OpenAI-compatible embeddings and Neon pgvector when configured.

Current product direction is conservative: plan upgrades remain manual through plan requests and admin activation. Payment automation, Stripe checkout, webhooks, customer portals, Supabase data import, and old storage object migration are out of scope.

## 2. Current Product Scope

Implemented product scope includes:

- Authenticated ID/password workspace.
- Main chat workspace at `/`.
- Six assistant families:
  - Nova for general practical work.
  - Velora for creative writing, copy, tone, and ideation.
  - Axiom for structured reasoning and decisions.
  - Forge for coding, debugging, architecture, and implementation.
  - Pulse for current-context and research-style work with Tavily-backed source retrieval when configured.
  - Prism for image generation.
- Text chat streaming through `/api/chat` as NDJSON events.
- Prism image generation through `/api/images/generate` as JSON.
- Conversation persistence, pinned conversations, projects, and project-scoped organization.
- Conversation-scoped memory summaries persisted on conversations and injected only when memory is enabled.
- Prompt library and reusable prompt workflows.
- Prompt workflow v1 execution by queueing each ordered step through the normal chat or Prism image path. There is no durable background automation engine.
- Text model comparison mode for comparing multiple text assistants through OpenRouter, recording candidates, and saving one selected response into the conversation.
- Private custom text assistants layered over built-in text modes. They are user-owned, Neon-backed, and cannot bypass plan/model limits.
- User settings, session defaults, web search toggle, memory toggle, file context toggle, system presets, and response profile/model override options.
- Local prompt precheck and assistant recommendation telemetry.
- File uploads through `/api/attachments`, private authenticated reads through `/api/files/object`, Neon file metadata, neutral object storage, and optional uploaded-file RAG for text/code-like files.
- Generated-image storage through the neutral storage layer plus generated-image metadata in Neon.
- User dashboard at `/dashboard` with displayed usage, plan state, recent conversations, and image history.
- Pricing page at `/pricing` with manual plan requests.
- Admin dashboard at `/admin` with plan request handling, user controls, usage limits, role controls, cost/margin analytics, model/assistant rankings, and users close to limits.
- Public assistant pages at `/nova`, `/velora`, `/axiom`, `/forge`, `/pulse`, and `/prism`.
- Local browser import path at `/api/bootstrap/import-local` for importing current browser-local app data into Neon-backed stores.

## 3. Core Rules And Direction

Non-negotiable project rules:

- Do not add Stripe automation.
- Do not add Stripe checkout.
- Do not add Stripe webhooks.
- Do not add a customer portal.
- Do not add automated subscription billing or payment-provider sync.
- Keep plan upgrades manual through plan requests and admin activation unless explicitly redirected later.
- Neon is fresh. Do not import, copy, backfill, or preserve Supabase database rows.
- Do not migrate old Supabase users, auth sessions, passwords, conversations, prompts, settings, usage records, subscriptions, plan requests, files, or storage objects.
- Do not treat Supabase migrations as setup prerequisites for the active app.
- Do not reintroduce Supabase runtime clients for auth, app data, or storage.
- Keep OpenRouter as the only AI generation gateway unless the architecture is explicitly changed later.
- Keep Tavily, embeddings, OpenRouter keys, storage keys, and database credentials server-only.
- Keep text chat and image generation transports separate.
- Keep usage enforcement in `lib/billing/*`.
- Keep model and assistant routing in `lib/config/*`.
- Keep Neon data access in `lib/db/*` and `lib/db/repositories/*`.
- Keep private files in neutral object storage and metadata in Neon.

## 4. Tech Stack

Actual stack from the repo:

- Framework: Next.js App Router, `next@16.2.0`.
- Runtime UI: React `19.2.4`, React DOM `19.2.4`.
- Language: TypeScript `5.7.3`, strict mode enabled in `tsconfig.json`.
- Styling: Tailwind CSS v4, `tailwindcss@4.2.0`, `@tailwindcss/postcss`, global styles in `app/globals.css`.
- UI libraries: shadcn/ui-style local components in `components/ui`, Radix UI primitives, lucide-react icons, Sonner, Recharts, Vaul, Embla, react-resizable-panels.
- Forms and validation: React Hook Form, Zod, `@hookform/resolvers`.
- Database: Neon Postgres via `@neondatabase/serverless`.
- ORM/query layer: Drizzle ORM table definitions in `lib/db/schema.ts`, Neon HTTP driver in `lib/db/client.ts`, repository layer in `lib/db/repositories/*`.
- Auth: custom Neon-backed credentials auth in `lib/auth/session.ts`; opaque HTTP-only session cookie named `zenquanta-session-token`; password hashing uses Node crypto scrypt with per-user salts.
- Storage: neutral private object storage abstraction in `lib/storage/object-store.ts`; local development provider plus S3-compatible/R2 provider support.
- AI gateway: OpenRouter only, implemented in `lib/ai/openrouter.ts`.
- Web search: Tavily via `lib/search/web-search.ts`.
- Uploaded-file embeddings: OpenAI-compatible `/embeddings` API through `lib/rag/embeddings.ts`; defaults target `text-embedding-3-small`.
- Analytics: Vercel Analytics in `app/layout.tsx`.
- Package manager situation: `README.md` documents `npm install` and scripts use npm names; `pnpm-lock.yaml` and `node_modules/.pnpm` exist. Decide npm vs pnpm before dependency changes.
- Deployment assumptions visible in repo: Next.js app with Vercel Analytics and server route handlers; no `vercel.json` is present; production storage is expected to use S3-compatible/R2 env vars if local storage is not acceptable.

Important environment variables from `.env.example`:

- `OPENROUTER_API_KEY`
- `OPENROUTER_BASE_URL`
- `TAVILY_API_KEY`
- `WEB_SEARCH_MAX_RESULTS`
- `OPENAI_API_KEY`
- `EMBEDDINGS_API_KEY`
- `EMBEDDINGS_BASE_URL`
- `EMBEDDINGS_MODEL`
- `DATABASE_URL`
- `NEON_DATABASE_URL`
- `POSTGRES_URL`
- `FILE_STORAGE_PROVIDER`
- `FILE_STORAGE_BUCKET`
- `FILE_STORAGE_LOCAL_DIR`
- `FILE_STORAGE_ENDPOINT`
- `FILE_STORAGE_REGION`
- `FILE_STORAGE_ACCESS_KEY_ID`
- `FILE_STORAGE_SECRET_ACCESS_KEY`

## 5. Current Architecture

Frontend:

- `app/page.tsx` renders `ChatLayout`.
- `components/chat/chat-layout.tsx` wraps the app in `ChatProvider`, shows `AuthGate` for unauthenticated users, and composes sidebar, header, chat area, settings panel, settings modal, and assistant help dialog.
- `lib/chat-context.tsx` centralizes client state for auth, conversations, projects, prompts, workflows, custom assistants, settings, queued sends, streaming state, prompt precheck, model comparison, import-local, and exports.
- UI components live under `components/ui`, with feature-specific components under `components/chat`, `components/auth`, `components/admin`, and `components/assistants`.

Backend/API routes:

- Next route handlers live under `app/api/*`.
- Most runtime API routes set `export const runtime = 'nodejs'`.
- Text chat is `/api/chat` and streams `application/x-ndjson`.
- Image generation is `/api/images/generate` and returns JSON.
- Server actions exist in `app/admin/actions.ts` and `app/pricing/actions.ts`.

Database layer:

- `lib/db/client.ts` reads `DATABASE_URL`, `NEON_DATABASE_URL`, or `POSTGRES_URL`, creates a Neon SQL client, and exposes a Drizzle client.
- `lib/db/schema.ts` defines the `zen_*` tables for users, credentials, sessions, profiles, subscriptions, usage, plan requests, admin audit logs, projects, conversations, messages, prompts, workflows, model comparisons, custom assistants, settings, recommendations, file metadata, file chunks, and generated image metadata.
- SQL migrations live in `neon/migrations/*`.

Repository layer:

- `lib/db/repositories/index.ts` exports `neon*Repository` modules.
- Repositories create fresh Neon records going forward. User-owned writes should ensure a `zen_users` anchor first, usually through `neonUsersRepository.ensureUserReference` or `ensureFromAuthUser`.

Auth/session layer:

- `lib/auth/session.ts` implements login ID parsing, password hashing, password verification, session creation, session reading, session revocation, cookie management, and auth attempt limiting.
- `lib/auth/require-admin.ts` protects server pages and admin APIs.
- Admin role is stored in `zen_profiles`, with a hardcoded fallback identity in `lib/db/repositories/profiles.ts`.

Object storage layer:

- `lib/storage/object-store.ts` abstracts `local`, `s3`, and `r2`.
- `lib/storage/attachments.ts` stores uploads, creates Neon file metadata, and indexes supported text/code files for knowledge retrieval.
- `lib/storage/generated-images.ts` fetches/stores generated images and records generated-image metadata.
- Private reads go through `/api/files/object`, which checks Neon file ownership and visibility.

AI/OpenRouter layer:

- `lib/ai/openrouter.ts` handles chat completion, text streaming, and image generation through OpenRouter's chat completions endpoint.
- `lib/ai/chat.ts` builds model context, injects system prompts, web search context, file knowledge context, memory, custom assistant instructions, and attachment excerpts.
- System prompts live in `lib/ai/prompts/*`.

Usage, billing, and admin layer:

- `lib/billing/costs.ts` estimates raw and displayed usage.
- `lib/billing/enforce.ts` enforces plan status, daily limits, request size, wallet availability, and image credits.
- `lib/billing/log-usage.ts` increments subscription counters and records text/image usage events.
- Admin analytics are built in `lib/db/repositories/admin.ts`.

Assistant routing layer:

- Assistant families and tier model maps live in `lib/config/assistants.ts`.
- Model route config and response profile overrides live in `lib/config/models.ts`.
- Plan limits, prices, display multipliers, and model pricing estimates live in `lib/config/pricing.ts`.
- Prompt precheck rules live in `lib/router/*`.

## 6. Main Routes

Main app routes:

- `/`: authenticated chat workspace rendered by `components/chat/ChatLayout`.
- `/dashboard`: user usage dashboard with plan state, displayed usage, assistant breakdown, recent conversations, and recent image generations.
- `/pricing`: plan overview and manual plan request flow.
- `/admin`: admin dashboard with analytics filters, user table, plan requests, cost/margin panels, risky users, high raw-cost users, model rankings, and assistant rankings.
- `/admin/users/[id]`: per-user admin detail and controls.
- `/auth/reset-password`: password reset/update UI. Password reset is currently admin-assisted, not magic-link automated.
- `/auth/callback`: compatibility route that redirects unsupported old auth callback flows.
- `/nova`: public Nova assistant page.
