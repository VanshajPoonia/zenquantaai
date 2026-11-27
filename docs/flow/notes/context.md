# Lane C notes: instructions and context

Branch `flow/context`. Nothing is pushed, deployed or migrated.

## Before this reaches any deployed environment

Run `neon/migrations/20261201_zenquanta_project_instructions.sql` first. It adds `zen_projects.instructions`. Drizzle selects every schema column, so without it the project list, Project Home and every chat request fail.

## What shipped

### About you
- `AppSettings` has `aboutYou`, `responseInstructions` (1,500 characters each) and `useCustomInstructions` (default on). They live in the existing `zen_user_settings.payload` jsonb, so no migration.
- `POST /api/settings` returns 400 for text over the limit or the wrong types. The repository also trims and caps on read and write.
- Settings has a new Personalization tab with two text boxes, counters, a pause switch and the line "Every assistant reads this. Don't put passwords here."

### Project instructions
- `zen_projects.instructions` text, up to 4,000 characters. `PATCH /api/projects/[id]` takes `instructions` (string, or null to clear) and trims it.
- Project Home has an Instructions card with view, edit and save. The empty state uses the copy from the plan.

### Injection
- `lib/ai/user-instructions.ts` builds one bounded `[User instructions]` block: about you, then how to answer, then the project. It frames everything as preferences that never override safety, system or tool rules or plan limits. The pause switch drops the personal part but keeps project instructions.
- `lib/ai/load-user-instructions.ts` (server only) reads settings and the project from Neon by user id and the chat's project id. The route never reads instruction text from the request body.
- The block sits right after the system prompt on the plain path and inside the agent system prompt. It counts toward the usage estimate and the `CONTEXT_BUDGET` governor. This covers every text assistant and custom assistants. Prism, `/api/v1`, zq, Model Duel and the custom assistant test route do not get it.

### Context meter
- A ring in the composer (`components/chat/context-meter.tsx`, pure estimate in `lib/chat/context-meter.ts`). It adds a fixed allowance for the system prompt and time note, the instruction block, custom assistant instructions, the summary, the recent window and the draft with attachment text. Tokens are chars/4.
- The window comes from `getChatContextWindowTokens(mode, tier)` in `lib/config/models.ts`. The catalog has no per-model windows, and every text model takes at least the largest plan cap, so it returns the plan's per-request input limit. Without a loaded plan it shows the message count instead of a percent.
- The popover reads the real window size (`RECENT_TURN_MESSAGE_LIMIT`, now exported from `lib/ai/memory.ts`) and shows whether a summary exists and when it was updated.

### Fresh start
- `POST /api/conversations/[id]/continue` makes an empty chat in the same project with the same assistant and custom assistant, memory on. It copies `memorySummary`, `memoryUpdatedAt` and the structured summary, and stores `continuedFrom: {conversationId, title}` in `session_settings`. A legacy text summary is parsed into the structured shape (`parseRenderedSummary`) so both summarizers can build on it. It returns 400 without a summary or for zq sessions.
- Only that route writes `continuedFrom`. `conversationToInsert` strips it, and the header upsert merges the stored value back in SQL, so a client can never set it.
- Chat path check: the first message of a continued chat does read the summary (test in `tests/conversation-continuation.test.ts`). The real gap was the legacy summarizer (`MEMORY_V2` off) replacing it after the first reply. Continued chats now keep the carried summary ahead of their own. With `MEMORY_V2` on, the structured summary is already the base the job merges into.
- Memory Vault: turning memory off no longer drops `continuedFrom`, and Clear memory now also clears the structured summary and its checkpoint. Before this, the V2 job could bring a cleared summary back.
- The popover button is disabled with "Available after a longer chat" until a summary exists. Continued chats show a slim banner that links back to the original.

### Artifact links
- The `save_artifact` card shows the title and an Open artifact button that opens Artifact Studio at the id from the tool result.

## Hot files touched
- `app/api/chat/route.ts`: one import, the loader call before `buildPromptTextForUsage`, one extra argument at three call sites.
- `lib/db/schema.ts`: one column in `zenProjects`.
- `components/chat/composer.tsx`: one import and a three-line mount before the intelligence picker.
- `components/chat/tool-steps.tsx`: a small button component and a block in the card.
- Also `lib/ai/chat.ts` (new trailing argument, legacy carry-over), `components/chat/chat-area.tsx` (banner mount), `components/chat/settings-modal.tsx` (new tab), `components/chat/project-home.tsx` (card mount).
- Not touched: `lib/chat-context.tsx`, `components/chat/message.tsx`, `components/chat/settings-panel.tsx`, `components/chat/composer-usage.tsx`.

## Risks
- The migration has to go first (see the top).
- The `session_settings` merge in `upsertConversationHeader` was checked by rendering the SQL, not against a live Postgres.
- The meter is an estimate. It skips per-request retrieval (web, files, durable memory, cross-chat), agent tool schemas, usage-limit overrides and the larger agent input cap. It assumes the legacy last-8 window, which differs when `CONTEXT_BUDGET` is on.
- The meter reads project instructions from the project list loaded at startup. After an edit on Project Home it updates on the next reload. The server always uses the fresh value.
- The block can add about 1,800 tokens per request. On Free (8,000 input tokens per request) long chats hit the per-request limit sooner.

## Check in a browser
- Settings > Personalization: type, counters, pause switch, Save, reload.
- Project Home: add, edit, cancel and clear instructions, at 390 px too.
- Composer ring at 390 px next to the intelligence picker and send button. Popover text, colors near the limit, keyboard focus.
- A reply reflects about you and project instructions with `AGENT_LOOP` on and off.
- Start fresh: the new chat opens with the banner, the link goes back, the first reply knows the summary, and the banner survives a reload and a second message.
- With `AGENT_LOOP` on, ask to save a document and use Open artifact.
