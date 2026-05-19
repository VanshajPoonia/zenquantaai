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

## Normal Claude Code Usage

Examples:

- Review the latest completed work.
- Check the current architecture and identify risks.
- Act as the coding agent because Codex is unavailable.
- Create a Codex prompt to fix the highest-priority issues.

## Review Priorities

When reviewing, prioritize:

- security and secret exposure risks
- usage-limit and billing correctness
- model-routing correctness
- data persistence and conversation integrity
- auth/session correctness
- regressions in the existing chat UI
- missed updates to shared workflow docs

## Handoff Expectations

If Claude Code reviews or plans work without changing files, it should produce concise findings and recommended next actions. If it changes files, it must update `AI_TASK_LOG.md` before handing off.
