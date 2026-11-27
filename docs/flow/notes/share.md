# Lane B: share and branch

Branch `flow/share`. Written 2026-11-28 for the lead to merge into the AI docs.

## What shipped

### Share a chat by link

- Table `zen_conversation_shares` in `neon/migrations/20261201_zenquanta_conversation_shares.sql` and `lib/db/schema.ts` (next to the other share tables). Written, not applied.
- Sharing is off until `NEXT_PUBLIC_CHAT_SHARING=true` (`isChatSharingEnabled()` in `lib/config/features.ts`). Set it only after the migration is applied, then redeploy. While it is off the routes 404, the page 404s and the menu item is hidden.
- `lib/share/redact.ts` hides keys and tokens with `[hidden]` and counts them: OpenAI, OpenRouter and Anthropic keys (`sk-`), `zq_` tokens, GitHub tokens (`ghp_ gho_ ghs_ ghu_ ghr_ github_pat_`), AWS key ids (`AKIA`, `ASIA`), Slack (`xox?-`), Google (`AIza`), JWTs, PEM private key blocks (also cut-off ones), Bearer tokens, URL credentials for any scheme, and assignments whose name says SECRET, TOKEN, KEY, PASSWORD or PASS. Values like `process.env.X`, `${X}` and `{{X}}` are left alone.
- `lib/share/snapshot.ts` builds the snapshot from the owner's Neon rows (`lib/share/conversation-shares.ts` loads them with the user id). It keeps role, text, mode, assistant family, custom assistant name and emoji, time, tool calls and results cut to 2,000 characters (summary 300), and sources as title plus a public http(s) url. File sources keep the name with no url. It drops attachments (names only), Prism images (flag shown as "Image not included in shared chats"), model ids, usage, memory, project, workspace, tool result data and message ids. Redaction runs before cutting. Limits: 500 messages and 2 MB of JSON.
- Routes:
  - `GET /api/conversations/[id]/shares` lists live links and returns a preview `{ messageCount, redactionCount, blockedReason }`.
  - `POST /api/conversations/[id]/shares` makes a link. 30 an hour per user (`chat-share:<user>`), 10 live links per chat. The body is ignored.
  - `DELETE /api/conversations/[id]/shares/[shareId]` revokes.
  - `POST /api/share/conversations/[token]/copy` copies the snapshot into the signed-in visitor's account as a new web chat "<title> (shared)". 30 an hour (`chat-share-copy:<user>`).
- Page `app/share/c/[token]/page.tsx`: server rendered, `noindex, nofollow`, Open Graph title, `force-dynamic` so a revoked link stops at once, `not-found.tsx` for unknown or revoked tokens. View in `components/share/`. Tool steps reuse `ToolSteps` (read-only, no Prism button).
- Footer "Continue this chat in Zenquanta": signed in, it copies and opens `/c/<id>`. Signed out, the copy call returns 401 and the card turns into a small create-account or sign-in form, then copies.
- Share dialog `components/chat/share-chat-dialog.tsx`, opened from "Share chat" in the chat title menu.

### Branch from here

- `POST /api/conversations/[id]/branch` with `{ messageId, before? }`. Copies the messages up to and including the message (or just before it with `before: true`) into a new chat with the same project, mode, custom assistant and session settings. New message ids, parent ids remapped, usage dropped, preview urls dropped, no memory summary, not pinned. A zq session becomes a web chat in the inbox. Title "<title> (branch)" without stacking. 60 an hour (`chat-branch:<user>`), 1,000 message cap, 409 while the message is still streaming.
- `forkedFrom: { conversationId, messageId, title }` lives in `session_settings` (no migration). `rowToConversation` exposes it as `Conversation.forkedFrom`.
- UI: user messages get a branch icon next to their time, replies get "Branch from here" in More. The new chat opens. `components/chat/branch-banner.tsx` shows "Branched from <title>" and links back while the source exists (checks the loaded list, then `GET /api/conversations/<id>?messageLimit=1`).

### Edit any message

- Earlier user messages get "Edit in a new branch". It branches with `before: true`, opens the branch and puts the original text in the composer. The latest message keeps "Save & rerun" as it was.
- No existing insert path fit. `prepareComposerDraft` calls `setCurrentMode`, which clears the custom assistant and PATCHes the chat it has in its closure (the old chat right after a switch). I added `prefillComposerText(content, mode)` to `lib/chat-context.tsx`. It only sets `composerDraftRequest`. If Lane A's prefill helper does the same, swap the one call in `components/chat/use-branch-actions.ts` and drop mine.

