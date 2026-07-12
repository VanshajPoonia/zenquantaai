# Zenquanta Context Engine — Architecture & Implementation Plan

Status: **in progress** (Phases 1–4 backend landed, behind flags; Phase 3 Memory Vault UI surfacing + Phase 5 pending).
Owner: Claude Code (architecture + implementation). Last updated: 2026-07-11.

This document is the source of truth for Zenquanta's context/memory system. It reconciles
two proposals (an internal tiered plan and an external 19-phase brief) against the **actual
codebase** and commits to a right-sized design. Read this before touching `lib/ai/memory.ts`,
`lib/context/*`, the chat route, or the conversation schema.

---

## 1. Goal

Make Zenquanta hold context **better than a stock frontier chatbot while spending fewer
input tokens**. The product claim we are backing:

> "Cost stays flat as a conversation grows, with effectively unlimited memory span across
> all of a user's chats — and exact facts (IDs, code, numbers, decisions) are never
> paraphrased or lost."

Concretely, three user-facing capabilities:

1. **Long single-chat memory** — a chat stays coherent past the raw window without resending
   the whole transcript.
2. **Cross-chat memory** — "all chats refer to each other." Something told to Nova is
   available to Forge later.
3. **A cheap-model write gate** — after each turn a low-cost model decides whether anything
   is durably worth remembering, and only then stores it.

Plus reduced token usage (governed budget, cache-friendly ordering, optional TOON).

---

## 2. Starting point (audit of what already exists)

| Capability | Today | Verdict |
|---|---|---|
| Per-request context | Last **8 messages**, capped ~24k chars (`lib/ai/memory.ts`) | Replace with governed budget |
| "Memory summary" | **Regex keyword matching**, not an LLM | Replace with cheap-LLM structured summary |
| Cross-chat memory | **None** — each conversation is an island | Build (Tier 2) |
| Durable user memory | **None** | Build (Tier 3) |
| Vector store | pgvector @ 1536 dims (`zen_file_chunks`), HNSW cosine | **Reuse** |
| Embeddings | `lib/rag/embeddings.ts` (`createEmbeddings`, `hasEmbeddingConfig`) | **Reuse** |
| Cheap models | `google/gemini-2.5-flash`, `deepseek/deepseek-chat-v3.1` in catalog | **Reuse** |
| Token/cost estimate | `lib/utils/cost.ts`, `lib/billing/*` | **Reuse** |
| Memory Vault UI | Exists (per-conversation enable/clear) | **Extend** for durable items |
| Tool / function calling | **Does not exist** — text streamed from OpenRouter | Out of scope |
| Workspace concept | **Does not exist** — only projects + conversations | Out of scope |

**Raw messages are the permanent source of truth.** Every message is stored in full in
`zen_messages`. Summaries and memory items are *additive, read-time optimizations* and are
always reconstructable from raw history. Nothing in this system deletes or rewrites raw
messages. This is the invariant that makes the whole thing safe to roll back.

---

## 3. What we deliberately did NOT adopt from the external brief

The external 19-phase brief is directionally correct but scoped for a larger product. Cut or
deferred:

- **Dynamic tool selection / tool-result externalization** (their Phases 14–15) — **cut.**
  Zenquanta has no tool/function-calling surface. Nothing to select or externalize.
- **Workspace scope** — **cut.** No workspace tier exists. Scope hierarchy is
  `global → project → conversation` (+ `mode` as ranking metadata only).
- **Per-assistant memory isolation** — **cut.** It fights the cross-chat goal. Memory is
  user-global by default, project-scoped inside a project, **never** mode-scoped.
- **Dedicated `project_states`, `context_checkpoints`, `context_retrieval_logs`,
  `external_tool_results` tables** — **deferred.** The rolling structured summary covers
  checkpointing; project status folds into memory items; retrieval logging starts as
  dev-only structured logs. Build the tables when data proves they're needed (triggers in §7).
- **Benchmark-report ceremony as an acceptance gate** — **relaxed.** We measure token deltas,
  but the only *blocking* tests are cross-user / cross-project isolation.

