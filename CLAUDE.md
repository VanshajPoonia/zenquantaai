@AGENTS.md

# Claude Code Notes

Claude Code should use the same shared project memory as Codex:

- `AGENTS.md`
- `AI_PROJECT.md`
- `AI_TASK_LOG.md`
- `AI_DECISIONS.md`
- `AI_CHECKLIST.md`

## Default Role

Claude Code's default role on this repository is:

- reviewer
- architecture checker
- planning assistant
- risk finder

Claude Code may act as a fallback coding agent only when Codex is unavailable, out of tokens, or explicitly asked to implement.

## Working Rules

- Follow `AGENTS.md` first.
- Use current repo facts only.
- Do not treat this as the old four-mode app.
- Do not modify application behavior during review/planning tasks.
- Prefer findings with file references, concrete risks, and practical next steps.
- When asked to implement, update the shared memory files when the change affects project state, architecture decisions, setup, or handoff context.
