# Zenquanta AI E2E Smoke Tests

This first Playwright suite covers service-free route and form rendering smoke tests.

Current scope:

- Unauthenticated auth gate rendering.
- Sign-in and sign-up form rendering.
- Protected dashboard, pricing, and admin route redirects for users without a session.
- Public assistant page rendering for Nova, Velora, Axiom, Forge, Pulse, and Prism.

Deferred authenticated coverage:

- Main authenticated workspace rendering.
- Command palette open.
- Global search empty state.
- Project/search/artifact/playbook authenticated flows.

Zenquanta sessions use opaque Neon-backed cookies, so authenticated E2E should use a future seeded test database/session fixture. Do not hardcode production credentials, use real API keys, or weaken auth security for tests.
