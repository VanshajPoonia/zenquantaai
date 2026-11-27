# Lane D notes: terminal and phone

Branch `flow/terminal`. Built on 2026-11-28 against the Flow plan in `docs/flow/PLAN.md`.

## What shipped

| Feature | State |
|---|---|
| Live zq sessions | Built. Polls only while the tab is visible and the session changed in the last 2 minutes |
| Approvals from the web | Built in full. zq side is opt-in with `/remote on`. Server side sits behind `CLI_APPROVALS` |
| Share to Zenquanta | Built. GET share target, `/share-target` redirect, launch params hook |
| App shortcuts | Built. New chat, Research with Pulse, Make an image |
| Done notices | Built. Title count everywhere, browser notice on desktop only |

## The approvals finding

pi 1.5.2 can close a pending prompt from outside through a public, documented option. `ctx.ui.select(title, options, { signal })` takes an `AbortSignal`. When it aborts, the dialog closes and the promise resolves with `undefined`. The interactive mode (`showExtensionSelector` in `dist/modes/interactive/interactive-mode.js`) and the RPC mode both honor it. `docs/extensions.md` documents it under "Manual Dismissal with AbortSignal". `confirm` and `input` take the same option, and there is also a `timeout` option with a countdown.

So nothing is monkeypatched. zq opens the normal terminal prompt with a signal and polls the web at the same time. If the web answers first, zq aborts the dialog. If the terminal answers first, zq stops polling and closes the web approval.

## How approvals work

1. The user runs `/remote on` in zq. It is saved in `~/.zq/settings.json` as `remoteApprovals: true`. A repo's `.zq/settings.json` cannot turn it on. Sync must be on too, since the web shows the card inside the synced session.
2. On a permission prompt zq flushes sync, then `POST /api/cli/approvals` with the session id, tool, title and the exact detail. The server refuses titles over 200 characters and details over 4,000 rather than cut a command. zq keeps such prompts in the terminal.
3. zq races the terminal prompt against `GET /api/cli/approvals/[id]` every 2 s (`packages/zq/src/remote-approvals.ts`).
   - Web approved: the action runs once. Web denied: it is blocked. The terminal dialog closes either way and zq prints which side answered.
   - Terminal answered first: zq sends `PATCH answered_locally`. This also covers an approval created after the terminal already answered.
   - The agent run was stopped: zq sends `PATCH expired`. Nothing is approved.
   - Server says expired or answered_locally: zq leaves the terminal prompt open.
   - Create fails, or 3 polls in a row fail: zq warns once and the terminal prompt stays. A 404 reads as "not open yet".
4. The web polls `GET /api/approvals` every 5 s. Only while the tab is visible, the user has a zq session in the list and one synced in the last 10 minutes, or something is pending. `POST /api/approvals/[id]/decide` takes `approve` or `deny` only. There is no "always allow" from the web.
5. The card shows the tool, the title, the exact detail in a `pre` block (React escapes it, whitespace is kept), Approve once, Deny and the time left. The time left uses the server clock offset. Sidebar rows get an amber dot. A notice at the top points to the waiting session from anywhere else, since the sidebar is closed on phones.

## Migration

`neon/migrations/20261201_zenquanta_cli_approvals.sql`, not applied. It creates `zen_cli_approvals` with checks on title length, detail length and status, and an index on `(user_id, status, expires_at)`. Rows cascade with the user and with the token. `lib/db/schema.ts` has the matching `zenCliApprovals`.

To turn it on: apply the migration, then set `CLI_APPROVALS=on`. Until then the zq routes return 404, the web list says `enabled: false` and stops polling, and purge skips the table. With the flag on, purge also deletes the user's approvals. Each create also deletes the user's approvals older than a day, since rows hold exact commands.

## Decisions

- The `after` cursor went on the cookie route `GET /api/conversations/[id]/messages`, not the bearer entries route. The web cannot use a bearer route, and the conversation id is what the web knows. It is inclusive (`created_at >= after`) because zq rewrites a running turn under one id. The response adds `updatedAt` and `serverNow`, so the client ages the session on the server clock. Live polls skip the profile sync to save queries.
- `parseLimit` on that route returned 1 when no limit was passed (`Number(null)` is 0). Fixed to the intended 80. The app always passed a limit, so nothing visible changes.
- No same-origin helper existed. I added `lib/security/same-origin.ts` and use it on the decide route only. Cookies are already `SameSite=Lax` and the body is JSON, so this is a third layer.
- Launch params run in two steps: start a new chat, then fill the composer once the new chat is open. `setCurrentMode` would otherwise patch the previous chat's mode through a stale closure. It uses the existing `prepareComposerDraft` path that Prism Studio and Pulse Research Room use. If Lane A's prefill helper replaces it, swap the one call in `hooks/use-launch-params.ts`.
- The auth flow has no `next` param. Sign-in and sign-up on `/` happen in place, so `?prompt=` stays in the address and runs after sign-in.
- Done notices: the "(n) Zenquanta AI" title shows for everyone. The browser notice needs the toggle. The toggle shows on desktop browsers only. Android Chrome throws on `new Notification()` without a service worker, and iPhone needs push. No service worker was added, per spec 04.
- zq version is `0.1.1-beta.0`, not published. `app/docs/cli/page.tsx` does not mention `/remote` yet, since the published zq does not have it. Add a row once 0.1.1 is on npm. The zq README also needs a line then.

## Files

