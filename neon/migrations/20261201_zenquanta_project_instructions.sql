-- Zenquanta Flow: per-project instructions that every chat in the project reads.
-- Additive only. Run before deploying the code that selects this column,
-- because Drizzle selects every column in the schema.

alter table public.zen_projects
  add column if not exists instructions text;
