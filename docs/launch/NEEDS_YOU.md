# Needs You

Things only the owner can do or decide before the 2026-12-01 launch. Claude Code keeps this list current: done items move to the bottom with the date.

## Open

| # | What | Why | When |
|---|---|---|---|
| 1 | **Send the permission request to OpenRouter** (paste `docs/launch/openrouter-permission-request.md` into the "Talk to sales" form on openrouter.ai, or tell Claude to fill it in through Chrome). When they say yes, set `ZQ_MODEL_API=on` | OpenRouter's terms forbid reselling API access. Until they confirm, zq runs on each user's own OpenRouter key (option B, built 2026-11-17) and hosted models stay admin-only, so zq can still launch on 12-01 | Now |
| 2 | Turn on two-factor authentication for npm (npmjs.com, Account, Two-Factor Authentication), then give Claude a fresh 6-digit code, or run `! pnpm --filter zenquanta publish --access public --tag beta --otp=<code>` yourself | npm now refuses publishes from accounts without 2FA (403 on 2026-11-17). You are logged in as `vanshajpoonia` and `zenquanta@0.1.0-beta.1` is built and ready | Now |
| 3 | Read `/terms` and `/privacy` and say OK or what to change. If zq stays on OpenRouter, the terms also need a line passing on the model providers' terms (OpenRouter section 5.2) | They are plain-language drafts, not legal advice | Day 9 (11-25) |
| 4 | Check the `v0-zenquantaai` Vercel project (it is in another Vercel account): set Node 22.19 or newer, or disconnect it from `main` | It also deploys `main`. The agent loop needs Node 22.19 or newer | Before Day 11 |
| 5 | Optional: Apple Developer account ($99 a year) | Needed to sign the Mac desktop app in v1.1 | After launch |

## OpenRouter terms

Read on 2026-11-17 from https://openrouter.ai/terms (last updated 31 August 2026). This is a plain reading, not legal advice.

- Section 7 (Prohibited Conduct), item 4 forbids accessing the service "for purposes of reselling API access to Models" or "developing a competing service". Item 14 forbids selling or transferring "the access granted under these Terms".
- Section 5.1 contemplates "your customers (to the extent you incorporate the Service into your own products and services)", so the web app itself, a product built on OpenRouter, looks fine.
- Sections 5.1 and 5.2 require that your customers agree to and follow each model provider's terms. The terms page must say so.

Options for zq:

| Option | What it means | Trade-off |
|---|---|---|
| A. Ask OpenRouter (recommended) | Email their sales team describing zq and the metered endpoint, and ask for written permission | Cleanest. Depends on their answer and timing |
| B. Bring your own key | zq users paste their own OpenRouter key. Zenquanta keeps login, sync and memory but does not sell model access through zq | Allowed, but zq earns nothing and setup is harder |
| C. Different gateway for zq | Route zq through a provider whose terms allow resale | Needs a terms review and a code change. Breaks "OpenRouter is the only gateway" |
| D. zq-only lockdown | Keep the endpoint but tie it to zq so it is not general API access | Weakest. A token still works from any OpenAI-compatible client |

## Done

| Date | What |
|---|---|
| 2026-11-16 | Approved the pi dependencies and the plan (full permissions given) |
| 2026-11-16 | Chose R2 for production file storage |
| 2026-11-16 | R2 set up by Claude through your Cloudflare dashboard: private bucket `zenquanta-files` (Asia Pacific), an Account API token "Zenquanta app files" with Object Read & Write on that bucket only, and the production env vars on Vercel. Uploads and PDF indexing verified in production |
| 2026-11-17 | Approved Gate B: daily caps kept, zq steps per run raised (Free 15, Basic 20), Free zq on Qwen3 Coder, `forge-fast` replaced, web searches metered at 8,000 wallet tokens |
| 2026-11-17 | R2 env vars added to Vercel Preview deploys |
| 2026-11-17 | Logged in to npm as `vanshajpoonia` |
| 2026-11-17 | Built option B as the fallback: zq runs on the user's own OpenRouter key until `ZQ_MODEL_API=on` |
