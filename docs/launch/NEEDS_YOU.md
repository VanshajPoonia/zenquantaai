# Needs You

Things only the owner can do or decide before the 2026-12-01 launch. Claude Code keeps this list current: done items move to the bottom with the date.

## Open

| # | What | Why | When |
|---|---|---|---|
| 1 | Read `/terms` and `/privacy` and say OK or what to change. If zq stays on OpenRouter, the terms also need a line passing on the model providers' terms (OpenRouter section 5.2) | They are plain-language drafts, not legal advice | Day 9 (11-25) |
| 2 | Check the `v0-zenquantaai` Vercel project (it is in another Vercel account): set Node 22.19 or newer, or disconnect it from `main` | It also deploys `main`. The agent loop needs Node 22.19 or newer | Before Day 11 |
| 3 | Optional: Apple Developer account ($99 a year) | Needed to sign the Mac desktop app in v1.1 | After launch |
| 4 | Set a monthly credit limit on the production OpenRouter key and turn on the low-balance email (openrouter.ai, Settings > Keys and Credits) | Spec 06 cost control. Since 2026-11-18 it is also the main guard against free-account farming, together with the sign-up limit per IP | Before Day 14 (11-30) |
| 5 | Optional: make a non-admin test account and add `SMOKE_LOGIN_ID` and `SMOKE_PASSWORD` to `.env.local` | Lets agents run the signed-in smoke test (`tests/e2e/signed-in.spec.ts`) for Gate C without your main account. Agents do not write to the production database, so they cannot make it themselves | Before Day 8 (11-24) |
| 6 | After a week of sign-ups, look at new accounts per day in `/admin` and decide whether Free needs email verification, a captcha or a lower cap for new accounts | Launch relies on the sign-up limit per IP plus the OpenRouter credit limit (decided 2026-11-18) | About 12-08 |
| 7 | Revisit how links in replies open: as now, a confirm step for links that did not come from you, a search or a file, or the site name next to each link | Kept as is for launch as an accepted risk (decided 2026-11-18) | After launch |

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

Decided 2026-11-18: option B. The request is not sent and `ZQ_MODEL_API` stays off.

## Done

| Date | What |
|---|---|
| 2026-11-16 | Approved the pi dependencies and the plan (full permissions given) |
| 2026-11-16 | Chose R2 for production file storage |
| 2026-11-16 | R2 set up by Claude through your Cloudflare dashboard: private bucket `zenquanta-files` (Asia Pacific), an Account API token "Zenquanta app files" with Object Read & Write on that bucket only, and the production env vars on Vercel. Uploads and PDF indexing verified in production |
| 2026-11-17 | Approved Gate B: daily caps kept, zq steps per run raised (Free 15, Basic 20), Free zq on Qwen3 Coder, `forge-fast` replaced, web searches metered at 8,000 wallet tokens |
| 2026-11-17 | R2 env vars added to Vercel Preview deploys |
| 2026-11-17 | Logged in to npm as `vanshajpoonia`, turned on 2FA with a passkey, published `zenquanta@0.1.0-beta.1` and approved npm's staged release. `latest` and `beta` both point to it. Verified by installing from npm and running a task against production |
| 2026-11-17 | Built option B as the fallback: zq runs on the user's own OpenRouter key until `ZQ_MODEL_API=on` |
| 2026-11-18 | Published `zenquanta@0.1.0-beta.3` under the `beta` tag. |
| 2026-11-19 | Moved `latest` to `0.1.0-beta.3` from your terminal. `npm view zenquanta dist-tags` shows `latest` and `beta` both on `0.1.0-beta.3` |
| 2026-11-18 | Purged the test accounts `zq-agent-test`, `zq-smoke-d3dbb1` and `ux-audit-5f0ef7` from production with the app's own purge code. Their R2 files were deleted too |
| 2026-11-18 | Decided not to send the OpenRouter permission request. zq stays on bring-your-own-key and `ZQ_MODEL_API` stays off |
| 2026-11-18 | Decided that links in replies stay as they are for launch, an accepted risk to revisit after launch (open item 8) |
| 2026-11-18 | Decided to launch free sign-ups with the sign-up limit per IP plus the OpenRouter credit limit, and to revisit after a week of sign-up numbers (open item 7) |
| 2026-11-18 | Asked for a current password field on the change-password form, checked on the server. Built and live in production the same day (`fd4fd54`) |
