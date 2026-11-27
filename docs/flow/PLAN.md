# Zenquanta Flow (v1.1 web)

Planned on 2026-11-28, the day of the v1.0 code freeze. Flow is built on branch `feat/flow` and does not merge to `main` until after the 2026-12-01 launch.

## Status

Built on 2026-11-28. Everything in the four lanes below is on `feat/flow`. Typecheck, lint, 397 web tests, 27 zq tests and the production build pass.

Migrations 24 to 26 were applied to production Neon on 2026-11-28. The `feat/flow` preview has the Flow flags and `AGENT_LOOP=on` for that branch only. A browser run on that preview as the test account passed: sign in, manifest, slash menu, the To Forge chip, a draft surviving a reload, Personalization saving, a reply that followed About you on the agent path, the context meter, creating a share link, the shared page for a signed-out visitor at 390 px (noindex, no sideways scroll), a revoked link returning 404, Branch from here with its banner, the share target filling the composer, and the slash menu at 390 px. Edit in a new branch passed in a separate probe. Not checked: live zq sessions, approvals from the web and done notices, which need zq or a background tab.

To ship it:

1. After the launch, merge `feat/flow` to `main`. Expect doc conflicts in `NEEDS_YOU.md`, `AI_TASK_LOG.md` and `AI_CHECKLIST.md` with `release/zq-0.1.0`.
2. Set `NEXT_PUBLIC_CHAT_SHARING=true` and `CLI_APPROVALS=on` in production, then redeploy.
3. Check zq approvals with zq 0.1.1-beta.0 against production, then publish it.

## The problem

Zenquanta already has a lot: six assistants, projects, files, memory, playbooks, Model Duel, Prism Studio, Pulse Research Room, Artifact Studio, a terminal agent and more. A new user meets most of it through separate menus and studios. Some basics people expect from other AI apps are missing or clunky:

- Nothing can be reached by typing. Prompts and playbooks hide in the + menu.
- Edits are destructive and work only on the last message. Nothing can be branched or shared.
- Queued messages are a number you cannot see or cancel. Stop then sends the next one anyway.
- Project descriptions never reach the model. There are no "about you" instructions.
- The 8-message window and the rolling summary are invisible.
- zq sessions on the web are not live. A permission prompt can only be answered at the terminal.
- On a phone the app cannot receive a shared link and never says a reply is done.

## The idea

Make the composer the center of the product and stop losing work. Everything is one keystroke away from where the user already types. Every answer can be branched, continued or shared. The terminal and the phone feel like one product.

Inspiration came from pi (session tree, fork, steer and follow-up queue, prompt templates, compaction) and opencode (commands, plan and build, approvals, pairing). We copy the ideas, not the code.

## What Flow ships

### Lane A: the composer

| Feature | What the user does |
|---|---|
| Slash menu | Types `/` to reach saved prompts, playbooks, tools (image, research, compare, files, artifacts, memory) and chat actions |
| Assistant mentions | Starts a message with `@forge` or `@pulse` to send it to that assistant. `@prism` switches to an image |
| Visible queue | Sees queued messages above the composer. Can edit, remove or send one now. Stop pauses the queue instead of sending the next message |
| Saved drafts | A half-written message survives a reload or a switch to another chat |
| Voice input | Taps the mic to dictate where the browser supports it |
| Honest picker | Locked intelligence options are shown as locked with a link to plans. They no longer fail on send |

### Lane B: share and branch

| Feature | What the user does |
|---|---|
| Share a chat | Gets a read-only link to a snapshot of the chat. Things that look like keys or tokens are hidden before it is shared. Links can be revoked |
| Continue a shared chat | A visitor opens the link and copies the chat into their own workspace after signing up |
| Branch from here | Starts a new chat from any message. The original stays as it was |
| Edit any message | Edits an earlier message in a new branch instead of deleting what came after |

### Lane C: instructions and context

| Feature | What the user does |
|---|---|
| About you | Tells Zenquanta who they are and how it should answer, once, for every assistant |
| Project instructions | Writes instructions on a project that every chat in it follows |
| Context meter | Sees how full the conversation is and what the model actually receives |
| Fresh start | Starts a new chat that carries a summary of the old one |
| Artifact links | Opens an artifact straight from the tool card that saved it |

### Lane D: terminal and phone

| Feature | What the user does |
|---|---|
| Live zq sessions | Watches a running zq session update on the web |
| Approvals from the web | Approves or denies a zq permission prompt from the web or a phone. Off unless turned on in zq |
| Share to Zenquanta | Shares a link or text from a phone's share sheet into a new chat |
| App shortcuts | Long-presses the app icon for New chat, Research and Make an image |
| Done notices | Gets a notice when a reply finishes in a background tab |

## What waits

| Idea | Why it waits |
|---|---|
| Reply versions with a switcher (`< 1/3 >`) | Needs a message tree in the schema. Branching covers the need for now |
| A visual branch map like pi's `/tree` | Builds on branching once people use it |
| Steering a running agent mid-step | The web loop runs inside one request. "Send now" covers most of it |
| Routines (scheduled playbooks) | Needs background runs and cron, and Neon compute is the binding limit |
| Pair a phone with zq by QR code | Builds on approvals from the web |
| Undo for zq file changes | Needs git checkpoints in zq |
| Light theme | Large styling change with low launch value |

## Rules for Flow work

- No new dependencies without a yes from the owner.
- Migrations are written but not applied. The local env and production share one Neon database.
- Nothing writes to the production database during development. No paid model calls.
- zq changes bump the version but are not published.
- UI copy follows `PRODUCT.md`: plain words, no em dashes, honest about limits.
- New behavior that needs a migration stays off until the migration is applied.
