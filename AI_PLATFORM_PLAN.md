# Zenquanta Platform Plan: Chat and Coding Harness

Status: **planned, nothing built yet**. Owner: Claude Code (planning). Last updated: 2026-11-16.

This is the source of truth for turning Zenquanta into a complete AI platform: assistants that use tools in the web app, and a coding agent in the terminal. Read it before touching `lib/ai/*`, `/api/chat`, the model catalog, auth tokens or the message schema.

---

## 1. Goal

One account, one memory and one plan across chat and code.

- In the web app, assistants use tools. They search the web when they need to, read your files, remember things, write artifacts and hand image work to Prism.
- In the terminal, Forge works as a coding agent. It reads, edits and runs code in your repo, and the session shows up in your Zenquanta history.
- What Forge learns in the terminal is available to Nova on the web, and the other way round.
- Every step is metered against the same plans and wallets, so cost stays under control.

## 2. Decisions from the user (2026-11-16)

| Question | Answer |
|---|---|
| Where does the coding agent run first? | On the user's machine as a CLI. A cloud sandbox comes later. |
| Payments? | Stay manual. Plan requests and admin activation as today. |
| Chat tools in the same push? | Yes. One agent loop powers chat and code. |
| Use open source tools? | Yes, for the layers every AI product needs. See section 4. |

## 3. Starting point

| Area | Today | Gap |
|---|---|---|
| Tool calling | None. `lib/ai/openrouter.ts` sends `{ role, content: string }` and streams text only | Tools, streamed tool calls and multi-step runs |
| Messages | `Message.content` is one string. Roles are system, user and assistant | Tool calls and tool results stored per message |
| Usage | Estimated from text length (`calculateTextUsageEstimate`) after the stream | Real token counts per step from the provider |
| Billing gate | `reserveTextUsage` claims tokens and adds 1 daily message per request | A per-step version that counts one daily message per run |
| Auth | Cookie session only (`zenquanta-session-token`) | Revocable API tokens for the CLI and outside tools |
| Web search | Tavily, injected before the call when Pulse or `webSearch` is on | A tool the model calls when it needs it |
| Files and memory | pgvector RAG and the context engine behind flags | Reuse them as tools. No new stores |
| Models | `lib/config/models.ts`: Gemini 2.5 Flash, Claude Sonnet 4.6, GPT-5, DeepSeek V3.1, Qwen3 Coder | A tool-support flag, and IDs and prices refreshed against OpenRouter |
| Route time | `/api/chat` has no `maxDuration` | Multi-step chat needs a step cap and a set duration |
| Deploys | A push to `main` deploys the Vercel projects `zqai` and `v0-zenquantaai` | Every phase ships behind a flag so `main` stays deployable |

## 4. Build or adopt

Rule: adopt what every AI product needs. Build what makes Zenquanta different.

### Adopt

| Layer | Pick | License | Why |
|---|---|---|---|
| Agent loop and tool calling on the server | Vercel AI SDK (`ai`) with the OpenRouter provider (`@openrouter/ai-sdk-provider`) | Apache-2.0 | Multi-step tool loops, streamed tool calls and per-step usage are already solved there. OpenRouter stays the only gateway. We skip writing our own stream parser. |
| Terminal coding agent | OpenCode (`anomalyco/opencode`) as the base for `zq`. Gemini CLI is the fallback | MIT. Gemini CLI is Apache-2.0 | OpenCode is TypeScript like us, works with any provider and is the most active option (about 227k stars, pushed 2026-11-16). It already has the terminal UI, file edits, shell, permissions, sessions and MCP. Rebuilding that would take months. |
| Tool protocol | Model Context Protocol and its official TypeScript SDK | Confirm the license file in Phase 2 | Any harness can use Zenquanta memory and files, and `zq` can use any MCP server. |
| Cloud sandbox (Phase 5) | E2B or Vercel Sandbox | E2B is Apache-2.0. Vercel Sandbox is a managed service | Decided in Phase 5 on cost per minute. |
| Diffs in the web UI (Phase 4) | `diff` (jsdiff) | BSD-3 | Small and standard. |

