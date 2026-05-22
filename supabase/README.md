# Historical Supabase Migrations

The SQL files in `supabase/migrations/` are retained for historical reference only.

They are not part of the active Zenquanta AI setup. The current runtime uses:

- Neon Postgres for app data and credentials auth
- neutral private file storage for uploads and generated images
- OpenRouter for AI transport
- manual plan requests and admin activation for upgrades

Do not run these migrations for the fresh Neon setup, and do not use them to import,
copy, backfill, or preserve old Supabase rows or storage objects.

