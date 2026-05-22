# Zenquanta AI Repository Info

## Current Project

Zenquanta AI is a Next.js App Router AI workspace with six assistant families: Nova, Velora, Axiom, Forge, Pulse, and Prism. It uses TypeScript, Tailwind CSS, shadcn/ui-style components, Neon Postgres, custom Neon-backed ID/password auth, neutral private file storage, and OpenRouter.

This is a fresh cutover. Old Supabase database rows, auth users, sessions, passwords, and storage objects are not imported, copied, backfilled, or preserved.

## Active Runtime Stack

- Next.js App Router and React.
- Neon Postgres for app data and credentials auth.
- Drizzle table definitions in `lib/db/schema.ts`.
- Neon repositories in `lib/db/repositories/*`.
- Neutral file storage in `lib/storage/object-store.ts`, `lib/storage/attachments.ts`, and `lib/storage/generated-images.ts`.
- OpenRouter as the only AI gateway.
- Manual plan requests and admin activation for upgrades.

## Main Implemented Features

- ID/password sign-in and sign-up.
- Authenticated chat workspace.
- Streamed text chat via `/api/chat`.
- Prism image generation via `/api/images/generate`.
- Conversation persistence and conversation-scoped memory.
- Projects, prompt library, and user settings.
- File uploads and private authenticated file reads.
- Generated image storage and metadata.
- Usage tracking for text and image events.
- User dashboard and admin dashboard.
- Manual plan request workflow.
- Assistant recommendation telemetry.
- Public assistant pages.

## Data And Storage

Neon is the source of truth for:

- users, credentials, sessions, and profiles
- subscriptions, usage overrides, usage events, image events, plan requests, and admin audit logs
- projects, conversations, messages, memory fields, prompts, settings, and assistant recommendation events
- file metadata and generated image metadata

Neutral object storage is the source of truth for new private uploaded files and generated image objects. Local development uses `.storage/zenquanta`; production should use `FILE_STORAGE_PROVIDER=s3` or `FILE_STORAGE_PROVIDER=r2`.

## Historical Supabase Files

Supabase runtime clients and old Supabase-backed data/storage modules have been removed.

The files in `supabase/migrations/*` remain only as historical/product reference. They are not part of active setup and should not be used to import, copy, backfill, or preserve old Supabase data.

## Commands

- Install: `npm install` is documented, but `pnpm-lock.yaml` exists.
- Dev: `npm run dev`
- Build: `npm run build`
- Start: `npm run start`
- Lint: `npm run lint`
- Recommended typecheck: `npx tsc --noEmit`

Known issue: `npm run lint` currently fails because the repo is missing an ESLint flat config.

## Environment Variables

Active env vars:

- `OPENROUTER_API_KEY`
- `OPENROUTER_BASE_URL`
- `DATABASE_URL`
- `FILE_STORAGE_PROVIDER`
- `FILE_STORAGE_BUCKET`
- `FILE_STORAGE_LOCAL_DIR`
- `FILE_STORAGE_ENDPOINT`
- `FILE_STORAGE_REGION`
- `FILE_STORAGE_ACCESS_KEY_ID`
- `FILE_STORAGE_SECRET_ACCESS_KEY`

Neon aliases accepted by code:

- `NEON_DATABASE_URL`
- `POSTGRES_URL`

## Current Risks

- Lint is not usable until an ESLint flat config is added.
- `next.config.mjs` ignores TypeScript build errors, so `npx tsc --noEmit` matters.
- Package manager choice is ambiguous because `pnpm-lock.yaml` exists while README uses npm.
- Pulse has current-context branding, but real retrieval/search is not confirmed.
- Local file storage is suitable for development; production should use durable S3-compatible/R2 storage.