### Build

- Plans, wallets, per-step metering, and the admin cost and margin views.
- The context engine and shared memory across chat and terminal.
- Six-assistant routing and which tools each assistant gets.
- Session sync, so terminal sessions appear in the web history with their tool steps.
- Forge prompts and tool descriptions, tuned by our own evals.
- The product UI.

### Skip

- LibreChat and Open WebUI. Our app is already further along, and Open WebUI uses a custom license with a branding clause.
- Codex CLI and Goose as the `zq` base. Both are Rust, which this codebase doesn't use.
- Aider as the base. It is Python and its repo has slowed down (last push 2026-05-22).
- Crush. GitHub does not detect a standard open source license on it.

### Rules for adopting

1. Permissive licenses only: MIT, Apache-2.0 or BSD. No AGPL, no source-available licenses like FSL or BUSL, and no branding clauses for code we ship.
2. Keep upstream LICENSE and NOTICE files and credit upstream in the README.
3. Prefer a library to a fork, and a wrapper or plugin to a fork. Fork only when a wrapper hits a wall, and record why in `AI_DECISIONS.md`.
4. Check that the project is active and has a security policy.
5. Ask before adding each dependency, as the repo rules say. Pin exact versions.

## 5. Architecture

```
                 Zenquanta account, plan, wallets and memory
                                    |
       +----------------------------+-----------------------------+
       |                            |                             |
 Web app (/api/chat)        Model API (/api/v1)           MCP server (/api/mcp)
 AI SDK loop with server    OpenAI-compatible and         memory, files, web search
 tools for the assistants   metered per request           and artifacts as tools
       |                            |                             |
  Browser UI               zq (OpenCode based) and any other harness:
                           Aider, Cline, Kilo Code, Codex CLI, Goose
```

Four parts:

1. **Web agent loop.** `/api/chat` runs AI SDK `streamText` with tools when `AGENT_LOOP` is on. The current path stays live when it is off. Server tools only.
2. **Model API.** `/api/v1/chat/completions` and `/api/v1/models`, OpenAI-compatible, streamed, with tools passed through. It exposes Zenquanta model names like `forge-fast` and `forge-best`, not raw OpenRouter IDs. That keeps plan gating with us and lets us swap the model behind a name. Each request is one step: reserve, call, then finalize with the tokens the provider reports.
3. **MCP server.** `/api/mcp` exposes Zenquanta's own tools: `memory_search`, `remember`, `files_search`, `web_search` and `save_artifact`. Any MCP client can use them with a Zenquanta token.
4. **`zq` CLI.** OpenCode preconfigured with the Model API as its provider, the MCP server as a tool source and a plugin that syncs sessions to Zenquanta. Users run `zq login` once.

Why this shape: each Model API request is one model call, so it fits serverless time limits. Tools that touch the user's machine run on the user's machine. Tools that touch Zenquanta data run on our server. Nothing needs a long-lived connection.

### Data changes

One additive migration per phase.

- `zen_messages.parts jsonb null` holds ordered text, tool call and tool result parts. `content` keeps the final text for search, memory and exports. Raw messages stay the source of truth.
- `zen_conversations.surface text default 'web'` (`web` or `cli`) and `workspace jsonb` for the repo name and branch. Never full local paths.
- `zen_agent_runs` has one row per user turn with step count, tokens and status. The server enforces step caps here because it cannot trust the client to.
- `zen_api_tokens` holds the hashed token, a `zq_` prefix, name, scopes, last use, expiry and revoked time. The token is shown once.
- `zen_device_codes` backs `zq login`. Codes are short-lived and rate-limited.
- Usage events gain `surface` and `agent_run_id`.

### Metering

- Each step reserves `estimated prompt + max output` with the existing atomic reserve. It finalizes with the token counts OpenRouter reports, not text estimates.
- A run counts as one daily message on its first step. Later steps only draw tokens.
- New plan limits: `agentStepsPerDay`, `maxStepsPerRun` and the agent models each tier may use. The numbers come from Phase 0 cost runs.
- Loop guard: stop a run when the same tool call with the same arguments repeats three times.

