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

Deferred authenticated coverage:

- Main authenticated workspace rendering.
- Command palette open.
- Global search empty state.
- Project/search/artifact/playbook authenticated flows.

Zenquanta sessions use opaque Neon-backed cookies, so authenticated E2E should use a future seeded test database/session fixture. Do not hardcode production credentials, use real API keys, or weaken auth security for tests.
