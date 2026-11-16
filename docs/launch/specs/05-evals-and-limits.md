# Spec 05: Evals and Agent Limits

Lane D. Days 3 to 8. Gate B on Day 4.

## Goal

Pick each plan's agent models and limits from measured quality and cost, not guesses. Agent work uses far more tokens than chat, so this decides whether launch pricing holds.

## Why it matters

Today's Free plan allows 8,000 input and 800 output tokens per request and 1,000,000 core tokens a month. One coding session in a harness can send 20 to 40 requests of 10,000 to 40,000 input tokens each. Without separate agent caps, agents either fail on Free or drain a wallet in one session.

## Evals

Folder `evals/`:

- `evals/chat/`: 12 tasks as JSON (prompt, assistant, expected tool or "no tool", and a check). Mix: needs web search (3), needs a file (3), needs an artifact (2), should not call a tool (4).
- `evals/coding/`: 8 tiny fixture repos, each with `TASK.md` and `check.sh`. Mix: fix a failing test, add a small function with a test, rename across files, read an error log and patch, write a README section, refactor one module, add a CLI flag, find and fix an off-by-one.
- `scripts/evals/run.ts`:
  - chat: runs `lib/agent/runtime.ts` against a test user on a Neon branch,
  - coding: copies each fixture to a temp folder and runs `zq -p "$(cat TASK.md)" --allow-edits --model <name>`, then `check.sh`.
- Results go to `evals/results/<date>-<model>.json` with pass or fail, steps, input tokens, cache-read tokens, output tokens, raw cost and seconds.

Models to compare on Day 4 (IDs refreshed against OpenRouter that day): the current Forge model per tier, `qwen/qwen3-coder`, `deepseek/deepseek-chat-v3.1`, `google/gemini-2.5-flash` and `anthropic/claude-sonnet-4.6`.

Budget: keep a full eval round under $20 of OpenRouter spend.

## Gate B: numbers to approve on Day 4

From the results, fill this table and bring it to the user:

| Plan | Agent models | `agentStepsPerDay` | `maxStepsPerRun` | `maxAgentInputTokens` | `maxAgentOutputTokens` | Gets `zq` |
|---|---|---|---|---|---|---|
| Free | | | | | | |
| Basic | | | | | | |
| Pro | | | | | | |
| Ultra | | | | | | |
| Prime | | | | | | |

Also decide:

- How cache-read tokens count against wallets. Upstream they cost about a tenth of normal input on many models. Counting them in full would drain wallets about ten times faster than our real cost.
- Whether Free gets `zq` with one cheap model, or web tools only.
- Each plan's worst-case monthly raw cost if a user maxes the agent limits, next to the plan price.

## Gate B results (2026-11-16)

Coding evals through zq (`evals/results/2026-11-16-coding-*.json`), 6 tasks per model:

| Plan and model | Passed | Cost per task | Cost per step | Steps per task | Wallet tokens per step | Raw $ per 1M wallet tokens |
|---|---|---|---|---|---|---|
| Free/Basic `forge`: Qwen3 Coder | 6/6 | $0.0027 | $0.0006 | 4.8 | about 1,150 | $0.51 |
| Free/Basic `forge-lite`: DeepSeek V3.1 | 6/6 | $0.0043 | $0.0008 | 5.2 | about 980 | $0.84 |
| Free/Basic `forge-fast`: Gemini 2.5 Flash | 4/6 | $0.0025 | $0.0006 | 4.0 | about 1,600 | about $0.5 |
| Pro `forge`: GPT-5.3 Codex | 6/6 | $0.012 | $0.0026 | 4.7 | about 880 | $2.91 |
| Ultra `forge`: Claude Sonnet 4.6 | 6/6 | $0.057 | $0.016 | 3.7 | about 4,650 | $3.35 |

Each step sends about 3,500 to 3,800 prompt tokens, but most of that is a cached prefix, so it draws about 900 to 1,150 wallet tokens with cache reads at a tenth. Sonnet draws more because its cache writes count in full.

### What bounds cost

The monthly wallets are the real ceiling. Worst case, if a user spends every wallet token on agent work with the plan's Forge model:

| Plan | Price | Core wallet at the cheap rate | Tier wallet at the Forge rate | Worst-case raw cost a month |
|---|---|---|---|---|
| Free | $0 | 1M × $0.84 = $0.84 | none | about $0.84 |
| Basic | $4 | 2M × $0.84 = $1.68 | none | about $1.70 |
| Pro | $15 | 3M × $0.84 = $2.52 | 650k × $2.91 = $1.89 | about $4.40 |
| Ultra | $59 | 5M × $0.84 = $4.20 | 2.7M × $3.35 = $9.05 | about $13.30 |
| Prime | $200 | 8M × $0.84 = $6.72 | 8M × about $5.6 (Opus 4.6, estimated) = $45 | about $52 |

Every paid plan keeps a healthy margin even at full use. Free costs at most about $0.84 a month per heavy user.

### Recommendation for the user

1. Keep the daily agent step caps as they are (60, 200, 800, 2,000 and 5,000). The wallets bound cost, and the caps only stop runaway loops.
2. Raise `maxStepsPerRun` for zq on Free to 15 and on Basic to 20. The rename task needed 8 to 9 steps, so Free's current 8 would cut real tasks short. The web chat cap stays 8.
3. Keep cache reads at a tenth of a wallet token.
4. Give Free zq with `forge` (Qwen3 Coder), which passed every task at the lowest cost.
5. Replace or drop `forge-fast`. Gemini 2.5 Flash failed 2 of 6. Swapping it changes the chat "Fast" level too, so it needs its own eval run first.
6. Meter web search at 8,000 wallet tokens a search (about $0.007 at cheap-model rates) once decided. See `NEEDS_YOU.md`.

### Approved on 2026-11-17

The user approved the recommendation. Applied: Free 15 and Basic 20 zq steps per run, the zq model table (`forge-fast` GPT-5.1 Codex Mini after it passed 6/6, `forge-lite` DeepSeek V3.1, `forge-best` Claude Sonnet 4.6 on Pro and up), and 8,000 wallet tokens per web search.

## Build after Gate B (Day 7)

- Add the agent fields to every plan in `lib/config/pricing.ts` (`PLAN_CONFIGS`) and to the plan types.
- Enforce them in `lib/agent/metering.ts` and the Model API.
- Show agent steps left today on `/dashboard` and in `zq /usage`.
- Show the agent limits on `/pricing`, using the same config values.
- Admin cost views: add a surface filter (web or cli) and agent steps per user.

## Done when

- Eval round 2 on Day 8 passes at least 10 of 12 chat tasks and 6 of 8 coding tasks with each paid plan's default model.
- The user has approved the Gate B table, and the code uses those numbers.