### Security

- Tool results are data, never instructions. Prompts say so, and a web page or file can never approve an action.
- Bearer tokens work only on `/api/v1/*`, `/api/mcp` and `/api/cli/*`. Cookie routes stay cookie-only.
- Tokens are hashed with SHA-256, revocable in Settings, expire after 90 days by default and are rate-limited per token.
- `fetch_url` goes through Tavily extract, so our server never fetches arbitrary URLs itself.
- Server tools keep the existing `user_id` filters. No cross-user reads.
- Session sync uploads truncated tool output and never `.env` files. A per-project `sync: false` keeps a session local.

## 6. Phases

Order: Phase 0 first. Phases 1 and 2 can then run side by side, followed by Phase 3. Phases 4 to 6 come after real use. Sizes are S, M and L.

### Phase 0: Agent foundation (M)

- Add `ai` and `@openrouter/ai-sdk-provider`, and bump zod to a version they accept.
- `lib/agent/*`: the tool registry, the loop wrapper with step caps and the loop guard, and mapping between Zenquanta messages and AI SDK messages.
- `supportsTools` per model in the catalog. Refresh model IDs and prices against OpenRouter. Use OpenRouter's `require_parameters` so requests only go to providers that support tools.
- Migration for `parts`, `surface`, `zen_agent_runs` and the usage event columns.
- Per-step reserve and finalize with provider-reported usage.
- Eval runner skeleton (section 7).
- Everything behind `AGENT_LOOP`, default off.

Done when: unit tests cover the loop, metering and loop guard, a test run calls a real tool through OpenRouter, and typecheck, lint, tests and build pass.

### Phase 1: Tools in web chat (M)

- Server tools: `web_search` (Pulse still searches first), `fetch_url`, `files_search`, `memory_search`, `remember`, `save_artifact`, `github_read` over the existing read-only GitHub App, and `make_image`.
- `make_image` returns a handoff card. The client then sends it through `/api/images/generate`, so the image transport and image wallet stay separate.
- Which tools each assistant gets lives in `lib/config/assistants.ts`. Prism gets none.
- New stream events: `tool_call`, `tool_result` and `step`. Real steps replace the scripted working notes when the loop is on.
- Tool cards in `components/chat/message.tsx`, collapsed by default.
- `/api/chat` gets a `maxDuration` and a web step cap, starting at 8.

Done when: chat evals pass. Then the flag goes on for Nova and Forge in production, then for the rest.

### Phase 2: Zenquanta for any harness (M)

- API tokens: create, list and revoke in Settings. Device login with a `/cli/authorize` page plus `/api/cli/device` and `/api/cli/token`.
- The Model API at `/api/v1`, streamed, with tools passed through and metering per request.
- The MCP server at `/api/mcp` with the Zenquanta tools.
- A docs page on using Zenquanta with OpenCode, Aider, Cline, Kilo Code and Codex CLI through the Model API, and with any MCP client through the MCP server.

Done when: OpenCode and Aider each finish a coding task through Zenquanta, and the usage shows in the dashboard and the admin cost views.

### Phase 3: `zq`, Forge in the terminal (L)

- A two-day spike first: OpenCode against Gemini CLI. Check provider config, plugin hooks for session events, the permission model, headless mode, how much we would patch and how fast upstream changes.
- Ship the npm package `zenquanta` with a `zq` command. The name was free on npm on 2026-11-16. It covers `zq login`, the preset provider and MCP server, the session sync plugin and Zenquanta defaults for Forge.
- Start as a wrapper or plugin on upstream. Fork only if needed.
- Terminal sessions show in the web sidebar under Forge with a terminal badge. They are read-only on the web at first, since their tools are local.
- Publishing to npm needs the user's go-ahead.

Done when: the coding evals pass with the default Pro model, and a real task in a real repo goes from prompt to a working change.

### Phase 4: Shared memory and the browser view (S to M)

