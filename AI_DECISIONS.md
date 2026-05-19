# AI_DECISIONS.md

Current technical and product decisions observed from the repository. Inferred decisions are labeled as inferred.

## Current Architecture Decisions

- Use Next.js App Router for pages and route handlers.
- Keep the main chat workspace at `/`.
- Use six branded assistant families: Nova, Velora, Axiom, Forge, Pulse, and Prism.
- Map assistant modes through config rather than scattering model IDs through UI code.
- Use OpenRouter as the current AI gateway.
- Keep text chat and image generation on separate transports:
  - `/api/chat` streams text responses as NDJSON.
  - `/api/images/generate` returns JSON for Prism image generation.
- Use Supabase for auth, Postgres-backed data, and storage.
- Use server-side provider keys so users do not need their own API keys.
- Track text usage separately from image usage.
- Use subscription tiers and wallets: `core_tokens`, `tier_tokens`, and `image_credits`.
- Use manual plan requests and admin activation for current upgrades.

## Inferred Decisions

- Inferred: The existing UI should be preserved while backend behavior is hardened incrementally.
- Inferred: User-visible model/provider details are intentionally abstracted behind branded assistant names and response profiles.
- Inferred: Browser/local storage remains only for local preferences and import compatibility after auth.
- Inferred: Future billing should build on the existing subscription and usage-event tables rather than replacing them outright.

## Patterns To Preserve

- Route all provider calls through server code.
- Keep model resolution in `lib/config/` and assistant mappings in one place.
- Keep usage enforcement in backend routes before model calls.
- Keep usage logging after successful generation.
- Keep session settings normalized through existing config helpers.
- Keep UI components dark-mode-first and consistent with existing Tailwind/shadcn patterns.
- Keep changes small, focused, and compatible with existing conversation/project/prompt flows.

## Anti-Patterns To Avoid

- Do not ask users for provider API keys as the default product path.
- Do not call AI providers directly from client components.
- Do not duplicate model IDs throughout UI components.
- Do not merge image generation into the text streaming route without a documented reason.
- Do not rewrite the chat UI as part of backend hardening unless the task requires it.
- Do not silently ignore failing verification commands.
- Do not introduce billing automation without recording decisions and migration implications.

## UI / Component Decisions

- The chat UI is componentized under `components/chat/`.
- The existing UI uses mode-specific styling and assistant branding.
- Settings are split between a per-session settings panel and a broader settings modal.
- Prompt precheck uses a recommendation dialog only for high-confidence mismatches.
- Message rendering supports streaming state, working notes, attachments, and image display.

## State Management Decisions

- Client chat state is centralized in `lib/chat-context.tsx`.
- Send flow is coordinated by `hooks/useSendMessage.ts`, `hooks/usePromptPrecheck.ts`, and `lib/chat/sendMessage.ts`.
- Server persistence is abstracted through `lib/storage/` stores.
- Conversation memory is conversation-scoped and controlled by session settings.

