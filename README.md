# Zenquanta AI

Zenquanta AI is a premium multi-assistant workspace built with Next.js, TypeScript, Tailwind CSS, shadcn/ui, Supabase, and OpenRouter.

This is no longer the older four-mode chat app. The current platform includes:

- six branded assistant families
- tier-aware model routing
- separate text and image generation flows
- local prompt precheck with assistant recommendations
- live `Working notes` during streaming text responses
- conversation memory
- manual plan requests and admin activation
- user and admin dashboards
- branded public assistant pages

## Assistant Families

Zenquanta currently ships with these assistant families:

- `Nova` for broad practical work and everyday assistance
- `Velora` for creative writing, tone, copy, ideation, and brand language
- `Axiom` for structured reasoning, comparison, and decision support
- `Forge` for coding, debugging, refactoring, and implementation
- `Pulse` for current-context, research-style, and latest-information work
- `Prism` for image generation

Mode mapping in the app:

- `general` → `Nova`
- `creative` → `Velora`
- `logic` → `Axiom`
- `code` → `Forge`
- `live` → `Pulse`
- `image` → `Prism`

## How It Works

Zenquanta combines a branded multi-assistant UI with tier-aware backend routing:

- chats are organized by assistant family and project
- OpenRouter is the only AI gateway
- Supabase handles auth, sync, storage, subscriptions, usage records, plan requests, and admin data
- text assistants route through `/api/chat`
- `Prism` routes through `/api/images/generate`
- text and image usage are billed and tracked separately
- conversation memory is stored per conversation and only injected when memory is enabled

Before a new message is sent, Zenquanta runs a fast local prompt precheck:

- image-style prompts strongly recommend `Prism`
- coding and debugging prompts strongly recommend `Forge`
- latest/current-events prompts strongly recommend `Pulse`
- comparison and structured reasoning prompts strongly recommend `Axiom`
- creative writing and rewrite prompts strongly recommend `Velora`
- everything else falls back to `Nova`

If the current assistant is already a good fit, the message sends immediately. If there is a high-confidence mismatch, the app shows a recommendation dialog with:

- `Switch and Continue`
- `Continue with Current`
- `Cancel`

During streamed text responses, the UI can also show a live `Working notes` panel. This is a display-safe progress view, not hidden chain-of-thought.

## Plan Ladder

The current plan ladder is:

- `Free`
- `Basic`
- `Pro`
- `Ultra`
- `Prime`

The billing layer uses separate wallets:

- `core_tokens`
- `tier_tokens`
- `image_credits`

The app stores both:

- `raw cost` for internal/admin tracking
- `displayed cost` for user-facing usage and credits

Normal users see displayed usage only. Admins can see both raw and displayed values.

### Current Plan Defaults

These defaults come from `lib/config/pricing.ts` and are the values an account rebases to when its tier changes, unless an admin intentionally saves custom overrides.

| Tier | Core Tokens | Tier Tokens | Image Credits | Daily Messages | Max Input Tokens | Max Output Tokens | Images / Day |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `Free` | 1,000,000 | 0 | 50 | 50 | 8,000 | 800 | 2 |
| `Basic` | 2,000,000 | 0 | 150 | 250 | 16,000 | 1,500 | 5 |
| `Pro` | 3,000,000 | 650,000 | 400 | 700 | 32,000 | 2,500 | 15 |
| `Ultra` | 5,000,000 | 2,700,000 | 1,200 | 1,500 | 64,000 | 5,000 | 40 |
| `Prime` | 8,000,000 | 8,000,000 | 4,000 | 3,000 | 128,000 | 8,000 | 100 |

Displayed usage multipliers:

- `free` → `2.0`
- `basic` → `2.0`
- `pro` → `1.5`
- `ultra` → `1.5`
- `prime` → `1.5`

## Current Feature Set

- authenticated ID + password workspace
- draft-first new chats
- immediate first-message chat entry
- project-based chat organization
- prompt library
- conversation memory
- streamed text responses
- live `Working notes` during text generation
- local assistant recommendation modal before mismatched sends
- image generation with `Prism`
- image history
- in-app image viewer and image download
- file uploads with private Supabase-backed storage
- markdown and JSON exports
- user dashboard
- admin dashboard
- branded assistant pages:
  - `/nova`
  - `/velora`
  - `/axiom`
  - `/forge`
  - `/pulse`
  - `/prism`

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- OpenRouter
- Supabase Auth
- Supabase Postgres
- Supabase Storage

## Auth Flow

The current primary auth UI is:

- ID + password sign-in
- ID + password sign-up
- password reset

Supabase still manages sessions underneath, but the user-facing auth flow is currently ID/password-first.

The auth UI also includes:

- ID guidance
- confirm password on sign-up
- show/hide password
- contact-admin support link

## Platform Architecture

### Text vs Image Transport

Transport is intentionally separated:

- `/api/chat` is text-only and returns streamed NDJSON events
- `/api/images/generate` is `Prism`-only and returns JSON

The frontend does not try to parse image generation as text streaming.

### Usage Model

Usage is tracked in three separate buckets:

- `core_tokens` for lower-cost text routes
- `tier_tokens` for premium text routes
- `image_credits` for image generation

Image usage is tracked independently from text usage in both user and admin views.

### Memory

Conversation memory is conversation-scoped:

