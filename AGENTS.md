# Agent Workflow Guide

## Project Overview

Zenquanta AI is a Next.js App Router AI workspace. It is not the old four-mode app; agents must treat the current platform as a six-assistant product with Nova, Velora, Axiom, Forge, Pulse, and Prism.

The current app uses TypeScript, Tailwind CSS, shadcn/ui-style components, Supabase, a Neon Postgres foundation, and OpenRouter. Text chat is handled by `/api/chat`. Prism image generation is handled by `/api/images/generate`. Supabase still backs runtime app persistence, auth sessions, and private attachment storage. Neon has been added as a foundation only and is not wired into runtime stores or API routes yet. OpenRouter is the only AI gateway currently represented in the code.

Current direction: keep plan upgrades manual through plan requests and admin activation. Payment automation is out of scope unless explicitly requested later. Neon should replace the Postgres/database layer in a later phased migration, while Supabase Auth and Supabase Storage require separate future decisions.

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
- `lib/db/client.ts`
- `lib/db/repositories/index.ts`
- `lib/db/schema.ts`
- `lib/storage/supabase.ts`
- `app/api/chat/route.ts`
- `app/api/images/generate/route.ts`

## Repo Structure

- `app/`: App Router pages, server actions, and API routes.
- `app/api/`: route handlers for chat, images, auth, dashboard, admin, projects, prompts, settings, attachments, and plan requests.
- `app/(assistants)/`: public pages for Nova, Velora, Axiom, Forge, Pulse, and Prism.
- `components/chat/`: main workspace UI.
- `components/auth/`: sign-in and sign-up UI.
- `components/admin/`: admin plan limit controls.
- `components/assistants/`: public assistant page component.
- `components/ui/`: shadcn/Radix UI primitives.
- `lib/ai/`: OpenRouter calls, chat orchestration, memory, and prompts.
- `lib/config/`: assistant, mode, model, image model, pricing, and preset config.
- `lib/db/`: server-only Neon client, Drizzle schema foundation, and parallel Neon repositories.
- `lib/storage/`: current Supabase REST-backed data access plus Supabase Storage helpers.
- `lib/billing/`: cost calculation, enforcement, and usage logging.
- `lib/router/`: local prompt precheck and assistant recommendations.
- `neon/migrations/`: Neon database schema setup.
- `supabase/migrations/`: database and storage setup.
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
- Neon database foundation belongs in `lib/db/*`.
- Neon repositories in `lib/db/repositories/*` are migration targets only until a route or store is explicitly moved.
- Current runtime persistence remains in `lib/storage/*` and is Supabase-backed until a later explicit migration.
- Supabase remains current for app persistence, auth, and private attachment storage.
- Do not assume Supabase Auth or Supabase Storage have been removed.
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

Known command issues:

- `npm run lint` may fail because the repo is missing an ESLint flat config file.
- There is no `typecheck` script. Recommended check: `npx tsc --noEmit`.
- `next.config.mjs` currently sets `typescript.ignoreBuildErrors: true`, so build may hide TypeScript errors.

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
- Do not describe Pulse as having real web search unless code implements retrieval/tooling. Current repo shows Pulse branding and a `webSearch` setting, but real search/retrieval is not confirmed.
- Do not plan Stripe checkout, webhooks, customer portal, subscription automation, or payment automation unless explicitly requested later.
- Keep plan upgrades manual and admin-driven for now.

## Handoff Rules

- Leave a concise entry in `AI_TASK_LOG.md` for meaningful work.
- Include what changed, what was verified, what remains risky, and suggested next steps.
- If tests or checks could not be run, say why.
- If another agent should continue, point them to the exact files and open questions.
