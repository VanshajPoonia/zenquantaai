# Zenquanta Route Security Checklist

Use this checklist when adding or reviewing API routes, repositories, and private workspace surfaces.

## Route Protection

- Normal user feature routes must call `requireAuthenticatedUser`.
- Admin routes must call `requireAdminApiUser` for APIs or the server admin page guard for admin pages.
- Public auth compatibility routes are the exception and should stay narrowly scoped to sign-in, sign-up, reset, session, or sign-out behavior.
- Return `401` for unauthenticated protected requests before reading or writing user data.

## Ownership And Scope

- Repository reads and writes for user-owned data must include the authenticated `auth.user.id`.
- Project, conversation, artifact, file, image, prompt, playbook, assistant, memory, integration, and search IDs must not be trusted from the client without ownership validation.
- When a route accepts both `projectId` and `conversationId`, verify both are owned and the conversation belongs to the supplied project.
- Treat the default project id `project-inbox` as valid only through the project ownership/default-project helper path.
- Unknown, missing, or foreign user-owned IDs should return `404`; incompatible owned IDs should return a clear `400`.

## Private Files And Images

- Raw uploaded files must be read through `/api/files/object` or equivalent protected app URLs.
- Do not return bucket names, storage keys, storage credentials, signed storage URLs, or direct private object URLs to client components.
- Generated-image history should return protected app URLs only; provider/source image URLs remain server-side.
- Imported integration files should be represented as private Neon/file knowledge records and must not expose provider tokens or private provider URLs.

## Billing And Cost Data

- Normal-user APIs may return displayed usage, displayed credits, qualitative usage levels, image-credit counts, and plan-limit summaries.
- Raw model cost, provider cost, margin, display multipliers when sensitive, and admin analytics belong only behind admin guards.
- AI actions must use the existing text or image enforcement and usage logging paths. Do not create a separate AI gateway.

## Integrations And Secrets

- Integration provider tokens, refresh tokens, installation tokens, app private keys, OAuth secrets, Tavily keys, embedding keys, OpenRouter keys, and storage credentials must remain server-only.
- GitHub integration routes must remain read-only and foreground-only unless a future architecture decision explicitly changes that boundary.
- Do not add Supabase runtime clients, Stripe/payment automation, external vector databases, or third-party analytics without an explicit scoped milestone.

## Search And Memory

- Global and project search must be Neon-backed and scoped by authenticated user; project searches must validate project ownership first.
- Memory data must be visible and controllable by the owning user only.
- Opening memory, search, file, integration, or gallery surfaces must not trigger hidden AI calls.
