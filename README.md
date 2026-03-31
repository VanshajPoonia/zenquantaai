# Zenquanta AI

Zenquanta AI is a production-style AI chat app built with Next.js, TypeScript, Tailwind CSS, shadcn/ui, OpenRouter, and Supabase.

Its four branded core modes are:
- `Nova` for everyday help and general questions
- `Velora` for creative writing and brand language
- `Axiom` for structured reasoning and decision support
- `Forge` for coding, debugging, and implementation work

It supports:
- multi-mode chat
- OpenRouter model routing
- email magic-link auth
- email/password auth
- password recovery
- project-based chat organization
- prompt library
- file uploads
- streaming responses
- exported chats
- Supabase-backed sync

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- OpenRouter
- Supabase Auth
- Supabase Postgres
- Supabase Storage

## Modes

Zenquanta keeps a mode-based product structure while presenting each mode as its own branded intelligence:

- `general` → `Nova`
- `creative` → `Velora`
- `logic` → `Axiom`
- `code` → `Forge`

The app also supports per-chat model override on top of the default mode routing.

## Features

- authenticated chat workspace
- chat projects/folders
- draft-first new chats that are only saved after the first real message
- saved prompts
- system presets
- ask another mode
- mode switching mid-conversation
- browser upload flow for text, images, and PDFs
- private attachment storage in Supabase
- markdown and JSON export
- streaming-ready chat API

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

After creating your Supabase project, do this:

1. Enable email auth and magic links.
2. Set auth URLs in `Authentication -> URL Configuration`.
3. Run the SQL migration from [20260401_zenquanta_projects_prompts.sql](/Users/vanshajpoonia/Code/Zenquanta%20AI/supabase/migrations/20260401_zenquanta_projects_prompts.sql).
4. Update the Supabase email templates.

### URL Configuration

For local development:

- `Site URL`: `http://localhost:3000`
- Redirect URL: `http://localhost:3000/auth/callback`

For production, add your deployed domain and callback URL too.

### Migration

Run the SQL from:

- [20260401_zenquanta_projects_prompts.sql](/Users/vanshajpoonia/Code/Zenquanta%20AI/supabase/migrations/20260401_zenquanta_projects_prompts.sql)

This creates:

- `zen_projects`
- `zen_conversations`
- `zen_messages`
- `zen_prompt_library`
- `zen_user_settings`
- private storage bucket `zen-attachments`

It also enables RLS and adds ownership policies.

### Email Templates

Use these templates in `Authentication -> Email Templates`.

`Magic Link`

```html
<h2>Sign in to Zenquanta AI</h2>
<p>Follow this link to continue:</p>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Continue</a></p>
```

`Confirm sign up`

```html
<h2>Confirm your Zenquanta AI account</h2>
<p>Follow this link to verify your email and continue:</p>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Confirm your email</a></p>
```

`Reset Password`

```html
<h2>Reset your Zenquanta AI password</h2>
<p>Follow this link to reset your password:</p>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery">Reset Password</a></p>
```

`Confirm Email Change`

```html
<h2>Confirm change of email</h2>
<p>Follow this link to confirm the update of your email from {{ .Email }} to {{ .NewEmail }}:</p>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Change Email</a></p>
```

## Scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`

## Project Structure

```text
app/
  api/
  auth/
components/
  auth/
  chat/
  ui/
lib/
  ai/
  auth/
  config/
  storage/
  utils/
supabase/
  migrations/
types/
```

## Notes

- OpenRouter is the only model gateway.
- Supabase is the source of truth after sign-in.
- `New Chat` opens a draft state first and does not create an empty saved conversation in the sidebar.
- `.env.local` is for local secrets and should never be committed.
- The publishable Supabase key is safe for `NEXT_PUBLIC_*`.
- The Supabase secret key must remain server-only.

## Verification

The current app is expected to pass:

```bash
npx tsc --noEmit
npm run build
```