- a rolling memory summary is persisted with the conversation
- recent turns remain verbatim
- older context is compressed into `memory_summary`
- memory is only injected when the session `memory` setting is enabled

### Admin Tier Updates

When an admin changes a user tier:

- the subscription row is updated to the new plan defaults
- daily limits, token caps, and image caps rebase to the new plan
- true custom overrides can still be saved intentionally

## Main Routes

- `/`
  - main chat workspace
- `/dashboard`
  - user usage dashboard
- `/pricing`
  - plan overview and manual plan request flow
- `/admin`
  - admin overview, user management, and request handling
- `/admin/users/[id]`
  - deeper admin controls for one user
- `/nova`
- `/velora`
- `/axiom`
- `/forge`
- `/pulse`
- `/prism`
  - branded assistant landing pages
- `/auth/reset-password`
  - password recovery completion page

## Main APIs

- `/api/chat`
  - text chat execution and usage logging
- `/api/images/generate`
  - image generation through `Prism`
- `/api/images/history`
  - recent image usage/history
- `/api/assistant-recommendations`
  - recommendation telemetry sink
- `/api/plan-requests`
  - user plan request submission
- `/api/admin/*`
  - admin overview, user detail, user updates, and request actions
- `/api/auth/*`
  - sign-in, sign-up, password reset, session, sign-out

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create your local env file:

```bash
cp .env.example .env.local
```

3. Fill in `.env.local`:

```env
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

4. Start the app:

```bash
npm run dev
```

5. Open:

```text
http://localhost:3000
```

## Supabase Setup

After creating your Supabase project, apply the migrations in this order:

1. `20260401_zenquanta_projects_prompts.sql`
2. `20260401_zenquanta_conversation_memory.sql`
3. `20260401_zenquanta_billing_admin_platform.sql`
4. `20260401_zenquanta_assistant_recommendations.sql`

### What Each Migration Enables

`20260401_zenquanta_projects_prompts.sql`

- `zen_projects`
- `zen_conversations`
- `zen_messages`
- `zen_prompt_library`
- `zen_user_settings`
- private `zen-attachments` storage bucket
- base RLS and ownership policies

`20260401_zenquanta_conversation_memory.sql`

- `memory_summary`
- `memory_updated_at`

This enables conversation-scoped rolling memory.

`20260401_zenquanta_billing_admin_platform.sql`

- `zen_profiles`
- `zen_subscriptions`
- `zen_usage_limit_overrides`
- `zen_usage_events`
- `zen_image_generation_events`
- `zen_plan_change_requests`
- `zen_admin_audit_logs`

This enables the tiered usage system, plan request workflow, dashboards, and admin platform.

`20260401_zenquanta_assistant_recommendations.sql`

- `zen_assistant_recommendation_events`

This enables recommendation telemetry for the prompt precheck flow.

### URL Configuration

For local development:

- `Site URL`: `http://localhost:3000`
- Redirect URL: `http://localhost:3000/auth/callback`

For production, add your deployed domain and callback URL too.

## Admin Bootstrap

After signing up the account you want to use as admin, update the profile role in Supabase SQL:

By login ID:

```sql
update public.zen_profiles
set role = 'admin'
where login_id = 'your-login-id';
```

Or by email:

```sql
update public.zen_profiles
set role = 'admin'
where email = 'your-email@example.com';
```

Then:

1. sign out
2. sign back in
3. open `/admin`

Operator note:

- this repo currently includes one hardcoded internal fallback admin identity in `lib/storage/profiles.ts`
- review or remove that behavior before production if you want database-only admin control

## Manual Plan Request Flow

Current plan upgrades are manual.

User flow:

1. open `/pricing`
2. choose a paid plan
3. optionally add contact and a note
4. submit the request
5. see a pending banner while waiting for activation

Admin flow:

1. open `/admin`
2. review pending plan requests
3. approve, reject, or activate
4. optionally adjust user tier, limits, or role

There is no Stripe or subscription automation yet. Plan activation is still admin-driven.

## Runtime Behavior Notes

- `New Chat` stays in draft state until the first real message
- the first sent message enters the chat immediately, then persists in the background
- text assistants stream through `/api/chat`
- image requests go through `Prism` and `/api/images/generate`
- image usage is tracked separately from text usage
- generated and uploaded images open in an in-app viewer with download support
- users see displayed usage only
- admins see raw and displayed usage
- the top bar includes:
  - an admin shortcut for admin users
  - an assistant help dialog
- the prompt precheck only interrupts on high-confidence assistant mismatches

## Pricing And Cost Notes

- displayed credits use the app’s display multiplier model
- `100 credits = $1` displayed usage
- raw model pricing in code is centrally configurable
- current pricing figures are configurable estimates and should be reviewed against current OpenRouter pricing before production billing

## Project Structure

```text
app/
  admin/
  api/
  auth/
  dashboard/
  pricing/
  (assistants)/
components/
  admin/
  assistants/
  auth/
  chat/
  ui/
lib/
  ai/
  auth/
  billing/
  config/
  router/
  storage/
  utils/
supabase/
  migrations/
types/
```

## Notes

- OpenRouter is the only AI gateway.
- Supabase is the source of truth after sign-in.
- `.env.local` is for local secrets and should never be committed.
- the publishable Supabase key is safe for `NEXT_PUBLIC_*`
- the Supabase secret key must remain server-only

## Verification

The current app is expected to pass:

```bash
npx tsc --noEmit
npm run build
```
