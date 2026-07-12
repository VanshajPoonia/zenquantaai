import { DEFAULT_PROJECT_ID } from '@/lib/config'

// Context Engine Phase 3 — durable-memory scope resolution. Pure and
// framework-free so both the write gate and the read path share one rule, and
// so it stays unit-testable. See AI_CONTEXT_ENGINE.md §4.2.
//
// The default inbox is the user's *global* memory bucket: a fact learned there
// is meant to be available in every chat ("all chats refer to each other"), so
// it maps to a null project scope. Real projects keep their id, which isolates
// their memories to that project (globals still surface inside a project).

export function resolveMemoryProjectScope(
  projectId: string | null | undefined
): string | null {
  if (!projectId || projectId === DEFAULT_PROJECT_ID) return null
  return projectId
}
