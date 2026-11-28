# Terms and privacy review

Checked on 2026-11-28 against the code on `main`. This compares the pages with what the product does. It is not legal advice.

## Checked and accurate

- Passwords are salted and hashed. zq tokens are stored as hashes and expire after 90 days.
- Rate limit records hash IP addresses and tokens before they are stored (`lib/security/rate-limit.ts`).
- Vercel Analytics is installed (`app/layout.tsx`), as the cookie section says.
- zq sync cuts tool output to 4 KB and never sends output from protected files.
- Delete workspace data, delete account and revoke zq sign-ins all exist in Settings.

## Wrong before launch

1. **zq runs on the user's own OpenRouter key.** Both pages read as if Zenquanta sends zq's model requests. In fact zq calls OpenRouter directly with the user's key, OpenRouter bills the user, and Zenquanta only handles sign-in and session sync. Suggested terms line under "zq on your computer": "zq uses your own OpenRouter key. OpenRouter bills you for those requests, and its terms and the model providers' terms apply." Suggested privacy line: "zq sends your prompts and code straight to OpenRouter with your key. We receive only what sync uploads."
2. **"Our file storage provider" is unnamed.** It is Cloudflare R2. Every other processor in the table is named.

## Missing, for your legal review

3. **Who "we" are.** Neither page names the operator, the country or the governing law.
4. **How long data is kept.** No retention periods for chats, files, usage records, security records or backups. Neon keeps restore history for some days after a delete.
5. **Where data is stored.** R2 is in Asia Pacific. The Neon region and cross-border transfers are not mentioned.
6. **What model providers keep.** Providers reached through OpenRouter may log prompts under their own policies. Say so, and check the logging and training settings on the OpenRouter account.
7. **Minimum age.** The terms say 13. India's DPDP Act treats everyone under 18 as a child and needs verifiable parental consent. Decide which rule you follow.
8. **Paying for plans.** Paid plans are switched on by an admin, but the terms do not say how people pay or whether refunds exist.

## Resolved on 2026-11-28

The owner approved fixes for all eight points. Items 1 and 2 were fixed first. Items 3 to 8 now read:

3. The terms say Zenquanta AI is run from India and Indian law applies.
4. The privacy page says work stays until you delete it, usage records go with the account, sign-ins last 30 days, zq sign-ins 90 days, and backups can hold deleted data for up to 7 days (the Neon Free restore window is shorter).
5. The privacy page says the database and app run in US East and files sit in Asia Pacific.
6. The privacy page says model providers handle prompts under their own data policies and some keep logs.
7. The age stays 13 and over. Under 18, or where local law requires it, a parent or guardian must agree. Both sign-up forms have a required checkbox for this and the sign-up API refuses requests without `ageConfirmed: true`. Nothing is stored about the answer.
8. The terms say how you pay is agreed before a plan is switched on, with a refund if you ask within 7 days of paying.

## For the Flow merge, not launch

When Flow ships, the privacy page also needs share links (a public, noindex snapshot that you can revoke, with key hiding as a best effort), copying a shared chat into another account, drafts kept in browser storage, voice input through the browser's speech service (Chrome sends audio to Google), custom and project instructions, and zq approvals (exact commands stored for up to a day).
