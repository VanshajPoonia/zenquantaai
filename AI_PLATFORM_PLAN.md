# Zenquanta Platform Plan: Chat and Coding Harness

Status: **planned, nothing built yet**. Launch target: **2026-12-01**. Owner: Claude Code (planning). Last updated: 2026-11-16.

This is the source of truth for the platform direction. The 15-day launch plan and the build specs live in `docs/launch/`. Read both before touching `lib/ai/*`, `/api/chat`, the model catalog, auth tokens or the message schema.

---

## 1. Goal

One account, one memory and one plan across chat and code.

- In the web app, assistants use tools. They search the web when they need to, read your files, save artifacts and hand image work to Prism.
- In the terminal, Forge works as a coding agent called `zq`. It reads, edits and runs code in your repo, and the session shows up in your Zenquanta history.
- The web app installs like an app on phones and computers.
- Every step is metered against the same plans and wallets, so cost stays under control.

## 2. Decisions from the user (2026-11-16)

| Question | Answer |
|---|---|
| Where does the coding agent run first? | On the user's machine as a CLI. Cloud comes later. |
| Payments? | Stay manual. Plan requests and admin activation as today. |
| Chat tools in the same push? | Yes. One agent loop powers chat and code. |
| Use open source? | Yes, for the layers every AI product needs. |
| Harness | Pi, not OpenCode. |
| Installable app | Yes. The PWA ships at launch. The desktop app follows. |
| Launch | In 15 days, on 2026-12-01. |

## 3. Starting point

| Area | Today | Gap |
|---|---|---|
| Tool calling | None. `lib/ai/openrouter.ts` sends `{ role, content: string }` and streams text only | Tools, streamed tool calls and multi-step runs |
| Messages | `Message.content` is one string. Roles are system, user and assistant | Tool calls and tool results stored per message |
| Usage | Estimated from text length (`calculateTextUsageEstimate`) after the stream | Real token counts per step from the provider |
| Billing gate | `reserveTextUsage` claims tokens and adds 1 daily message per request | Per-step metering and a daily agent step counter |
| Plan caps | Free allows 8,000 input and 800 output tokens per request | Agent steps need their own, higher caps |
| Auth | Cookie session only (`zenquanta-session-token`) | Revocable API tokens for `zq` |
| Install | No web app manifest | A PWA manifest and icons |
| Legal | No terms or privacy pages | Both, before a public launch |
| Deploys | A push to `main` deploys the Vercel projects `zqai` and `v0-zenquantaai` | Every feature ships behind a flag so `main` stays deployable |

## 4. Why pi

Pi (`earendil-works/pi`, MIT, TypeScript) is a set of libraries more than one app. That is what we need.

| Need | What pi gives us |
|---|---|
| One loop for web and terminal | `pi-agent-core` (the loop) and `pi-ai` (model access) run in our Next.js server and inside `zq` |
| OpenRouter and real cost | `pi-ai` has an OpenRouter provider and reports input, output, cache tokens and the cost OpenRouter charged |
| Metering hooks | `prepareRequest` runs before every model request and `finishTurn` after every turn |
| Permission prompts | Extensions can block a `tool_call` and ask with `ctx.ui.confirm` |
| Our own CLI | The package exports `main`, `InteractiveMode`, `runPrintMode` and `runRpcMode`, so `zq` can run pi's full terminal UI with our extensions |
| Our provider and login | `pi.registerProvider` and `pi.registerCommand` |
| Sessions | Saved automatically as JSONL trees. `--continue`, `--resume`, `--fork`, compaction, export |
| Later: cloud and desktop | `pi-durable` (crash-safe sessions, live `watch()`), `pi-env` (tools on another machine), `pi-mcp`, `pi-codemode` |

Why not OpenCode: it is excellent but a large standalone product. Its UI is SolidJS, not React, and the web chat would still need a second loop. Pi lets one loop serve every surface.

What pi costs us:

- It has no permission system by design. We build one as an extension. This is required for normal users.
- It moves fast (1.4.0 on 2026-10-21, 1.5.2 on 2026-11-10). We pin exact versions.
- New outside contributors' issues and PRs are auto-closed. We patch locally with `pnpm patch` if we must.
- It needs Node 22.19 or newer, on Vercel and on users' machines.
- `pi-durable` is marked experimental, so cloud sessions wait until after launch.

Fallback: if pi cannot run inside a Vercel function (checked on Day 1), the web loop uses the Vercel AI SDK and `zq` still uses pi.

## 5. Architecture

```
                Zenquanta account, plans, wallets, memory (Neon)
                                   |
        +--------------------------+---------------------------+
        |                          |                           |
  Web chat (/api/chat)       Model API (/api/v1)        CLI sync (/api/cli/*)
  pi loop + server tools     OpenAI-compatible,         device login, session
  for the text assistants    metered per request        mirror into Neon
        |                          |                           |
  Browser and PWA            zq = pi + Zenquanta extension -----+
                             (local tools, permission prompts)
```

