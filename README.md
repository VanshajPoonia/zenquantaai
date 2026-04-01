# Zenquanta AI

Zenquanta AI is a premium multi-assistant workspace built with Next.js, TypeScript, Tailwind CSS, shadcn/ui, Supabase, and OpenRouter.

It is no longer just a four-mode chat shell. The current platform includes:
- six branded assistant families
- tiered plan routing
- separate text and image usage tracking
- manual plan requests and activation
- an admin dashboard
- conversation memory
- branded public assistant pages

## Assistant Families

Zenquanta currently ships with these assistant families:

- `Nova` for broad practical work and everyday assistance
- `Velora` for creative writing, tone, copy, and ideation
- `Axiom` for structured reasoning and decision support
- `Forge` for coding, debugging, and implementation
- `Pulse` for current-context and research-style work
- `Prism` for image generation

Mode mapping in the app:

- `general` → `Nova`
- `creative` → `Velora`
- `logic` → `Axiom`
- `code` → `Forge`
- `live` → `Pulse`
- `image` → `Prism`

## How It Works

Zenquanta combines a branded assistant UI with tier-aware backend routing:

- chats are organized by assistant family and project
- OpenRouter is the only AI backend
- Supabase handles auth, sync, storage, subscriptions, usage records, and admin data
- text and image generation are billed and tracked separately
- conversation memory is stored per conversation and reused when memory is enabled

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

## Current Feature Set

- authenticated ID + password workspace
- draft-first new chats
- immediate first-message chat entry
- project-based chat organization
- prompt library
- conversation memory
- streaming chat responses
- image generation with `Prism`
- image history
- in-app image viewer and image download
- file uploads with private Supabase-backed storage
- markdown and JSON exports
- tiered assistant routing
- manual plan requests
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

Supabase still manages sessions underneath, and some callback/recovery plumbing remains in the backend, but the user-facing sign-in flow is currently ID/password-first.

The auth screen also includes:

- ID guidance
- confirm password on sign-up
- show/hide password
- contact-admin support link

## Platform Architecture

### Plans and Routing

Tier-aware routing is configured per assistant family:

- `Free` and `Basic` use lower-cost base models
- `Pro`, `Ultra`, and `Prime` unlock stronger routes and larger included usage
- `Prism` handles image generation separately from text assistants

Displayed usage multipliers:

- `free` → `2.0`
- `basic` → `2.0`
- `pro` → `1.5`
- `ultra` → `1.5`
- `prime` → `1.5`

### Usage Model

Usage is tracked in three separate buckets:

- `core_tokens` for lower-cost text routes
- `tier_tokens` for premium tier routes
- `image_credits` for image generation

Image usage is tracked independently from text usage in both user and admin views.

### Memory

Conversation memory is conversation-scoped:

- a rolling memory summary is persisted with the conversation
- recent turns remain verbatim
- older context is compressed into `memory_summary`
- memory is only injected when the session `memory` setting is enabled

## Main Routes

- `/`
  - main chat workspace
- `/dashboard`
  - user usage dashboard
- `/pricing`
  - plans and manual plan request flow
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
  - branded assistant information pages
- `/auth/reset-password`
  - password recovery completion page

## Main APIs

- `/api/chat`
  - main chat execution and usage logging
- `/api/images/generate`
  - image generation through `Prism`
- `/api/images/history`
  - recent image usage/history
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

3. Fill in [`.env.local`](/Users/vanshajpoonia/Code/Zenquanta%20AI/.env.local):

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

1. [20260401_zenquanta_projects_prompts.sql](/Users/vanshajpoonia/Code/Zenquanta%20AI/supabase/migrations/20260401_zenquanta_projects_prompts.sql)
2. [20260401_zenquanta_conversation_memory.sql](/Users/vanshajpoonia/Code/Zenquanta%20AI/supabase/migrations/20260401_zenquanta_conversation_memory.sql)
3. [20260401_zenquanta_billing_admin_platform.sql](/Users/vanshajpoonia/Code/Zenquanta%20AI/supabase/migrations/20260401_zenquanta_billing_admin_platform.sql)

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

This enables the tiered usage system, plan request workflow, and admin platform.

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

## Manual Plan Request Flow

Current plan upgrades are manual.

User flow:

1. open `/pricing`
2. choose a paid plan
3. optionally add contact and a note
4. submit the request
5. see a pending banner that the plan will be activated soon

Admin flow:

1. open `/admin`
2. review pending plan requests
3. approve, reject, or activate
4. optionally adjust user limits or tier values

There is no Stripe/subscription automation yet. Plan activation is still admin-driven.

## Runtime Behavior Notes

- `New Chat` stays in draft state until the first real message
- the first sent message enters the chat immediately, then persists in the background
- image requests go through `Prism`
- image usage is tracked separately from text usage
- generated and uploaded images open in an in-app viewer with download support
- users see displayed usage only
- admins see raw and displayed usage
- the top bar includes:
  - an admin shortcut for admin users
  - an assistant help dialog

## Pricing And Cost Notes

- displayed credits use the app’s display multiplier model
- `100 credits = $1 displayed usage`
- raw model pricing in code is centrally configurable
- the current pricing figures are estimated configuration values and should be reviewed against current OpenRouter pricing before production billing

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
  assistants/
  auth/
  chat/
  ui/
lib/
  ai/
  auth/
  billing/
  config/
  storage/
  supabase/
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