- Coding sessions feed the context engine (`MEMORY_EXTRACTION`), so web assistants know what happened in the terminal.
- A web view of terminal sessions with steps, diffs and usage.
- `zq --resume <id>` from a web session.

### Phase 5: Cloud runs (L, needs a decision)

- Pick E2B or Vercel Sandbox on cost per minute and plan limits.
- Run the same `zq` harness headless inside the sandbox, so local and cloud share one harness.
- GitHub App write access to push a branch and open a PR. This reverses the read-only GitHub decision and needs the user's yes.
- A `run_code` tool for chat, with Python and JS for math, data and charts.

### Phase 6: Later, picked when ready

- VS Code: point Cline or Kilo Code at the Model API first. Build our own extension only if needed.
- Scheduled and background agents.
- Remote MCP connectors in web chat.
- Payments, only when the user asks.
- Teams.

## 7. Evals

A harness is only as good as its prompts and tool descriptions, and tuning those needs numbers.

- `evals/chat/`: about 20 tasks with checks. Some need search, some a file, some memory, and some should call no tool at all.
- `evals/coding/`: about 20 small fixture repos, each with a task and a check script. A slice of public SWE-bench style tasks can come later.
- Runner: `pnpm eval --model <name>` drives the headless CLI against the Model API.
- Track pass rate, steps, tokens, cost and time per model. Save results as JSON in `evals/results/`.
- Each tier's default agent model is the one with the best pass rate per dollar of raw cost.

## 8. Risks

| Risk | Mitigation |
|---|---|
| Cheap models are bad at tool calls | `supportsTools` flag, evals per model, and Free gets the best cheap model that passes |
| Agent runs burn tokens fast, and harnesses send big system prompts | Per-step metering, step caps, run token caps, prompt caching passed through, and plan limits set from measured cost |
| OpenRouter terms on reselling a model API | Read them before Phase 2 ships publicly |
| Fork drift if `zq` becomes a full fork | Wrapper first. If forked, keep patches small and rebase on a schedule |
| Prompt injection from web pages, files or repos | Tool output is data, the CLI asks before writes and shell commands, and content can never approve an action |
| Token leaks | Hashed, scoped, expiring, revocable, shown once and rate-limited |
| Serverless timeouts on long chat runs | A step cap and `maxDuration` on the web. The Model API is one step per request |
| The repo is public | No secrets in code or docs. An open CLI is fine because the value is the service |

## 9. Decisions this changes

- "Zenquanta has no tool/function-calling surface" in the Context Engine decision was true when written. Phase 0 adds one, and the deferred tool-result ideas get revisited after Phase 1.
- "MCP connector runtime" was out of scope after GitHub v1. Phase 2 adds an MCP server and Phase 3 lets `zq` use MCP servers.
- "OpenRouter is the only AI gateway" stays. The AI SDK is a client library over it.
- "Text and image transports are separate" stays. `make_image` hands off to `/api/images/generate`.
- GitHub stays read-only until the Phase 5 decision.
- Payments stay manual.

## 10. New dependencies to approve

| Phase | Package | Use |
|---|---|---|
| 0 | `ai`, `@openrouter/ai-sdk-provider` and a zod bump | Agent loop |
| 2 | `@modelcontextprotocol/sdk` | MCP server |
| 3 | `opencode-ai` or a fork, inside the `zq` package | Terminal agent |
| 4 | `diff` | Diff views of terminal sessions |
| 5 | `e2b` or `@vercel/sandbox` | Cloud runs |

Versions get pinned when each phase starts.

## 11. Open questions

1. Agent limits per plan get set after the Phase 0 cost runs. Does Free get the CLI? Proposal: yes, with one cheap agent model and a small daily step budget.
2. Is session sync on by default? Proposal: on, with `sync: false` per project.
3. Do OpenRouter's terms allow a metered public model API?
4. Does `zq` live in this repo as `packages/zq` in a pnpm workspace, with the root app unchanged, or in its own repo? Proposal: this repo, so it shares the API contract types with the server.
