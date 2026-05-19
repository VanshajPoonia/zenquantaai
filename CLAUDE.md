@AGENTS.md

# CLAUDE.md

Claude Code should use the same shared workflow as Codex. Before review, planning, architecture checks, risk analysis, bug finding, or implementation work, read `AGENTS.md`, `AI_PROJECT.md`, `AI_TASK_LOG.md`, `AI_DECISIONS.md`, and `AI_CHECKLIST.md`.

## Default Claude Code Role

Claude Code's default role in this repository is:

- reviewer
- architecture checker
- planning assistant
- risk finder
- bug finder

Claude Code should normally inspect recent work, identify risks, and produce actionable review notes or implementation prompts for Codex.

## When Claude Code May Implement

Claude Code may act as the coding agent only when:

- Codex is unavailable
- Codex is out of tokens
- the user explicitly asks Claude to implement directly

When Claude Code acts as the coding agent, it must:

- follow `AGENTS.md`
- read `AI_PROJECT.md`, `AI_TASK_LOG.md`, `AI_DECISIONS.md`, and `AI_CHECKLIST.md`
- make minimal focused changes
- avoid unrelated refactors
- preserve existing architecture unless a documented reason exists
- update `AI_TASK_LOG.md` after implementation work
- update `AI_DECISIONS.md` only if architecture decisions change
- update `AI_CHECKLIST.md` only if commands, setup, dependencies, or workflow change
- update `AI_PROJECT.md` only if project scope, features, or structure change

