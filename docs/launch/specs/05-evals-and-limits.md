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

## Build after Gate B (Day 7)

- Add the agent fields to every plan in `lib/config/pricing.ts` (`PLAN_CONFIGS`) and to the plan types.
- Enforce them in `lib/agent/metering.ts` and the Model API.
- Show agent steps left today on `/dashboard` and in `zq /usage`.
- Show the agent limits on `/pricing`, using the same config values.
- Admin cost views: add a surface filter (web or cli) and agent steps per user.

## Done when

- Eval round 2 on Day 8 passes at least 10 of 12 chat tasks and 6 of 8 coding tasks with each paid plan's default model.
- The user has approved the Gate B table, and the code uses those numbers.
