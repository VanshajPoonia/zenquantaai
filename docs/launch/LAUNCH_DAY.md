# Launch day runbook

For Gate D on Monday 2026-11-30 and the launch on Tuesday 2026-12-01. Written 2026-11-28 after the bug bash. Production is `https://zqai.vanshajpoonia.com` (also `https://zqai.vercel.app`).

## State on 2026-11-28

- Public and signed-in smoke suites pass on production (30 of 30), including a real streamed reply.
- Bug bash fix shipped: lists asked for without `?limit=` returned one item, so the sidebar showed only the newest chat after a reload (`d0ab938`).
- OpenRouter: the production key (`zqainew`, ends 740) has a $50 monthly limit. The low-balance email fires below $5. **The account balance was $8.83.**
- Production flags: `AGENT_LOOP=admins`. `NEXT_PUBLIC_ZQ_RELEASED` is not set. `ZQ_MODEL_API` stays off (zq runs on each user's own OpenRouter key).
- npm: `zenquanta` `latest` and `beta` point to `0.1.0-beta.3`. This branch bumps zq to `0.1.0`.
- Test account `zq-bugbash-084244` (Free, not admin) is in `.env.local` as `SMOKE_LOGIN_ID` and `SMOKE_PASSWORD`. Purge it after launch.

## Gate D, Monday morning

1. Smoke suites against production:

   ```bash
   SMOKE_CHAT=1 PLAYWRIGHT_BASE_URL=https://zqai.vercel.app \
     pnpm exec playwright test tests/e2e/smoke.spec.ts tests/e2e/signed-in.spec.ts --workers=2
   ```

   The signed-in suite reads `SMOKE_LOGIN_ID` and `SMOKE_PASSWORD` from the environment.
2. No open item in `SECURITY_CHECKLIST.md` and nothing new in Vercel error logs.
3. Costs in range in `/admin` (filter by surface). Top up OpenRouter so the balance covers launch week.

If any of these fail, move the launch by up to 3 days. Do not ship a known security issue.

## Switch on, Monday afternoon

1. Merge this branch: `git checkout main && git merge --ff-only origin/release/zq-0.1.0 && git push`.
2. Owner publishes zq from a terminal with the passkey: `cd packages/zq && npm publish`. `prepublishOnly` runs typecheck, tests and the build. Then check `npm view zenquanta dist-tags`: `latest` should be `0.1.0`.
3. Production env on Vercel: set `AGENT_LOOP=on` (from `admins`) and add `NEXT_PUBLIC_ZQ_RELEASED=true`. Then `vercel redeploy https://zqai.vercel.app --target production`.
4. Check as the test account: a Pulse turn shows a web search card, Settings shows the Terminal tab, the landing page and `/pricing` mention zq, and `/docs/cli` installs with `npm i -g zenquanta`.
5. Rerun the smoke suites.
6. Queue the launch posts in Postroom.

## Launch day

- Every few hours: Vercel errors, new accounts in `/admin`, OpenRouter spend and balance.
- The $50 monthly key limit stops all AI replies when reached. Raise it on openrouter.ai if real use gets close.

## Roll back

- Agent problems: set `AGENT_LOOP=admins` and redeploy production. Chat falls back to the plain path.
- zq problems: unset `NEXT_PUBLIC_ZQ_RELEASED` and redeploy, then `npm deprecate zenquanta@0.1.0 "<reason>"` and point `latest` back to `0.1.0-beta.3`.

## After launch

- Purge `zq-bugbash-084244` with the admin purge.
- Decide on Free sign-up checks after a week of numbers (`NEEDS_YOU.md` item 4).
- Flow: `docs/flow/PLAN.md`. Its migrations are already applied.