New:
- `lib/cli/live-session.ts`, `hooks/use-live-cli-session.ts`, `components/chat/terminal-session-footer.tsx`
- `lib/cli/approvals.ts` (browser safe), `lib/cli/approval-requests.ts` (server parsing), `lib/security/same-origin.ts`
- `lib/db/repositories/cli-approvals.ts`, `neon/migrations/20261201_zenquanta_cli_approvals.sql`
- `app/api/cli/approvals/route.ts`, `app/api/cli/approvals/[id]/route.ts`, `app/api/approvals/route.ts`, `app/api/approvals/[id]/decide/route.ts`
- `hooks/use-cli-approvals.ts`, `components/chat/terminal-approvals.tsx`, `components/chat/terminal-session-badge.tsx`, `components/chat/terminal-and-phone.tsx`
- `lib/pwa/launch-params.ts`, `hooks/use-launch-params.ts`, `app/share-target/route.ts`
- `lib/pwa/done-notices.ts`, `hooks/use-done-notices.ts`, `components/chat/done-notices-item.tsx`
- `packages/zq/src/remote-approvals.ts` and its test
- Tests: `conversation-messages-after`, `live-cli-session`, `cli-approvals`, `cli-approvals-routes`, `web-approvals-routes`, `pwa-launch`, `done-notices`

Hot files, all small:
- `lib/chat-context.tsx`: 2 imports, `applyLiveMessages` in the type, the callback right after `loadOlderMessages`, and 2 lines in the value object and its deps.
- `components/chat/chat-area.tsx`: 1 import. The zq footer block is now `<TerminalSessionFooter chat={currentChat} />`.
- `components/chat/sidebar.tsx`: in `ChatItem` the terminal icon is now `<TerminalSessionBadge chat={chat} />`. `<DoneNoticesItem />` sits after `<InstallAppItem />`. The `SquareTerminal` import moved into the badge.
- `lib/db/schema.ts`: `zenCliApprovals` right after `zenDeviceCodes`.
- `components/chat/composer.tsx`: untouched.

Other shared files: `types/index.ts` (one interface after `ConversationMessagesPageResponse`), `lib/db/repositories/index.ts` (2 export lines), `lib/db/repositories/conversations.ts` (`listMessagesAfter`), `lib/db/repositories/user-purge.ts`, `lib/agent/flags.ts`, `components/chat/chat-layout.tsx` (mounts `TerminalAndPhone` in the deep link `Suspense`), `app/manifest.ts`, `app/api/conversations/[id]/messages/route.ts`, `packages/zq/src/config.ts`, `packages/zq/src/extension.ts`, `packages/zq/package.json`.

## Checks run

- `tsc --noEmit`: clean.
- `eslint .`: 0 errors, 1 warning (the existing one in `app/share/templates/[token]/copy-button.tsx`).
- Web vitest: 233 passed (181 before).
- zq `tsc -p tsconfig.json --noEmit`: clean. zq vitest: 27 passed (18 before). The new zq test file was also typechecked on its own, since zq's tsconfig excludes tests.

## Risks

- Every poll also writes a rate limit row in Neon. The live poll runs at most 2 minutes past the last change. The approvals poll runs at most 10 minutes past the last zq sync, per visible tab. Neon compute is the binding limit, so watch it after turning `CLI_APPROVALS` on.
- If zq quits while a prompt is open, its PATCH may not finish. The web then shows the card until it expires, and an answer there does nothing. The card says the terminal is asking too.
- If the terminal and the web answer within the same 2 s poll, the terminal answer is used even if the row says approved or denied.
- The web can approve risky commands (`sudo`, `rm -rf`) once, the same as the terminal. Consider keeping those terminal-only if that feels too loose.
- A zq session started after the page loaded is not in the sidebar until a reload. The approvals poll still finds its prompts, and the notice opens the session.
- Live status uses the browser clock only for the first "is it worth checking" guess (10 minutes). Live or not is decided on the server clock.
- `share_target` works on Android Chrome and desktop Chrome or Edge installs. iPhone Safari has no share target. Shortcuts need an installed app.

## Needs a browser or terminal check

1. Apply the migration on a preview branch database, set `CLI_APPROVALS=on` there, then run zq against the preview with `ZQ_APP_URL`.
2. In zq: `/remote on`, ask Forge to run a command. The prompt shows in the terminal and the card shows in the web session. Approve once on the web: the terminal dialog closes and the command runs. Repeat with Deny. Repeat answering in the terminal: the web card goes away within 5 s.
3. Wait 10 minutes on a prompt: the card says Expired, the terminal prompt stays and nothing runs.
4. Turn the preview offline mid-prompt: zq warns once and the terminal prompt still works.
5. Watch a running zq session on the web: the Live pill shows and entries arrive within about 3 s. Two minutes after zq goes quiet the line reads "Last update N min ago".
6. On a 390 px phone: the approval card, the long command wrapping inside the code block, the top notice and its Open button.
7. Install the app on Android Chrome. Share a link from another app to Zenquanta: a new chat opens with the link in the composer, not sent. Long-press the icon for the three shortcuts. Signed out, share a link, sign in on the landing page and check the draft appears.
8. Desktop Chrome: turn on "Notify me when replies finish", send a long prompt, switch tabs. A notice "Forge finished: ..." shows and the tab title reads "(1) Zenquanta AI" until you come back. Block notices in site settings and check the menu says so.
9. Chrome DevTools Application panel: the manifest shows the share target and shortcuts with no errors.
