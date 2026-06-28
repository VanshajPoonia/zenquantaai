# Zenquanta AI E2E Smoke Tests

This first Playwright suite covers service-free route and form rendering smoke tests. It starts a local Next dev server on `127.0.0.1:3100` with webpack unless `PLAYWRIGHT_BASE_URL` is set.

Current scope:

- Unauthenticated auth gate rendering.
- Sign-in and sign-up form rendering.
- Protected dashboard, pricing, and admin route redirects for users without a session.
- Public assistant page rendering for Nova, Velora, Axiom, Forge, Pulse, and Prism.

Runtime dependencies:

- These tests do not require `.env.local` secrets, OpenRouter, Tavily, Neon seed data, S3/R2, GitHub, Supabase, Stripe, production credentials, or external services.
- Do not copy local secret values into Playwright config, tests, traces, screenshots, or docs.

Authenticated purge coverage:

- `user-purge.spec.ts` signs up disposable users through the real auth route,
  seeds all current purge categories in Neon, uploads real objects through the
  neutral storage route, then verifies workspace deletion, full-account sign-out,
  admin purge, cross-user denial, protected URL behavior, tombstoning, object
  removal, safe payloads, audit rows, and an unaffected control user.
- It is destructive and skips unless all safety gates are satisfied:

```bash
PURGE_E2E_CONFIRM=dedicated-neon-branch \
PURGE_E2E_DATABASE_URL='<empty/schema-only test branch URL>' \
PURGE_E2E_STORAGE_DIR=/tmp/zenquanta-purge-e2e \
npm run test:e2e -- user-purge.spec.ts
```

- Apply all 19 migrations to that branch first. Never use the ordinary
  `.env.local` database, production credentials, or a production bucket. The
  Playwright server forces the local neutral-storage provider and test bucket
  while the guard is active.

Deferred authenticated coverage outside purge:

- Main authenticated workspace rendering.
- Command palette open.
- Global search empty state.
- Project/search/artifact/playbook authenticated flows.

Zenquanta sessions use opaque Neon-backed cookies. Do not hardcode production
credentials, use real API keys, or weaken auth security for tests.
