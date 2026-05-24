# Agent Workflow Guide

## Project Overview

Zenquanta AI is a Next.js App Router AI workspace. It is not the old four-mode app; agents must treat the current platform as a six-assistant product with Nova, Velora, Axiom, Forge, Pulse, and Prism.

The current app uses TypeScript, Tailwind CSS, shadcn/ui-style components, Neon Postgres, neutral private file storage, Tavily web search, OpenAI-compatible embeddings, and OpenRouter. Text chat is handled by `/api/chat`. Prism image generation is handled by `/api/images/generate`. Pulse and the `webSearch` setting use a server-only Tavily search utility to inject source context into text chat when configured. Uploaded text/code files can be extracted, chunked, embedded, stored in Neon with pgvector, and retrieved as private project/conversation knowledge when `fileContext` is enabled. Neon backs credentials auth, settings, prompt library, prompt workflows, text model comparisons, assistant recommendation telemetry, projects, conversations, messages, conversation memory, subscriptions/manual plans, usage records, plan requests, admin audit logs, dashboard data, admin cost/margin analytics, admin data, file metadata, generated-image metadata, and local browser import for app data. New uploads and generated images use the neutral storage abstraction. OpenRouter is the only AI model gateway currently represented in the code.

Current direction: keep plan upgrades manual through plan requests and admin activation. Payment automation is out of scope unless explicitly requested later. Neon starts fresh; do not import, backfill, copy, or preserve Supabase database or auth rows. Do not import, backfill, copy, or preserve old Supabase Storage objects.

## Required Reading Before Work

Every coding agent should read these files before changing code:

- `AGENTS.md`
- `AI_PROJECT.md`
- `AI_TASK_LOG.md`
- `AI_DECISIONS.md`
- `AI_CHECKLIST.md`

Useful source files to inspect for most changes:

- `types/index.ts`
- `lib/chat-context.tsx`
- `lib/config/assistants.ts`
- `lib/config/models.ts`
- `lib/config/pricing.ts`
- `lib/ai/chat.ts`
- `lib/ai/openrouter.ts`
- `lib/search/web-search.ts`
- `lib/rag/*`
- `lib/db/client.ts`
- `lib/db/repositories/index.ts`
- `lib/db/schema.ts`
- `lib/storage/object-store.ts`
- `lib/storage/attachments.ts`
- `app/api/chat/route.ts`
- `app/api/images/generate/route.ts`

## Repo Structure

- `app/`: App Router pages, server actions, and API routes.
- `app/api/`: route handlers for chat, images, auth, dashboard, admin, projects, prompts, prompt workflows, settings, attachments, and plan requests.
- `app/(assistants)/`: public pages for Nova, Velora, Axiom, Forge, Pulse, and Prism.
- `components/chat/`: main workspace UI.
- `components/auth/`: sign-in and sign-up UI.
- `components/admin/`: admin plan limit controls.
- `components/assistants/`: public assistant page component.
- `components/ui/`: shadcn/Radix UI primitives.
- `lib/ai/`: OpenRouter calls, chat orchestration, memory, and prompts.
- `lib/config/`: assistant, mode, model, image model, pricing, and preset config.
- `lib/db/`: server-only Neon client, fresh Drizzle schema foundation, and server-only repository layer.
- `lib/storage/`: neutral file storage helpers and browser-local import helpers.
- `lib/billing/`: cost calculation, enforcement, and usage logging.
- `lib/router/`: local prompt precheck and assistant recommendations.
- `neon/migrations/`: Neon database schema setup.
- `supabase/migrations/`: historical database and storage setup reference.
- `types/`: shared TypeScript domain types.

## Coding Conventions

- Prefer existing local patterns over new abstractions.
- Use `@/` imports, matching the current codebase.
- Keep TypeScript strict and explicit at public boundaries.
- Keep server-only secrets inside route handlers, server utilities, or storage/auth layers.
- Keep UI components client-side only when they need browser state or hooks.
- Preserve the current dark Tailwind/shadcn styling language unless the task explicitly changes design.
- Avoid broad refactors when a targeted change is enough.

## Architecture Conventions

