# Spec 03: `zq`, Forge in the Terminal

Lane B. Days 1 to 11. npm package `zenquanta`, command `zq`.

## Goal

A developer installs `zq`, signs in once and asks Forge to work on a repo. Forge reads, edits and runs code with permission prompts. Sessions resume locally and show up in the Zenquanta web history.

## Shape

`zq` is a thin wrapper. It calls pi's exported `main` with our extension preloaded. Pi provides the terminal UI, tools (read, write, edit, bash), sessions, compaction and print mode. We provide everything Zenquanta-specific.

Location: `packages/zq` in this repo, with a `pnpm-workspace.yaml` listing `packages/*`. The root Next.js app stays at the root, so the Vercel build does not change. `packages/zq` gets its own `package.json`, `tsconfig.json` and build (plain `tsc` to ESM). Its `engines` field is `"node": ">=22.19.0"`.

Pin `@earendil-works/pi-coding-agent` to an exact version (1.5.2 at planning time).

## Day 1 spike

1. A script calls pi's `main` with an inline extension.
2. The extension registers a provider pointing at a local OpenAI-compatible endpoint.
3. It blocks one `tool_call` with `{ block: true, reason }` after `ctx.ui.confirm`.
4. Check whether `MainOptions` can set the app name, the agent directory and the session directory. If not, set them through pi's environment variables (`PI_CODING_AGENT_SESSION_DIR`, and the agent directory variable named in pi's `configuration.md`).

Pass: the TUI runs, uses our provider and shows our confirm prompt.

## Files and folders on the user's machine

| Path | What |
|---|---|
| `~/.zq/credentials.json` | Token and app URL, file mode 0600 |
| `~/.zq/settings.json` | Permission mode, allowed commands, sync on or off |
| `~/.zq/sessions/` | Pi session files |
| `.zq/settings.json` in a repo | Per-project overrides, such as `"sync": false` |

`zq` keeps its own directories so it never mixes with a user's own pi setup.

## The extension

### Provider

`pi.registerProvider('zenquanta', ...)` with the OpenAI-compatible API, base URL `<app>/api/v1`, the token from `credentials.json` and the models from `GET /api/v1/models`. Default model `forge`. Send `x-zq-session-id` and `x-zq-run-id` headers.

### Commands

| Command | What |
|---|---|
| `zq login` and `/login` | Device login (spec 02) |
| `zq logout` and `/logout` | Delete the local token and revoke it on the server |
| `/usage` | Plan, wallet left, agent steps left today |
| `/sync on` and `/sync off` | Session sync for this project |
| `/permissions` | Show the mode and the allowed commands |

If there is no token, `zq` starts the login flow before the TUI opens.

### Permissions

Pi has no permission system, so this is required.

| Mode | Reads, `ls`, `find`, `grep` | Edits and writes | Shell commands |
|---|---|---|---|
| `ask` (default) | allowed | ask, showing the path and a short diff | ask, unless allowed |
| `edits` | allowed | allowed | ask, unless allowed |
| `yolo` (`--yolo`, prints a warning) | allowed | allowed | allowed |

- Hook `tool_call`. Return `{ block: true, reason }` when the user says no.
- The prompt offers "Yes", "Yes, always for this command" (saved to `allowedCommands`) and "No".
- Always ask, in every mode except `yolo`: reading or writing `.env*`, `*.pem`, `*.key`, `id_*`, anything under `.git/`, paths outside the project folder, and commands with `sudo`, `rm -rf`, `git push --force` or `curl | sh` patterns.
- Print mode (`zq -p`) has no UI (`ctx.hasUI` is false). Edits and shell commands are blocked unless `--allow-edits` or `--yolo` is passed.

### Session sync

- Listen to session events. On every `message_end` and tool result, queue an entry.
- Send batches to `POST /api/cli/sessions/:id/entries` every few seconds and on exit. The first batch creates the conversation with `surface = 'cli'`, mode `code` and `workspace` (repo folder name and git branch, never the full path).
- Truncate tool output to 4 KB. Never send content from files matching the protected patterns above.
- Sync failures never block or slow the agent. Unsent batches wait in `~/.zq/outbox/` and retry next time.
- `"sync": false` in `~/.zq/settings.json` or the project's `.zq/settings.json` turns it off.

Server routes (Lane B, Day 7):

- `POST /api/cli/sessions` creates or finds the conversation for a pi session id.
- `POST /api/cli/sessions/:id/entries` appends messages with `parts`. Idempotent by entry id.
- Both use `requireApiTokenUser(request, 'cli')`.

### Branding

- On start, print "Zenquanta Forge" with the plan and the model. Credit pi in `zq --version` and in the package README.
- Keep pi's LICENSE notice in the package.

## Local resume

Pi gives this: `zq -c` continues the last session in this folder, `zq -r` opens the picker and `/tree`, `/fork` and `/clone` branch. We document these. Resuming on another device is v1.1.

## Web view of CLI sessions (Day 8)

- CLI conversations appear in the sidebar under Forge with a terminal badge and the repo name.
- They open read-only. The composer shows "Continue in your terminal" with the `zq -r` hint.
- Tool steps render with the same cards as spec 01.

## Release

- `zenquanta@0.1.0-beta.1` on Day 11 and `zenquanta@0.1.0` on Day 14, both after the user says yes and names the npm account.
- Install: `npm i -g zenquanta`. The README states the Node 22.19 requirement first.

## Tests

- Unit: permission decisions for each mode and protected path, command allowlist matching, outbox retry, settings merge.
- Manual: a fresh machine with Node 22 goes from install to a fixed bug in a sample repo, with prompts, in under 5 minutes. The session appears on the web.

## Done when

- `zq login`, a task with edits and a shell command, `zq -c` and `/usage` work against production.
- A blocked action never runs.
- The session shows on the web with its tool steps.
