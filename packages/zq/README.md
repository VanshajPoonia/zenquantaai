# zq

Zenquanta Forge in your terminal. zq reads, edits and runs code in your project, with your Zenquanta account, plan and history.

zq is built on [pi](https://pi.dev), the MIT-licensed agent harness by Mario Zechner, now developed at Earendil. pi provides the terminal UI, tools, sessions and compaction. zq adds Zenquanta sign-in, models, permission prompts and session sync.

## Install

zq needs Node.js 22.19 or newer.

```sh
npm install -g zenquanta
zq login
```

`zq login` opens your browser. Approve the code it shows and you are signed in.

## Models

zq uses Zenquanta's hosted Forge models on your plan when they are open for your account. Until then, it runs on your own OpenRouter key:

```sh
zq key sk-or-...      # saved in ~/.zq/credentials.json, never sent to Zenquanta
zq key --clear        # remove it
```

With your own key, model calls go straight from your computer to OpenRouter and bill your OpenRouter account. Sign-in and session sync still use your Zenquanta account.

## Use

```sh
cd your-project
zq                      # start a session
zq -c                   # continue the last session in this folder
zq -r                   # pick a session to resume
zq -p "fix the failing test" --allow-edits   # run once and print the answer
```

Inside a session:

| Command | What it does |
|---|---|
| `/usage` | Your plan, tokens left and agent steps left today |
| `/sync on`, `/sync off` | Turn web sync on or off for this project |
| `/permissions` | Show the permission mode and always-allowed commands |
| `/model` | Pick a model: `forge`, `forge-fast`, `forge-lite`, or `forge-best` on Pro and up |

## Permissions

By default zq asks before it edits a file or runs a shell command. Reads inside your project run without asking.

| Mode | Edits | Shell commands |
|---|---|---|
| `ask` (default) | ask | ask, unless always allowed |
| `edits` (`--allow-edits`) | allowed | ask, unless always allowed |
| `yolo` (`--yolo`) | allowed | allowed |

zq always asks before it touches `.env` files, keys, `.git`, files outside the project, or runs risky commands like `sudo`, `rm -rf` or `git push --force`, unless you pass `--yolo`. In print mode, anything that needs approval is blocked.

Set the default mode with `"permissionMode": "ask" | "edits" | "yolo"` in `~/.zq/settings.json`.

## Sync

Sessions show up in your Zenquanta history under Forge, so you can read them on the web. Tool output is cut to 4 KB and output from protected files is never sent. Turn it off with `/sync off`, or with `{ "sync": false }` in `.zq/settings.json` in a project.

## Sign out

```sh
zq logout
```

This revokes the token on the server and deletes it from `~/.zq/credentials.json`. You can also revoke tokens in Zenquanta Settings.

## Credits

zq is built on pi (`@earendil-works/pi-coding-agent`), MIT License, Copyright (c) 2025 Mario Zechner. See NOTICE.
