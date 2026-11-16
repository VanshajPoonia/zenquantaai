# Spec 01: Agent Loop and Tools in Web Chat

Lane A. Days 1 to 8. Flag: `AGENT_LOOP` (default off).

## Goal

Text assistants call tools in the web app. A tool-using turn streams like today, and each tool step shows as a card. When the flag is off, nothing changes.

## Day 1 spike (Gate A)

Build a throwaway route that:

1. Creates a `pi-agent-core` `Agent` with `pi-ai`'s OpenRouter provider (`@earendil-works/pi-ai/providers/openrouter`) and the server's `OPENROUTER_API_KEY`.
2. Gives it one tool (`echo`) and asks a question that needs it.
3. Streams text deltas and the tool call as NDJSON.
4. Logs `usage.input`, `usage.output`, `usage.cacheRead` and `usage.cost.total` from the final message.

Run it on a Vercel preview with Node 22.19 or newer. Check:

- Cold start time and bundle size. Import provider subpaths only, never the package root, so the AWS, Google and Anthropic SDKs stay out.
- If Next.js bundling fails, try `serverExternalPackages` in `next.config.mjs`.
- Abort works when the client disconnects (`request.signal`).

Pass: a tool call round trip streams on the preview. Fail: switch this spec to the Vercel AI SDK with the same tool list, events and hooks.

## Files

| File | What |
|---|---|
| `lib/agent/runtime.ts` | Creates the Agent per request: model, system prompt, tools, hooks |
| `lib/agent/tools/*.ts` | One file per server tool |
| `lib/agent/tool-policy.ts` | Which tools each assistant mode gets |
| `lib/agent/events.ts` | Maps pi events to Zenquanta stream events |
| `lib/agent/metering.ts` | Reserve before a request, finalize after it, loop guard |
| `lib/agent/messages.ts` | Converts Zenquanta messages and `parts` to pi messages and back |
| `app/api/chat/route.ts` | Uses `lib/agent` when `AGENT_LOOP` is on, keeps the old path otherwise |
| `types/index.ts` | `MessagePart`, new stream event types, `Message.parts` |
| `lib/chat-context.tsx` | Handles `tool_call`, `tool_result` and `step` events |
| `components/chat/message.tsx` | Renders tool cards from `parts` |
| `lib/db/schema.ts` and the migration | `parts`, `zen_agent_runs`, usage event columns |

## Server tools

| Tool | Backed by | Assistants | Notes |
|---|---|---|---|
| `web_search` | `searchWebForContext` (Tavily) | All text assistants | Pulse still searches before the first step, as today |
| `fetch_url` | Tavily extract | All text assistants | Our server never fetches the URL itself |
| `files_search` | `retrieveFileKnowledgeContext` | All text assistants | Scoped to the user and the conversation's project |
| `memory_search` | `retrieveDurableMemoryContext` | All text assistants | Only registered when `MEMORY_EXTRACTION` is on |
| `save_artifact` | `neonArtifactsRepository` | All text assistants | Returns the artifact id and title |
| `make_image` | none | Nova, Velora | Returns a handoff card. The user clicks to send it to Prism through `/api/images/generate`, so image credits are only spent on a click |

Prism gets no tools. Custom assistants get the tools of their base mode.

Every tool:

- takes a JSON Schema built with `@earendil-works/pi-schema`,
- throws on failure (pi reports it to the model as a tool error),
- returns at most 8 KB of text to the model,
- gets the user id from the server session, never from the model's arguments.

## Keep what works today

- Context assembly stays the same: system prompt, custom assistant block, conversation memory, durable memory, cross-chat recall, time zone. It moves into the Agent's system prompt and messages through `prepareRequest`.
- Pulse search and `fileContext` pre-injection stay as they are. Tools are extra.
- `saveTurnStart`, `completeConversationWithAssistant` and `saveAssistantCompletion` stay the save path.

## Stream events

Existing events stay: `start`, `working`, `sources`, `delta`, `done`, `error`. New ones:

```ts
{ type: 'tool_call', conversationId, messageId, callId, name, label, args }
{ type: 'tool_result', conversationId, messageId, callId, ok, summary, sources? }
{ type: 'step', conversationId, messageId, step, of }
```

`summary` is a short line for the card, such as "Found 5 sources" or "Saved artifact: Launch notes". `working` notes come from real steps when the loop is on.

## Message parts

```ts
type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'tool_call'; callId: string; name: string; args: unknown }
  | { type: 'tool_result'; callId: string; ok: boolean; summary: string; output?: string }
```

`output` is truncated to 4 KB before saving. `content` still holds the final text. Old messages without `parts` render as today.

## Metering

- `prepareRequest`: reserve `estimated prompt + maxAgentOutputTokens` with the existing atomic reserve, and add one to `daily_agent_step_count`. Refuse when either limit is hit.
- `finishTurn`: finalize with `pi-ai`'s reported tokens and write a usage event with `surface = 'web'` and `agent_run_id`.
- On abort or error: release the reservation, as today.
- A web turn still counts one daily message.
- Stop the run at `maxStepsPerRun` (web cap starts at 8) or when the loop guard fires.
- `/api/chat` gets `export const maxDuration` set from the Vercel plan limit.

## UI

- Tool cards sit above the answer text, collapsed by default: an icon, a label ("Searched the web"), the summary and a chevron for details.
- The `make_image` card has a "Create with Prism" button that queues a normal Prism send.
- While a tool runs, its card shows a spinner. The streaming line stays as it is.
- Cards must stay referentially stable so the memoized `ChatMessage` does not re-render (see `AI_DECISIONS.md`, "Streamed Text Is Applied Once Per Frame").

## Tests

- Unit: event mapping, parts conversion both ways, loop guard, the metering reserve, finalize and release paths, tool policy per mode.
- Unit: every tool rejects a model-supplied user id and stays scoped to the session user.
- Manual: Nova searches and cites, Forge searches files, Pulse still searches first, `make_image` spends no credits until clicked, aborting mid-tool releases the reservation.

## Done when

- With the flag on, Nova, Velora, Axiom, Forge and Pulse call tools on a preview deploy, and usage events show per step.
- With the flag off, `/api/chat` behaves byte for byte as before.
- Typecheck, lint, tests and build pass.
