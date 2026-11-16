# Zenquanta v1.0 Launch Plan

Launch: **Tuesday 2026-12-01**. Code freeze: **Saturday 2026-11-28**. Planned on 2026-11-16 (Day 0).

The direction and architecture are in `AI_PLATFORM_PLAN.md`. This file says what ships, in what order and what gets cut if we fall behind. Each workstream has a spec in `docs/launch/specs/`.

## Progress

Updated 2026-11-16, end of Day 0. Work runs ahead of the day plan on branch `feat/agent-platform`.

| Item | Status |
|---|---|
| Gate A: pi loop in a Vercel function | Passed on a preview: a Pulse turn searched and cited in 12 s on Node 24 |
| Migration `20261117_zenquanta_agent_platform.sql` | Applied to Neon and verified |
| Spec 01: agent loop, tools, tool cards, per-step metering | Built and tested locally and on a preview, behind `AGENT_LOOP` |
| Spec 02: tokens, device login, Model API | Built and tested locally |
| Spec 03: `zq` 0.1 | Built and tested locally: login, read, edit, sync to web. Not published |
| Spec 04: PWA | Built. Install flow still to check on real phones |
| Spec 05: evals and limits | Eval suite built. Limits are provisional until Gate B |
| Spec 06: terms, privacy, docs, landing section, sign-up rate limit, admin cost split | Built. Production setup and the user's legal review are open |

| Production file storage | Cloudflare R2 bucket `zenquanta-files` live. Uploads and PDF indexing verified in production |
| Upload crash on Vercel (`DOMMatrix is not defined`) | Fixed: pdf-parse loads with its worker and is a server-external package |

Extra: without Tavily or embeddings keys, web search and embeddings fall back to OpenRouter, so search, file search and memory work with the one gateway key.

## What ships on 2026-12-01

| # | Feature | Spec |
|---|---|---|
| 1 | Assistants use tools in web chat: web search, page reading, file search, memory search, save artifact, image handoff. Tool steps show as cards | `specs/01-agent-loop-and-tools.md` |
| 2 | API tokens, device login and the OpenAI-compatible Model API | `specs/02-tokens-and-model-api.md` |
| 3 | `zq` 0.1: Forge in the terminal on pi, with Zenquanta login, permission prompts, local resume and session sync to the web | `specs/03-zq-cli.md` |
| 4 | Installable web app (PWA) on phones and computers | `specs/04-pwa.md` |
| 5 | Agent limits per plan, chosen from evals and cost runs | `specs/05-evals-and-limits.md` |
| 6 | Launch readiness: production setup, security review, legal pages, landing page and docs | `specs/06-launch-readiness.md` |

## What does not ship on 2026-12-01

| Feature | When |
|---|---|
| Desktop app (Electron) | v1.1, December |
| MCP server, Zenquanta memory and file tools inside `zq` | v1.1 |
| Resume a CLI session on another device | v1.1 |
| `curl` installer for `zq` (launch uses npm) | v1.1 |
| Cloud sessions and cloud sandboxes | v1.2, January |
| `run_code` tool in chat | v1.2 |
| GitHub write access, PRs from the agent | v1.2, needs a yes |
| Payments | Only when the user asks |

## Lanes

Work runs in parallel lanes. One person or agent can own a lane.

- **Lane A, web agent:** spec 01.
- **Lane B, CLI and API:** specs 02 and 03.
- **Lane C, product surface:** spec 04, plus the landing, docs and legal parts of spec 06.
- **Lane D, quality and ops:** spec 05, plus the security and production parts of spec 06.

## Day by day

