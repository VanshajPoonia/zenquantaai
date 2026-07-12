-- Context Engine Phase 4 (CROSS_CHAT_RECALL): embed each conversation's rolling
-- summary so other conversations can recall it — "what did I tell Nova about X"
-- answered inside Forge. Additive and safe to drop; raw messages and the text
-- summary remain the source of truth. Run before enabling CROSS_CHAT_RECALL.
-- See AI_CONTEXT_ENGINE.md §5.

create extension if not exists vector;

alter table public.zen_conversations
  add column if not exists summary_embedding vector(1536);

create index if not exists zen_conversations_summary_embedding_hnsw_idx
  on public.zen_conversations using hnsw (summary_embedding vector_cosine_ops);
