# Lane A: the composer

Branch `flow/composer`. No new dependencies, no migrations, no server changes.

## What shipped

| Feature | How it works |
|---|---|
| Slash menu | `/` at the start of the draft opens a listbox: Your prompts (the ones the prompt library shows for this assistant), Playbooks (opens Playbook Studio on that playbook, where it runs), Tools (`/image`, `/research`, `/compare`, `/files`, `/artifacts`, `/memory`) and Chat (`/new`, `/export` when the chat has messages). It filters on the text after `/`, closes on space, Esc or blur, and only shows while the message box has focus. Up and Down move, Enter or Tab pick. |
| Arguments | `/compare <prompt>` puts the prompt in the composer and opens Model Duel with it. Picking `/compare` from the menu fills in `/compare ` so you type the prompt next. `/image <prompt>` sends it as an image. A bare `/image` turns on image mode. |
| Mentions | `@` at the start lists the six assistants and enabled custom assistants (handle is the name in lowercase with dashes, clashes with a built-in name are skipped). `@forge ` shows a "To Forge" chip above the text. On send the mention is stripped, the chat switches to Forge with `setCurrentMode` (the picker's path) and the message goes with `modeOverride`. Custom assistants use `setCurrentCustomAssistant` and pass `customAssistantId`. `@prism ` (typed, pasted or picked) turns on image mode and drops the mention. `@forge` alone plus Enter just switches. Unknown `@word` stays as text. Mention and `/compare`/`/image` sends skip the assistant suggestion dialog. |
| Visible queue | Queued messages for the open chat show above the composer with a preview, Edit, Remove and "Send now" on the first one. Edit takes it out of the queue and back into the composer (with its attachments, image mode, and an `@mention` if it was for another assistant). A message queued while a reply streams now leaves the composer at once. |
| Stop pauses | Stop pauses that chat's queue ("Queue paused" with Resume and Clear) instead of sending the next one. Other chats keep going. A pause ends once its queue is empty. "Send now" stops the reply in this chat and sends that one message; if the queue is paused, the rest stay paused. |
| Saved drafts | Text is saved to `localStorage` key `zq-draft:<conversationId>` or `zq-draft:new`, 300 ms after typing stops and on `pagehide`. It is restored when the chat opens, removed on send, capped at 20k characters, and cleared on sign out. Blocked or full storage means no draft. |
| Voice input | Mic button next to Send where `SpeechRecognition` or `webkitSpeechRecognition` exists, hidden elsewhere. Words show in the draft as they are heard, a second tap stops, the button turns red and pulses while listening, and screen readers hear "Listening". Errors get a short toast (blocked mic, no mic, no speech, no network). Sending or switching chats stops listening. |
| Honest picker | Plan-locked Intelligence levels are disabled (Radix sets `aria-disabled`), show a lock, and the menu ends with an "Upgrade" link to `/pricing` when any level is locked. If the saved level is locked, the button shows a lock too. Plan info is the `/api/dashboard` fetch the composer already made. |
| Model profile | It sets `sessionSettings.modelOverride`, the same field Intelligence sets, so it picks the model and not tone. It keeps its label and gets one line: "This picks the model. The Intelligence menu in the composer changes it too." Behavior is unchanged. |
| Hint | "Type / for commands and @ for assistants" under the composer on `sm` and up. It is the textarea's `aria-describedby` on every width. |

## Prefill helper for Lane D

```ts
import { prefillComposer } from '@/lib/chat/composer-prefill'

prefillComposer(text)
```

- Client only. Safe to call before the composer mounts: the text waits and the composer takes it on mount.
- Appends to an existing draft after a blank line, so a saved draft is never lost. Empty text is ignored.
- If you also open a new chat, calling `createNewChat()` first is fine. The prefill is applied after the draft for that chat is restored.
- `prepareComposerDraft` in the chat context still exists, but it calls `setCurrentMode`, which clears a custom assistant and can save a mode change to the server. Use `prefillComposer` for plain text.

## Files

New:
- `lib/chat/commands.ts`: shared workspace tool list, slash items, mention targets, parsing and ranking.
- `lib/chat/prompt-queue.ts`: pure queue reducer (enqueue, remove, dispatched, stop, resume, clear, send-now, reset).
- `lib/chat/draft-storage.ts`, `lib/chat/composer-prefill.ts`, `lib/chat/dictation.ts`.
- `hooks/useComposerDraft.ts`: save, restore and prefill.
- `components/chat/composer-command-menu.tsx`: `useComposerCommands`, the listbox and the mention chip.
- `components/chat/composer-queue.tsx`, `components/chat/voice-input-button.tsx`.
- Tests: `tests/composer-commands.test.ts`, `tests/prompt-queue.test.ts`, `tests/draft-storage.test.ts`, `tests/dictation.test.ts` (46 tests).

Hot files touched:
- `lib/chat-context.tsx`: `export` on `WorkspaceTool` and `QueuedPrompt`. `useReducer` queue in place of the `queuedPrompts` state (same name kept for the items). `stopStreaming` split into `abortActiveReply` plus a pause. Seven new context fields after `queuedPromptCount`. `runPromptWorkflow` now wraps the old body (renamed `runPromptWorkflowSteps`) to count active runs. The queue effect near the end. `signOut` clears drafts.
- `components/chat/composer.tsx`: three hooks after the refs, `markSubmitted`, the routed branch in `handleSubmit`, the first line of `handleKeyDown`, `restoreQueuedPrompt`, and small JSX additions (menu, chip, textarea props, queue panel, mic, hint). The old "n queued" text next to Stop is gone.
- `components/chat/composer-usage.tsx`: `IntelligencePicker` only.
- `components/chat/settings-panel.tsx`: one line under Model profile.
- `components/chat/chat-area.tsx`: one type line so `customAssistantId` reaches `sendMessage`.
- `components/chat/command-palette.tsx`: the ten "Open ..." items map over `WORKSPACE_TOOL_COMMANDS`. Labels and search words are unchanged.
- Not touched: `message.tsx`, `lib/db/schema.ts`.

## Decisions

- Playbooks do not ride the composer queue. `runPromptWorkflow` sends each step with `executeSendMessage` directly. Stop already ends a run (the step fails and the run is marked failed). What changed: queued messages now wait while a playbook runs, so they no longer land between two steps.
- A queued send now waits one tick (`setTimeout(0)`) and checks that no send is active. Before, a send right after Stop could start while the stopped reply was still cleaning up and its `finally` cleared the new reply's abort controller. A `queueTick` counter re-checks the queue when a queued send or playbook run settles, which also fixes a stall when the stopped reply came from the queue.
- An @mention switches the chat's assistant, like the picker, so follow-ups go to the same assistant. It is not a one-off handoff.
- The menu stays a plain listbox under the message box (not a Radix popover) so focus never leaves the textarea.

## Risks

- Leaving a streaming chat (Home, New chat) still aborts the reply without pausing, so that chat's queue sends in the background as before. Easy follow-up: dispatch `stop` there too.
- "Send now" stops a reply that already reached the provider, so that step may still be charged (per SECURITY_CHECKLIST).
- Model profile in settings can still pick a plan-locked model (for example Polished) and fail on send. I left behavior alone as asked.
- Drafts are plain text in this browser's `localStorage`. They clear on sign out but not when a session expires.
- Chrome's speech recognition sends audio to Google. The tooltip says the browser does the work, but it does not name the vendor.
- Typing while dictating gets overwritten by the next heard words.
- Attachments and image mode are not saved with drafts. Switching chats swaps the text but keeps attachments, as before.

## Check in a browser

1. At 390 px: the control row with + , picker, Image and Search chips, Intelligence, mic and Send fits without overflow. The queue panel and the menu fit above the keyboard.
2. Slash menu: `/`, `/res`, arrows, Enter, Tab, Esc, click and tap on iOS Safari and Android Chrome (tap must pick, not just close). Screen reader announces the active option.
3. `/compare why ...` opens Model Duel with the prompt. `/image a fox` makes an image. `/new` and `/export` work.
4. `@forge fix this` shows the chip, the reply comes from Forge and the picker shows Forge. `@prism ` turns on image mode. A custom assistant mention works.
5. Queue: queue two messages, Stop (queue pauses and nothing sends), Resume, Clear, Edit, Remove, Send now while streaming and while paused. Run a playbook and queue a message during it.
6. Drafts: type, reload, switch chats and back, send (the draft is gone after reload), first message in a new chat clears the composer and its attachments.
7. Mic in Chrome and Safari: allow, deny (short message), stop, send while listening. Hidden in Firefox.
8. Free plan: Best quality shows a lock, cannot be picked, Upgrade goes to `/pricing`.

## Checks

- `tsc --noEmit`: pass.
- `eslint .`: 0 errors, 1 warning (the existing one in `app/share/templates/[token]/copy-button.tsx`).
- `vitest run --maxWorkers=2`: 41 files, 227 tests pass (181 before).