| Day | Date | Lane A, web agent | Lane B, CLI and API | Lane C and D |
|---|---|---|---|---|
| 0 | Mon 11-16 | | | Plan written (this file) |
| 1 | Tue 11-17 | Spike: pi loop in a Vercel function with one OpenRouter tool call. **Gate A** | Spike: `zq` runs pi `main` with an inline extension, a custom provider and a blocked `tool_call` | Approve dependencies. Write the migration |
| 2 | Wed 11-18 | `lib/agent/*`: tool registry, event mapping, metering hooks | API tokens table, repository and bearer auth helper | Apply the migration to a Neon branch |
| 3 | Thu 11-19 | Server tools. `/api/chat` agent path behind `AGENT_LOOP` | Device login routes and `/cli/authorize` page | Eval fixtures (spec 05) |
| 4 | Fri 11-20 | Client stream handling and tool cards | Model API: `/api/v1/chat/completions` and `/api/v1/models` | Cost runs on 3 to 4 models. **Gate B** |
| 5 | Sat 11-21 | Forge and Nova prompt tuning from eval results | `zq` package: provider, login, logout, usage | PWA manifest, icons and install button |
| 6 | Sun 11-22 | Persist `parts`, load them on reopen | `zq` permission extension | Settings page for API tokens |
| 7 | Mon 11-23 | Agent limits in `PLAN_CONFIGS` and enforcement | Session sync API and extension | Admin cost views split by surface |
| 8 | Tue 11-24 | Bug fixes. **Gate C** | CLI sessions in the web sidebar, read-only | Eval round 2 |
| 9 | Wed 11-25 | Fixes | `zq` print mode and polish | Landing section, `/docs/cli` page, pricing copy, terms and privacy pages |
| 10 | Thu 11-26 | Fixes | Fixes | Security review, rate limits, OpenRouter credit limit |
| 11 | Fri 11-27 | Flags on in production for admins only | Publish `zenquanta@0.1.0-beta.1` after a yes | Production setup from `docs/BETA_LAUNCH_CHECKLIST.md` |
| 12 | Sat 11-28 | **Code freeze.** Bug bash with `docs/manual-product-smoke-test.md` and spec 06 checks | | |
| 13 | Sun 11-29 | Blocker fixes only. Dry run with 3 to 5 testers | | |
| 14 | Mon 11-30 | Flags on for everyone. Publish `zenquanta@0.1.0`, then set `NEXT_PUBLIC_ZQ_RELEASED=true`. Queue launch posts in Postroom. **Gate D** | | |
| 15 | Tue 12-01 | **Launch.** Watch errors, signups and OpenRouter spend every few hours | | |

## Gates

| Gate | Day | Question | If no |
|---|---|---|---|
| A | 1 | Does a `pi-agent-core` Agent stream a tool call through OpenRouter inside a Vercel function on Node 22.19+? | Web loop uses the Vercel AI SDK. `zq` stays on pi |
| B | 4 | Do the agent limits and model defaults from cost runs fit the plan prices? The user approves the numbers | Lower caps, or Free gets web tools only and no `zq` |
| C | 8 | Is every launch feature working on a preview deploy? | Apply the cut order below |
| D | 14 | Go or no-go: smoke tests pass, no open security issue, costs in range | Move launch by up to 3 days. Do not ship known security issues |

## Cut order

If a lane slips, cut from the top. Never cut the bottom block.

1. `memory_search` and `fetch_url` tools. Keep web search and file search.
2. CLI sessions in the web sidebar. `zq` still syncs, and the view lands in v1.1.
3. The PWA install button. Keep the manifest so browsers can still install.
4. Third-party harness support. Tokens only work for `zq`.
5. Last resort: launch web tools on 12-01 and `zq` as an invite-only beta a week later.

Never cut: per-step metering and limits, permission prompts in `zq`, the security review, terms and privacy pages.

## Decisions the user needs to make

The live list, with what is done, is in `docs/launch/NEEDS_YOU.md`. The table below is the original schedule.

| When | Decision |
|---|---|
| Day 1 | Approve dependencies: `@earendil-works/pi-ai` and `@earendil-works/pi-agent-core` for the web app, and `@earendil-works/pi-coding-agent` for `zq`, all pinned to 1.5.2 |
| Day 1 | Vercel Node version set to 22.19 or newer (24.x is fine) |
| Day 4 | Gate B: agent limits per plan and whether Free gets `zq` |
| Day 9 | Approve the terms and privacy wording. It is not legal advice |
| Day 10 | Third-party harnesses at launch, or `zq` only, after reading OpenRouter's terms |
| Day 11 | Which npm account publishes `zenquanta` |
| After launch | Apple Developer account ($99 a year) for a signed Mac desktop app |

## Definition of launched

- A new visitor signs up and gets a first answer in under a minute.
- Nova, Forge and Pulse call tools, and the cards show what they did.
- `npm i -g zenquanta`, then `zq login`, then a small fix in a sample repo, all in under 5 minutes.
- The CLI session appears in the web history.
- The app installs from Chrome on desktop and Android and from Safari on iPhone.
- Every model request has a usage event with its surface, and the admin cost view shows it.
- No user can read another user's data through any new route.

## Daily routine

- Each lane updates `AI_TASK_LOG.md` at the end of its day: what changed, what was verified, what is risky.
- Run `pnpm run typecheck`, `pnpm run lint`, `pnpm test` and `pnpm run build` before every merge to `main`.
- New flags default off until Day 11.
