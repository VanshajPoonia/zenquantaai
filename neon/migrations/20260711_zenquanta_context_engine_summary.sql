-- Context Engine Phase 1: structured rolling conversation summary.
-- Adds columns consumed by the MEMORY_V2 path (lib/ai/memory-summary.ts).
-- Backward compatible: columns are nullable; the legacy regex/last-8 path
-- ignores them when MEMORY_V2 is disabled.

alter table public.zen_conversations
  add column if not exists memory_summary_structured jsonb;

alter table public.zen_conversations
  add column if not exists summarized_through_message_id text;