- Text and image transports are intentionally separate.
- Text chat streams NDJSON events from `/api/chat`.
- Prism image generation returns JSON from `/api/images/generate`.
- Model routing belongs in `lib/config/*`.
- Prompt and generation orchestration belongs in `lib/ai/*`.
- Pulse/webSearch retrieval belongs in `lib/search/*`; Tavily keys must remain server-only.
- Uploaded-file knowledge extraction, embeddings, chunking, and retrieval belong in `lib/rag/*`; embedding keys must remain server-only.
- Fresh Neon database foundation belongs in `lib/db/*`.
- Neon repositories in `lib/db/repositories/*` are the fresh database access layer. File metadata and generated-image metadata repositories remain future scaffolding until explicit storage/durability milestones.
- Current active Neon-backed API/routes/data paths are `/api/auth/*`, `/api/settings`, `/api/prompts`, `/api/prompts/[id]`, `/api/prompt-workflows`, `/api/prompt-workflows/[id]`, `/api/prompt-workflows/[id]/runs`, `/api/model-comparisons`, `/api/model-comparisons/[id]/choose`, `/api/assistant-recommendations`, `/api/projects`, `/api/projects/[id]`, `/api/conversations`, `/api/conversations/[id]`, conversation and billing persistence inside `/api/chat` and `/api/images/generate`, `/api/images/history`, `/api/dashboard`, `/dashboard`, `/pricing`, `/api/plan-requests`, `/api/admin/*`, `/admin`, auth profile/role hydration, and local browser import app-data writes.
- The fresh Neon repository layer covers users/auth identity mapping, profiles, subscriptions, usage, plan requests, admin audit logs, projects, conversations/messages/memory, prompts, prompt workflows and run records, text model comparisons and candidates, settings, assistant recommendations, file metadata, and generated image metadata.
- Prompt workflows are not a background automation engine. V1 runs each ordered step as a normal queued chat/image send using the selected assistant family, so existing chat/image transport, billing, memory, web search, and file-context behavior remain the execution path.
- Model comparison v1 is text-only. It compares available text assistants through OpenRouter, logs usage for every generated candidate, stores comparison candidates in Neon, and saves only the selected response into the conversation.
- Admin cost and margin controls read stored Neon usage, image, subscription, override, profile, and plan request data. Raw model cost is admin-only; user dashboard surfaces should keep showing displayed usage only.
- Repositories should create fresh Neon records going forward. Do not add Supabase data import, copy, backfill, or preservation logic.
- When a repository receives only a `userId`, use the Neon user anchor helper before inserting user-owned rows so fresh `zen_users` foreign keys are satisfied.
- New private file runtime code uses the neutral object-store abstraction in `lib/storage/object-store.ts`.
- The storage abstraction supports local development storage plus S3-compatible/R2 production storage through server-only env vars.
- Store file metadata and generated-image metadata in Neon.
- Store uploaded-file text chunks and embeddings in Neon `zen_file_chunks`; raw files stay private in object storage.
- Supabase runtime clients and old Supabase-backed storage modules have been removed.
- Do not write Supabase-to-new-storage import, backfill, copy, or preservation scripts.
- Do not write Supabase-to-Neon import, backfill, copy, or preservation migrations.
- Do not assume old Supabase-hosted files remain available after the fresh storage cutover.
- Usage enforcement and logging belong in `lib/billing/*`.
- Client chat state is centralized in `lib/chat-context.tsx`.
- Assistant recommendation rules belong in `lib/router/*`.

## Commands

Current commands from `package.json`:

- Install: `npm install` is documented, but `pnpm-lock.yaml` exists. Confirm package manager before changing dependencies.
- Dev: `npm run dev`
- Build: `npm run build`
- Start: `npm run start`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`

Known command issues:

- `npm run lint` uses the ESLint flat config in `eslint.config.mjs`.
- `npm run typecheck` runs `tsc --noEmit`.
- `npm run build` should remain meaningful for production because `next.config.mjs` no longer ignores TypeScript build errors.

## Files To Update When Relevant

- Update `AI_TASK_LOG.md` when work starts, finishes, or is handed off.
- Update `AI_DECISIONS.md` when architecture decisions are made or reversed.
- Update `AI_PROJECT.md` when project capabilities, routes, services, migrations, or major risks change.
- Update `AI_CHECKLIST.md` when setup, verification, migrations, env vars, or known failure points change.
- Update `README.md` only when user-facing setup/product documentation must change.

## Minimal Change Rules

- Do not modify app code for documentation-only tasks.
- Do not change routes, APIs, auth, billing, storage, styling, or runtime behavior unless explicitly requested.
- Keep changes scoped to the requested files and behavior.
- Do not invent features. If uncertain, mark the item as unclear and cite the file to inspect next.
- Pulse has real Tavily-backed web search when `TAVILY_API_KEY` is configured. If search is unavailable, the chat path should degrade without claiming live verification.
- Do not plan Stripe checkout, webhooks, customer portal, subscription automation, or payment automation unless explicitly requested later.
- Keep plan upgrades manual and admin-driven for now.

## Handoff Rules

- Leave a concise entry in `AI_TASK_LOG.md` for meaningful work.
- Include what changed, what was verified, what remains risky, and suggested next steps.
- If tests or checks could not be run, say why.
- If another agent should continue, point them to the exact files and open questions.