What we **did** adopt from the brief (its strongest ideas): **exact-evidence preservation**
(fragile tokens bypass compression), **supersession** (corrections beat stale memory via a
canonical key), **raw-is-truth**, **feature flags with the old path kept live**, and
**stable-prefix prompt ordering for provider caching**.

---

## 4. Target architecture

### 4.1 Three memory tiers + a token governor

```
WRITE PATH (async, after the response streams — zero added user latency)
  turn completes
    → cheap deterministic pre-gate (skip trivially non-durable turns for free)
    → TWO separate gated cheap-model calls (gemini-2.5-flash), one job each:
        (a) update this conversation's rolling structured summary   ← Tier 1
        (b) extract 0..N durable memory candidates                  ← Tier 3 (the write gate)
    → for each candidate: embed + pgvector search by similarity/canonical_key
        unchanged → bump last_confirmed_at
        changed   → insert new (active), mark old superseded         ← corrections win
        new       → insert
    → re-embed conversation summary for cross-chat recall            ← Tier 2

READ PATH (per request, under a governed token budget)
  user message
    → deterministic request analysis (needs history/files/exact recall?)
    → assemble blocks, each with a fixed ceiling, stable→volatile order:
        system prompt + assistant identity        (stable, cache-friendly)
        Tier 3  durable user memory   (~600 tok)  pgvector top-k + always-include identity
        Tier 2  cross-chat recall     (~800 tok)  pgvector over OTHER conversations' summaries
        Tier 1  rolling summary       (~500 tok)  structured summary of older turns
        RAG     file chunks           (~1200 tok) existing retrieval, unchanged
        EXACT   evidence block                    IDs/code/routes/numbers, verbatim
        recent verbatim turns         (remainder) adaptive window
    → stream (transport unchanged)
```

The Tier 1 summary and Tier 3 extraction are **separate** gated calls
(`maybeUpdateRollingSummary` / `maybeExtractDurableMemories`), not one combined
call — independent flags give independent rollout/rollback. Merging them when both
flags are on is a documented cost follow-up. See `AI_DECISIONS.md`.

### 4.2 Scoping & isolation (non-negotiable)

- Every memory/summary query filters by `user_id` at the SQL level — never trust a
  passed-in scope object alone, matching existing repo patterns (`eq(userId)` everywhere).
- Project-scoped memories (`project_id` set) must not surface in a different project.
  Global memories (`project_id` null) surface everywhere for that user.
- Conversation scope is the most specific; it never leaks to sibling conversations except
  via Tier 2 recall, which only exposes a short *summary* of another conversation, scoped to
  the same user.
- Cross-user leakage and cross-project leakage tests are **blocking** for every phase that
  touches retrieval.

### 4.3 The token governor

A single allocator (`lib/context/token-budget.ts`, Phase 2) owns block sizing:

- Fixed ceilings per block; recent turns take the remainder up to a per-tier cap
  (e.g. free ≈ 4k prompt tokens, pro ≈ 12k).
- Blocks degrade gracefully: no memories → recent turns absorb the slack.
- **Never** truncates the current user message or system safety rules.
- Always reserves output tokens; never fills the whole window (margin for provider
  token-count drift).
- Emits per-block token counts for observability and billing.

Prompt ordering keeps the **stable prefix first** (system → identity → durable memory) and
**volatile content last** (recent turns) so OpenRouter's pass-through provider prompt caching
can discount the prefix.

---

## 5. Data model

**New table `zen_memory_items`** (Phase 3):

```
id, user_id, project_id (nullable = global), source_conversation_id,
kind (identity | preference | constraint | decision | fact | open_loop | project_status),
canonical_key,            -- dedup/supersession anchor, e.g. "zenquanta.database"
content (<=240 chars),    -- atomic, human-readable
content_json (nullable),  -- structured payload when useful
mode (nullable),          -- which assistant learned it; ranking only, NOT isolation
importance, confidence,
status (active | superseded | expired),
supersedes_id (nullable),
embedding vector(1536),
created_at, last_confirmed_at, valid_until (nullable)
```