## Hot files touched

- `lib/chat-context.tsx`: `prefillComposerText` in the context type, next to `prepareComposerDraft`, and in the value and deps lists (14 lines).
- `components/chat/message.tsx`: `onBranch` and `onEditInBranch` props, one icon in the latest-user action row, a second row for earlier user messages, one More menu item, `hasMoreActions` includes branching.
- `components/chat/chat-area.tsx`: the hook, two stable callbacks, two props on `ChatMessage`, the banner above the content.
- `components/chat/header.tsx`: "Share chat" menu item behind the flag and the dialog mount.
- `lib/db/schema.ts`: new table after `zenTemplateShares`.
- Not on the list but shared: `types/index.ts` (share types after `TemplateCopyResult`, `ConversationFork` and `forkedFrom` on `ConversationSummary`), `lib/db/repositories/conversations.ts` (`forkedFrom` in `rowToConversation`, and the upsert keeps an existing `forkedFrom`), `lib/db/repositories/index.ts`, `lib/config/features.ts`.

## Decisions

- The share token is stored as is, not hashed like artifact shares. The snapshot it opens is in the same row, so a hash protects nothing, and keeping it lets the owner copy an old link again.
- Snapshots are frozen at creation. Later messages never leak, and deleting the chat removes its links (FK cascade). User purge needs no change because both FKs cascade, and adding the table to the purge batch would break purge until the migration is applied.
- The upsert in `upsertConversationHeader` merges the stored `forkedFrom` back into `session_settings`, because `/api/chat` and PATCH rebuild settings through `createSessionSettings`, which drops unknown keys. The SQL was checked by rendering it with drizzle offline, not against a database.
- The share page has its own small markdown renderer (`components/share/shared-markdown.tsx`) so the public page does not ship the chat context. Moving `renderContent` out of `message.tsx` into a shared module would remove the copy, but it means a large edit to a hot file.
- The visitor's copy drops custom assistants (they belong to the sharer), files and images, and appends the image placeholder to Prism replies.
- The signed-out path uses an inline form on the share page. The `?next=` param the template copy button writes is not read anywhere, so it would land on the landing page and lose the copy.

## Cut

- No public `GET /api/share/conversations/[token]` JSON route. The page reads the repository directly.
- No per-message times on the share page, to avoid server and browser time zone mismatch. The header has the share date.
- Attachments are not carried into a branch from "Edit in a new branch" (text only).

## Risks

- `ToolSteps` must keep rendering without `ChatProvider`. If Lane C adds artifact links that call `useChatContext` inside it, the share page breaks. Keep new behavior behind optional props.
- Lane A's saved drafts may restore an empty draft when the branch opens and overwrite the prefilled text. Check the order of their chat-switch effect against `composerDraftRequest`.
- Redaction is pattern based. A key in an unusual shape can get through. The dialog says it is a best effort.
- A copied chat brings the sharer's text and links into the visitor's context, so the fetch tool may open those links later.
- Branching loads the whole source chat (capped at 1,000 messages) and sharing loads up to 500.
- File knowledge chunks stay tied to the source chat id, so a branch only finds files through the project or attachments, not the source chat's scope.

## Needs a browser check

1. Apply the migration on a branch database, set `NEXT_PUBLIC_CHAT_SHARING=true`, open a chat, Share chat, check the counts with a fake `sk-` key in a message, create, copy, open in a private window, revoke, reload (404).
2. Shared page at 390 px: user bubbles, assistant names and colors, a tool step expanding, sources, a Prism reply placeholder, a zq session with the Terminal session label.
3. Continue signed out: create an account in the card, land in the copied chat. Signed in: one click copies and opens.
4. Branch from a user message and from a reply, check the banner links back, delete the source and check the banner text stops linking.
5. Send a message in a branch, reload, and check the banner is still there (the forkedFrom upsert).
6. Edit an earlier user message in a new branch: the composer has the text, the assistant and custom assistant did not change, send works.
7. Branch a zq session: it opens as a normal web chat with the composer.
