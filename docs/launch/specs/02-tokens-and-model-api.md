# Spec 02: API Tokens, Device Login and the Model API

Lane B. Days 2 to 7.

## Goal

`zq` signs in through the browser and gets a revocable token. With that token it calls an OpenAI-compatible Model API that runs on the user's Zenquanta plan.

## API tokens

Table `zen_api_tokens`:

| Column | Notes |
|---|---|
| `id` | uuid |
| `user_id` | references `zen_users` |
| `name` | such as "zq on MacBook" |
| `token_hash` | SHA-256 of the full token, unique |
| `prefix` | first 8 characters after `zq_`, shown in Settings |
| `scopes` | `text[]`, launch scope is `cli` |
| `last_used_at`, `expires_at`, `revoked_at`, `created_at` | expiry defaults to 90 days |

Tokens look like `zq_` plus 40 random base62 characters. The full token is shown once.

Code:

- `lib/db/repositories/api-tokens.ts`: create, list for a user, revoke, find by hash, touch `last_used_at` at most once a minute.
- `lib/auth/api-token.ts`: `requireApiTokenUser(request, scope)` reads `Authorization: Bearer zq_...`, checks hash, expiry, revocation and scope, and returns the same user shape as the cookie session.
- Bearer auth is accepted only under `/api/v1/*` and `/api/cli/*`. No existing cookie route changes.
- Account deletion and admin purge delete the user's tokens. Add them to `lib/db/repositories/user-purge.ts`.

Settings UI: a "Terminal and API" section lists tokens (name, prefix, created, last used, expiry) with Revoke. No "create token" button at launch. Tokens come from device login only.

## Device login

Table `zen_device_codes`: `id`, `device_code_hash`, `user_code` (8 characters like `WXYZ-2345`, no look-alike characters), `user_id` (null until approved), `client_name`, `status` (`pending`, `approved`, `denied`, `used`, `expired`), `expires_at` (10 minutes), `created_at`.

Flow:

1. `zq login` calls `POST /api/cli/device` with a client name. It gets `device_code`, `user_code`, `verification_url` and `interval` (5 seconds).
2. `zq` opens `https://<app>/cli/authorize?code=WXYZ-2345` and prints the code.
3. The page asks the signed-in user to confirm the code and the client name. Signed-out users see the normal sign-in first.
4. `zq` polls `POST /api/cli/token` with `device_code`. Pending returns `authorization_pending`. Approved returns the token once and marks the code `used`.

Rate limits: 10 device codes per IP per hour, polling no faster than `interval`. Reuse the Neon-backed attempt pattern in `zen_auth_attempts`.

## Model API

Routes:

- `GET /api/v1/models` lists the Zenquanta models the token's plan may use.
- `POST /api/v1/chat/completions` is OpenAI Chat Completions compatible, with `stream: true` and `false`, `tools`, `tool_choice` and `max_tokens`.

Zenquanta model names map onto the existing response profiles:

| Name | Profile | Notes |
|---|---|---|
| `forge` | the tier's Forge model (`auto`) | Default |
| `forge-fast` | `gemini` | Fast |
| `forge-best` | `claude` | Plan-gated as today |
| `forge-lite` | `deepseek` | Lowest usage |

Final defaults come from evals (spec 05). Raw OpenRouter model IDs are never accepted or returned.

Built as a direct OpenRouter proxy rather than through pi-ai, so tool calls stay exact. See "The Model API Proxies OpenRouter Directly" in `AI_DECISIONS.md`.

Each request:

1. Authenticates the token and loads the subscription and overrides.
2. Resolves the model name with `resolveModelConfig('code', profile, tier)` and checks it with `assertModelOverrideAllowed`.
3. Rejects requests over `maxAgentInputTokens`. Clamps `max_tokens` to `maxAgentOutputTokens`.
4. Reserves usage and adds one to `daily_agent_step_count`. It does not count a daily message.
5. Forwards to OpenRouter with `pi-ai`, with tools passed through, and streams OpenAI-shaped chunks back.
6. Finalizes with the reported tokens and writes a usage event with `surface = 'cli'`, the run id and the model.
7. Releases the reservation on error or abort.

Optional headers from `zq`: `x-zq-session-id` and `x-zq-run-id`. They group requests into `zen_agent_runs` and enforce `maxStepsPerRun`. Requests without them still meter and count steps.

Errors use OpenAI's shape: `{ error: { message, type, code } }` with 401, 403, 429 or 402-style limit messages that point to `/pricing`.

## Third-party harnesses

At launch the token scope is `cli`, and the API serves `zq`. The same API works for Aider, Cline, Kilo Code, OpenCode and Codex CLI. We document that only after the OpenRouter terms check on Day 10 (`LAUNCH_PLAN.md`, decisions table).

## Tests

- Unit: token hashing and lookup, expiry, revocation, scope checks, cookie routes ignore bearer tokens.
- Unit: device code state machine, including expiry and reuse.
- Unit: model name mapping, plan gating, input and output caps.
- Integration on a preview: `curl` a streamed completion with a tool, see the usage event, revoke the token and get 401.

## Done when

- `zq login` gets a token through the browser, and `zq` completes a tool-using request through `/api/v1`.
- Revoked or expired tokens fail at once.
- Usage shows in `/dashboard` and in admin cost views split by surface.
