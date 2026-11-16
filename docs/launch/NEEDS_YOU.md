# Needs You

Things only the owner can do or decide before the 2026-12-01 launch. Claude Code keeps this list current: done items move to the bottom with the date.

## Open

| # | What | Why | When |
|---|---|---|---|
| 1 | `npm login` on this Mac (or share an npm automation token), then say go to publish `zenquanta` | zq cannot be installed until it is on npm. After publishing, `NEXT_PUBLIC_ZQ_RELEASED=true` turns on the zq pointers in the app | By Day 11 (11-27) |
| 2 | Approve the agent limits per plan (Gate B table in `specs/05-evals-and-limits.md`) | Agent work uses far more tokens than chat. The numbers decide whether plan prices hold | Day 4 (11-20) |
| 3 | Read `/terms` and `/privacy` and say OK or what to change | They are plain-language drafts, not legal advice | Day 9 (11-25) |
| 4 | Check the `v0-zenquantaai` Vercel project (it is in another Vercel account): set Node 22.19 or newer, or disconnect it from `main` | It also deploys `main`. The agent loop needs Node 22.19 or newer | Before Day 11 |
| 5 | Read OpenRouter's terms on reselling access through an API, or decide zq-only at launch | Decides whether other tools (Aider, Cline, Codex CLI) can use the Model API at launch | Day 10 (11-26) |
| 6 | Decide whether web search costs (about $0.007 per search) count against plan wallets | Searches go through OpenRouter's web plugin and are not metered to users yet | With Gate B |
| 7 | Optional: copy the six `FILE_STORAGE_*` Production env vars to Preview in the Vercel dashboard (the Vercel CLI cannot add Preview vars without a prompt here) | Preview deploys still use local storage, so uploads fail on previews | Any time |
| 8 | Optional: Apple Developer account ($99 a year) | Needed to sign the Mac desktop app in v1.1 | After launch |

## Done

| Date | What |
|---|---|
| 2026-11-16 | Approved the pi dependencies and the plan (full permissions given) |
| 2026-11-16 | Chose R2 for production file storage |
| 2026-11-16 | R2 set up by Claude through your Cloudflare dashboard: private bucket `zenquanta-files` (Asia Pacific), an Account API token "Zenquanta app files" with Object Read & Write on that bucket only, and the production env vars on Vercel. Uploads and PDF indexing verified in production |
