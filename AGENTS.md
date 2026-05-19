# AGENTS.md

Shared workflow for Codex, Claude Code, and future AI coding agents working in this repository.

Codex must treat `AGENTS.md` as the main repository instruction and workflow file before making changes.

## Required Reading Before Work

Every coding agent must read these root files before making changes:

- `AGENTS.md`
- `AI_PROJECT.md`
- `AI_TASK_LOG.md`
- `AI_DECISIONS.md`
- `AI_CHECKLIST.md`

Claude Code must also read `CLAUDE.md`.

## Required Updates After Work

- Always update `AI_TASK_LOG.md` after making repo changes.
- Update `AI_DECISIONS.md` when major architecture or product decisions change.
- Update `AI_CHECKLIST.md` when setup, commands, dependencies, verification, or workflow changes.
- Update `AI_PROJECT.md` when product scope, implemented features, repo structure, or system status changes.

If no code or docs were changed, do not invent a task log entry; report what was inspected instead.

## Project Overview

Zenquanta AI is a premium multi-assistant AI workspace. The current repository already includes a dark-mode chat UI, six branded assistant families, server API routes, Supabase-backed storage/auth concepts, tier-aware model routing config, usage enforcement/logging code, dashboards, admin routes, and OpenRouter transport.

Assistant mapping in the repo:

- `general` -> Nova
- `creative` -> Velora
- `logic` -> Axiom
- `code` -> Forge
- `live` -> Pulse
- `image` -> Prism

Important current reality: mock responses still exist as fallback behavior when OpenRouter runtime configuration is missing. Do not describe the app as only a mocked frontend.

## Tech Stack

- Next.js App Router
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui-style component structure
- Supabase Auth, Postgres, and Storage
- OpenRouter as the only AI gateway currently documented in the repo
- Lucide icons and local custom icons

## Repo Structure

- `app/`: App Router pages and route handlers.
- `app/api/`: server API routes for auth, chat, images, conversations, projects, prompts, settings, dashboard, admin, attachments, and plan requests.
- `components/chat/`: main chat workspace UI.
- `components/ui/`: reusable UI primitives.
- `components/admin/`, `components/auth/`, `components/assistants/`: feature-specific UI.
- `hooks/`: client hooks for send flow, prompt precheck, mobile/toast helpers.
- `lib/ai/`: chat preparation, prompts, memory, OpenRouter transport, image generation helpers.
- `lib/auth/`: Supabase session and login helpers.
- `lib/billing/`: usage estimates, limit enforcement, usage logging.
- `lib/config/`: assistant, model, pricing, mode, preset, and image model configuration.
- `lib/router/`: local assistant recommendation and prompt classification.
- `lib/storage/`: Supabase-backed store wrappers and browser/local storage helpers.
- `lib/utils/`: chat, files, export, stream, cost, date, image utilities.
- `supabase/migrations/`: SQL migrations for project data, memory, billing/admin, and recommendation telemetry.
- `types/`: shared TypeScript types.
- `data/seed/`: seed/local mock-era conversation and settings data.

## Architecture Conventions

- Preserve the existing text/image transport split:
  - Text assistants use `/api/chat` and streamed NDJSON.
  - Prism image generation uses `/api/images/generate` and JSON.
- Keep provider credentials server-side. Users should not need their own API keys.
- Route model selection through the existing config layer before provider calls.
- Keep subscription, usage, and model-access checks server-side.
- Treat Supabase as the source of truth after authentication.
- Prefer small route/store/config changes over large UI rewrites.
- Keep conversation memory conversation-scoped and controlled by session settings.
- Preserve project organization, prompt library, dashboard, and admin flows unless the task explicitly changes them.

## Coding Conventions

- Follow existing TypeScript and React patterns.
- Use existing local helpers before adding new abstractions.
- Keep changes minimal and focused on the requested behavior.
- Avoid unrelated refactors, formatting churn, or file moves.
- Do not change package manager, dependency versions, scripts, or migrations unless requested or required.
- Keep UI changes consistent with existing dark-mode, Tailwind, and component patterns.
- Use icons from the existing icon system or `lucide-react` when relevant.
- Do not expose server secrets to client components.

