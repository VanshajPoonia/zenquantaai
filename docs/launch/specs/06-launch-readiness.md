# Spec 06: Launch Readiness

Lanes C and D. Days 9 to 15.

## Goal

A public launch that is safe, honest about what the product does and cheap to run if traffic spikes.

## Production setup (Day 11)

Work through `docs/BETA_LAUNCH_CHECKLIST.md` sections 1 to 12 for production, plus:

- Set the Vercel Node version to 22.19 or newer on both `zqai` and `v0-zenquantaai`. Decide whether `v0-zenquantaai` should keep deploying from `main` at all.
- Apply `20261117_zenquanta_agent_platform.sql` to the production Neon database after a backup branch.
- `FILE_STORAGE_PROVIDER=r2` (or `s3`) with a private bucket. Local storage is not acceptable on Vercel.
- `TAVILY_API_KEY` and the embeddings key set. Tavily extract has its own credit cost, so check the plan.
- Turn `AGENT_LOOP` on for admins first (Day 11), then for everyone (Day 14).
- `/admin/system-health` shows no `missing` rows. Add rows for `AGENT_LOOP`, the Node version and the Model API.

## Cost and abuse controls (Day 10)

- An OpenRouter credit limit for the production key, plus a low-balance email alert.
- Rate limits on `/api/v1/*`, `/api/cli/*` and sign-up, per token and per IP. Reuse the `zen_auth_attempts` pattern.
- A daily admin check for the top 10 users by raw cost, using the existing admin cost views and the new surface filter.
- A kill switch: turning `AGENT_LOOP` off returns the web app to plain chat. Revoking the Model API scope stops `zq`.

## Security review (Day 10)

Check and record the result in `AI_TASK_LOG.md`:

- Bearer tokens never work on cookie routes, and cookies never work on `/api/v1/*`.
- Tokens are never logged or returned after creation. Device codes expire and cannot be reused.
- Every server tool scopes by the session user. Try passing another user's ids in tool arguments.
- `fetch_url` never fetches from our server. It goes through Tavily only.
- CLI session sync rejects entries for conversations the token's user does not own.
- Tool output is wrapped as data in prompts. A page saying "ignore your instructions" does not change behavior in a manual test.
- `zq` protected paths and dangerous commands always prompt, except in `--yolo`.
- Re-run the checks in `SECURITY_CHECKLIST.md`.

## Legal pages (Day 9)

Plain-language drafts for the user to approve. They are not legal advice.

- `/terms`: accounts, acceptable use (no illegal content, no abuse of the agent, no attacks), that the user is responsible for commands they approve in `zq`, plan changes are manual, the service is provided as is.
- `/privacy`: what we store (account ID, chats, files, memory, CLI sessions when sync is on, usage), the processors (OpenRouter and the model providers behind it, Tavily, the embeddings provider, Vercel, Neon, the storage provider), how to delete data (existing account deletion), and contact.
- Link both from the landing footer, the sign-up form and the `zq login` page.

## Landing, docs and pricing (Day 9)

- Landing page: a section on Forge in the terminal with the real install and login commands, and a short scripted terminal demo labelled "Example". Follow the motion budget in `AI_DECISIONS.md` (opacity and transform only). Claims must come from real features.
- `/docs/cli`: install (Node 22.19+), `zq login`, permission modes, `zq -c` and `zq -r`, sync on and off, `/usage`, uninstall, and credit to pi.
- `/pricing`: agent limits from `PLAN_CONFIGS` and which plans get `zq`.
- Update `PRODUCT.md`, `README.md`, `AI_PROJECT.md` and `AI_CHECKLIST.md` with the new routes, env vars, migration and flags.

## Bug bash (Days 12 to 13)

- Run `docs/manual-product-smoke-test.md` on production with admin flags on.
- New checks: tool cards for each assistant, `make_image` handoff, limits reached on Free, `zq` install to task on macOS and Windows, sync on and off, token revoke, PWA install on four platforms.
- Dry run with 3 to 5 testers. Collect issues in one list. Fix blockers only.

## Launch day (Day 15)

- Morning: confirm flags, OpenRouter balance, error logs and `npm view zenquanta version`.
- Publish the launch posts queued in Postroom for the Zenquanta AI brand.
- Check errors, signups and OpenRouter spend every few hours. Keep the kill switch ready.
- Log the launch in `AI_TASK_LOG.md` with what went out and what is known broken.

## Done when

Gate D passes. Every item above is checked or written down as a known issue with an owner.