Indexes: `user_id`; `(user_id, project_id, status)`; `canonical_key`; HNSW on `embedding`.

**On `zen_conversations`** — extend, don't add a table:

- `memory_summary` (text) — *existing*; now holds the rendered LLM summary (was regex).
- `memory_summary_structured` (jsonb) — **Phase 1**; structured summary object
  (objective, decisions, constraints, facts, open loops, preferences).
- `summarized_through_message_id` (text) — **Phase 1**; last message covered, for
  incremental summarization.
- `summary_embedding` (vector 1536) — **Phase 4**; for cross-chat recall.

---

## 6. Build phases

Each phase ships behind a flag; the old path stays live until the new one is proven.

| Phase | Deliverable | Flag | Proof |
|---|---|---|---|
| **1 ✅** | Structured LLM rolling summary (async, replaces regex) | `MEMORY_V2` | Shipped. Unit-tested parse/render; typecheck/build |
| **2 ✅** | Token governor + cache-friendly prompt ordering | `CONTEXT_BUDGET` | Shipped. Allocator unit-tested; legacy path byte-identical when off |
| **3 ✅ (backend)** | `zen_memory_items` + extraction gate + supersession + exact-evidence + read-path injection | `MEMORY_EXTRACTION` | Shipped. Parse/dedupe/scope/exact-evidence unit-tested; typecheck/build; off-path inert. Memory Vault UI surfacing = Phase 3c follow-up |
| **4 ✅ (backend)** | Cross-chat recall via summary embeddings | `CROSS_CHAT_RECALL` | Shipped. `summary_embedding` on `zen_conversations`; user-scoped `searchConversationSummaries`; block unit-tested; off-path inert. Write depends on `MEMORY_V2` |
| **5+** | Neighbor retrieval, extractive compression, TOON | `TOON_SERIALIZATION`, … | Token deltas; long-conversation fidelity |

### Feature flags (env, default OFF)

```
MEMORY_V2                     structured LLM rolling summary
CONTEXT_BUDGET                token governor + reordering
MEMORY_EXTRACTION             durable memory items + write gate
CROSS_CHAT_RECALL             cross-chat summary retrieval
TOON_SERIALIZATION            TOON encoding for uniform blocks
CONTEXT_DEBUG                 dev-only structured context logging
```

Flags live in `lib/context/flags.ts`. All default to disabled so `main` is always safe to
deploy; the pre-existing regex/last-8 path runs whenever a flag is off.

---

## 7. Deferred, with the trigger to build

- **`project_states` table** — build when real coding-project users exist and folding status
  into `project_status`-kind memory items proves too coarse.
- **`context_checkpoints` table** — build when conversations routinely exceed ~30 turns and
  the rolling summary loses structure.
- **`context_retrieval_logs` table** — build when tuning ranking weights needs recorded data;
  until then use `CONTEXT_DEBUG` structured logs + existing usage events.
- **Full-text hybrid retrieval, multi-granularity doc routing** — build if pure-vector recall
  measurably misses.

---

## 8. On TOON and LLMLingua

- **TOON**: helps only on *uniform arrays of objects* (memory lists, sources, table previews)
  — ~30–50% on those blocks, but they're a small share of total prompt tokens, so net ≈ 3–8%.
  Gate it: array, ≥8 rows, uniform schema, ≥10% token win vs minified JSON, never for
  structured outputs. Do it **last** (Phase 5+).
- **LLMLingua**: requires hosting a Python encoder — wrong fit for the Vercel/Next stack. Our
  async cheap-LLM summarizer is the pragmatic equivalent (extractive compression via a model
  already routed through OpenRouter, run off the critical path).

---

## 9. Honest expectation-setting

The "≥35% token reduction" target is real only on **long and cross-session** conversations.
On short chats this system *adds* tokens (memory + recall blocks). The true, sharper claim is
**"cost stays flat as conversations grow, with unlimited memory span"** — backed by
stable-prefix cache discounts and by not resending a growing raw transcript. Do not market a
flat percentage until measured before/after on a real workload.