1. **Web chat.** When `AGENT_LOOP` is on, `/api/chat` runs a `pi-agent-core` Agent per request with server tools. Events map onto the existing NDJSON stream. The current path stays live when the flag is off.
2. **Model API.** `/api/v1/chat/completions` and `/api/v1/models`, OpenAI-compatible and streamed, with tools passed through. It exposes Zenquanta names like `forge` and `forge-best`, never raw OpenRouter IDs. Each request is one metered step.
3. **CLI sync.** Device login hands `zq` a token. The `zq` extension mirrors sessions into Neon so they show on the web.
4. **`zq`.** The npm package `zenquanta` runs pi's `main` with our extension: the Zenquanta provider, login, permissions, sync and usage.

Local tools run on the user's machine. Zenquanta data tools run on our server. Every request is short, so it fits serverless limits.

## 6. Data changes

One additive migration for launch: `neon/migrations/20261117_zenquanta_agent_platform.sql`.

- `zen_messages.parts jsonb null`: ordered text, tool call and tool result parts. `content` keeps the final text for search, memory and exports.
- `zen_conversations.surface text not null default 'web'` (`web` or `cli`) and `workspace jsonb null` (repo name and branch, never full local paths).
- `zen_agent_runs`: one row per user turn or CLI prompt, with surface, step count, tokens and status.
- `zen_api_tokens`: SHA-256 hash, a `zq_` prefix for display, name, scopes, last use, expiry and revoked time.
- `zen_device_codes`: hashed device code, user code, user id once approved, status and expiry.
- `zen_subscriptions.daily_agent_step_count`, reset with the existing daily counters.
- `zen_usage_events.surface` and `agent_run_id`.

## 7. Metering

- Each step reserves `estimated prompt + max output` with the existing atomic reserve, then finalizes with the tokens `pi-ai` reports.
- Cache reads are cheaper upstream. How they count against wallets is decided at Gate B with real numbers.
- A web turn counts one daily message, as today. Every model request also counts one agent step.
- New plan fields: `agentStepsPerDay`, `maxStepsPerRun`, `maxAgentInputTokens`, `maxAgentOutputTokens` and the agent models each tier may use. Numbers are set at Gate B.
- Loop guard: a run stops when the same tool call with the same arguments repeats three times.

## 8. Security

- Tool results are data, never instructions. Content can never approve an action.
- Bearer tokens work only on `/api/v1/*` and `/api/cli/*`. Cookie routes stay cookie-only.
- Tokens are shown once, hashed, revocable in Settings, expire after 90 days and are rate-limited.
- `fetch_url` goes through Tavily extract, so our server never fetches arbitrary URLs.
- Server tools keep the existing `user_id` filters.
- `zq` asks before shell commands and file writes by default, never reads `.env` or key files without asking, and truncates synced tool output.

## 9. Roadmap

| Release | When | Contents |
|---|---|---|
| v1.0 | 2026-12-01 | Tools in web chat, Model API, `zq` 0.1 with login, permissions, local resume and sync to web, PWA, agent limits, legal pages. See `docs/launch/LAUNCH_PLAN.md` |
| v1.1 | December | Desktop app (Electron, React UI, pi in the main process), MCP server and Zenquanta memory and file tools in `zq`, resume a session on another device, a `curl` installer |
| v1.2 | January | Cloud sessions (`pi-durable` in E2B or Vercel Sandbox, live view on web and phone), `run_code` for chat on `pi-codemode`, GitHub write access after a yes from the user |
| Later | | VS Code through Cline or Kilo Code on the Model API, scheduled agents, teams, payments when asked |

## 10. Risks

| Risk | Mitigation |
|---|---|
| Pi does not run in a Vercel function | Day 1 spike. Fallback: Vercel AI SDK for the web loop |
| Cheap models are bad at tool calls | Evals per model before choosing defaults |
| Agent work drains wallets or our OpenRouter balance | Per-step metering, step caps, an OpenRouter credit limit, plan numbers from measured cost |
| OpenRouter terms on a public model API | Read before launch. If unclear, tokens only work for `zq` at launch |
| Pi breaking changes | Exact pins, upgrade only on purpose |
| Prompt injection from pages, files or repos | Permission prompts in `zq`, tool output treated as data |
| Token leaks | Hashed, scoped, expiring, revocable, rate-limited |
| 15 days is tight | A written cut order in `docs/launch/LAUNCH_PLAN.md` and a code freeze on 2026-11-28 |

## 11. Decisions this changes

- The Context Engine note "Zenquanta has no tool/function-calling surface" was true when written. The agent loop adds one.
- "MCP connector runtime" stays out of scope for launch and arrives in v1.1.
- "OpenRouter is the only AI gateway" stays. Pi talks to OpenRouter.
- "Text and image transports are separate" stays. `make_image` hands off to `/api/images/generate`.
- GitHub stays read-only until v1.2.
- Payments stay manual.
