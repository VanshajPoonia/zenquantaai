# Zenquanta AI Manual Product Smoke Test

Use this checklist for a full manual QA pass from first sign-up through advanced workspace features. This is a manual smoke test, not an automated test suite.

## Test Run Metadata

- Tester:
- Date:
- Environment: local / staging / production
- App URL:
- Commit SHA:
- Browser and OS:
- Database: Neon migrations applied through `20260603_zenquanta_performance_indexes.sql` yes / no
- Environment source: local `.env.local` / staging environment variables / production environment variables
- Real secret values copied into this document: no
- Storage provider: local / s3 / r2
- OpenRouter configured: yes / no
- Tavily configured pass: yes / no
- Tavily missing-key pass: yes / no
- Embeddings configured: yes / no
- Pgvector available: yes / no
- GitHub App configured: yes / no / not tested
- Admin account available: yes / no
- Test user accounts:
- Notes:

## Safety Notes

- Run rate-limit, usage-limit, plan activation, delete, disconnect, and re-import tests only with isolated QA accounts or staging data.
- Do not test Stripe, checkout, customer portal, payment-provider sync, or payment webhooks. They should not exist in Zenquanta AI.
- Do not use real private customer files, production secrets, or external repositories with sensitive contents.
- Do not expose or copy server secrets into the browser: OpenRouter, Tavily, embeddings, Neon, storage, and GitHub App keys must remain server-only.
- Use `.env.local` only for local development secrets. In staging/production, verify behavior through deployed environment variables without copying values into notes or screenshots.
- Text generation must go through `/api/chat`; Prism image generation must go through `/api/images/generate`.
- Private file reads must go through `/api/files/object`, never direct bucket URLs.

## Auth

### Sign up

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Open the app signed out.
  2. Create a new account with a unique email or user id and password.
  3. Complete any first-session flow without using an existing account.
- Expected result: The user is signed in, a fresh Neon-backed profile/session is created, and the authenticated workspace loads.
- Related route/API: `/api/auth/password/sign-up`, `/api/auth/session`, `/`
- Notes:

### Sign in

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Sign out if needed.
  2. Sign in with the newly created account.
- Expected result: Sign-in succeeds, the workspace loads, and existing user data is restored.
- Related route/API: `/api/auth/password/sign-in`, `/api/auth/session`
- Notes:

### Sign out

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Open account/settings controls.
  2. Sign out.
  3. Refresh the page.
- Expected result: The user remains signed out and protected workspace data is not visible.
- Related route/API: `/api/auth/sign-out`, `/api/auth/session`
- Notes:

### Invalid password

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Attempt sign-in for a valid user with an invalid password.
  2. Repeat once with a clearly wrong password.
- Expected result: Sign-in is rejected with a safe error message and no session is created.
- Related route/API: `/api/auth/password/sign-in`
- Notes:

### Rate limit behavior

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. In staging or with an isolated account, repeat invalid sign-in attempts until the safe threshold is reached.
  2. Try the valid password immediately after the threshold.
- Expected result: The app rate-limits repeated failures with a safe message and does not reveal account details.
- Related route/API: `/api/auth/password/sign-in`
- Notes: Do not run aggressive rate-limit tests against production shared accounts.

### Password reset route behavior

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Request a password reset for a test account.
  2. Open `/auth/reset-password` with valid reset/session state if available.
  3. Open `/auth/reset-password?auth=unsupported`, `?auth=failed`, and `?auth=missing-token`.
  4. Attempt a password update with no valid auth/reset session, a short password, and a valid password.
- Expected result: Safe messages are shown for unsupported/failed/missing reset states, unauthenticated update returns a safe failure, short passwords are rejected, and a valid reset/session updates the password without exposing secrets.
- Related route/API: `/api/auth/password/reset-request`, `/api/auth/password/update`, `/auth/reset-password`
- Notes:

### Authenticated password update

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Sign in with a disposable QA account.
  2. Open the password update/reset UI path available to the account.
  3. Submit a password shorter than 8 characters.
  4. Submit a valid replacement password.
  5. Sign out, then sign in with the new password and verify the old password no longer works.
- Expected result: The short password is rejected, the valid password update succeeds only for the authenticated/reset session, existing cookies are handled safely, and the new password works.
- Related route/API: `/api/auth/password/update`, `/api/auth/password/sign-in`, `/api/auth/sign-out`
- Notes: Use a disposable QA account so the password can be rotated freely.

## Onboarding And Starter Packs

### First-run onboarding

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Sign up as a brand-new user.
  2. Verify the onboarding dialog appears before normal workspace usage.
  3. Select a use case and recommended assistant/starter pack.
- Expected result: Onboarding is shown only for the new user, stores the selected onboarding state, and does not send an AI request automatically.
- Related route/API: `/api/onboarding`, `/api/settings`
- Notes:

### Install starter prompts and project

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. In onboarding, enable starter prompts.
  2. Enable starter project creation.
  3. Complete onboarding and refresh the workspace.
- Expected result: Starter prompts are added to the signed-in user's prompt library, the optional starter project is user-owned, and the selected default assistant is applied.
- Related route/API: `/api/onboarding`, `/api/prompts`, `/api/projects`, `/api/settings`
- Notes:

### Reopen or skip onboarding

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Reopen onboarding from Settings.
  2. Complete it again with a different starter pack.
  3. Test the skip/dismiss path on a disposable new user.
- Expected result: Reopening updates onboarding settings safely, duplicate starter data is handled without cross-user leakage, and skipping keeps the workspace usable.
- Related route/API: `/api/onboarding`, `/api/settings`
- Notes:

## Core Workspace

### Create conversation

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Open the authenticated workspace.
  2. Start a new chat.
  3. Enter a short prompt and send.
- Expected result: A conversation is created, user and assistant messages persist, and refresh restores the conversation.
- Related route/API: `/api/conversations`, `/api/chat`
- Notes:

### Send Nova message

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Select Nova.
  2. Send a practical general prompt.
- Expected result: The response streams through text chat, persists, and usage is logged.
- Related route/API: `/api/chat`
- Notes:

### Send Velora message

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Select Velora.
  2. Send a copywriting or tone prompt.
- Expected result: The response uses the text chat path and appears in the conversation.
- Related route/API: `/api/chat`
- Notes:

### Send Axiom message

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Select Axiom.
  2. Send a decision or comparison prompt.
- Expected result: The response streams through `/api/chat` and is saved.
- Related route/API: `/api/chat`
- Notes:

### Send Forge message

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Select Forge.
  2. Send a code review, debugging, or architecture prompt.
- Expected result: The response streams through `/api/chat` and respects text model limits.
- Related route/API: `/api/chat`
- Notes:

### Send Pulse message with Tavily configured

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Confirm `TAVILY_API_KEY` is configured server-side.
  2. Select Pulse or enable web search.
  3. Ask for current or source-backed information.
- Expected result: The response uses `/api/chat`, sources are shown when Tavily returns them, and no Tavily key is exposed.
- Related route/API: `/api/chat`, `lib/search/web-search.ts`
- Notes:

### Send Pulse message without Tavily configured

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Run a test environment without `TAVILY_API_KEY`.
  2. Select Pulse and ask a current/source-backed question.
- Expected result: Chat still responds or safely degrades, but the UI does not claim live verification or source-backed results.
- Related route/API: `/api/chat`
- Notes:

### Generate Prism image

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Select Prism or image composer mode.
  2. Send an image prompt.
- Expected result: Image generation uses `/api/images/generate`, image credits are enforced, and generated image metadata/history is saved.
- Related route/API: `/api/images/generate`, `/api/images/history`
- Notes:

### Confirm text/image routes remain separate

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Send text prompts in Nova/Velora/Axiom/Forge/Pulse.
  2. Send an image prompt in Prism.
  3. Inspect network requests.
- Expected result: Text modes use `/api/chat`; Prism uses `/api/images/generate`; Prism is not routed through `/api/chat`.
- Related route/API: `/api/chat`, `/api/images/generate`
- Notes:

## Projects

### Create project

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Open the project selector/sidebar.
  2. Create a new project with a unique name.
- Expected result: The project appears in the workspace and is persisted for the signed-in user.
- Related route/API: `/api/projects`
- Notes:

### Open Project Home

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Select the project.
  2. Open the Project Home action.
- Expected result: Project overview, recent conversations, files, images, playbooks, artifacts, memory, integrations, and suggested next actions load for that project only.
- Related route/API: `/api/projects/[id]/home`
- Notes:

### Start chat inside project

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Select a project.
  2. Start a new chat and send a Nova message.
  3. Refresh and reopen Project Home.
- Expected result: The conversation is associated with the project and appears in recent project activity.
- Related route/API: `/api/conversations`, `/api/chat`, `/api/projects/[id]/home`
- Notes:

### Upload file into project

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Open Project Home or a project conversation.
  2. Upload a small text file.
- Expected result: The file is stored privately, metadata appears in the project, and indexing status is shown honestly.
- Related route/API: `/api/attachments`, `/api/files`, `/api/projects/[id]/home`
- Notes:

### Search inside project

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Open Project Home.
  2. Trigger the project search action.
  3. Search for a term known to exist inside the project.
- Expected result: Results are scoped to the selected project and do not include unrelated owned or foreign project data.
- Related route/API: `/api/search?q=...&projectId=...`
- Notes:

### View recent project activity

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Create project chat, upload, image, and artifact activity.
  2. Reopen Project Home.
- Expected result: Recent activity sections update without invented stats.
- Related route/API: `/api/projects/[id]/home`
- Notes:

## Search

### Global search

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Press Cmd+K or Ctrl+K.
  2. Search for a conversation, prompt, file, image prompt, artifact, or project.
- Expected result: Results are normalized, grouped, user-scoped, and navigate/open the correct target.
- Related route/API: `/api/search`
- Notes:

### Project search

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Select a project with known data.
  2. Open command palette in "Search this project" mode.
  3. Search for data inside and outside the project.
- Expected result: Project mode returns only matching data connected to the active project.
- Related route/API: `/api/search?q=...&projectId=...`
- Notes:

### Command palette actions

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Open the command palette.
  2. Trigger actions for new chat, new project, dashboard, pricing, assistant switch, prompt library, Model Duel, Playbooks, Prism Studio, Memory Vault, Pulse Research Room, Ask Files, and GitHub context if available.
- Expected result: Each action opens the intended workspace surface without sending AI requests automatically.
- Related route/API: `/api/search` plus local workspace actions
- Notes:

### Search empty state

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Search for a random string that should not exist.
- Expected result: Empty state is polished and does not show stale results.
- Related route/API: `/api/search`
- Notes:

### Search no cross-user leakage

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Create data containing a unique term in user A.
  2. Sign in as user B.
  3. Search for the unique term globally and within a project.
- Expected result: User B receives no results for user A data.
- Related route/API: `/api/search`
- Notes:

## Artifacts

### Save assistant message as artifact

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Send a text assistant prompt.
  2. Use the assistant message action to save as Artifact.
- Expected result: Artifact Studio opens with a user-owned artifact containing the saved response.
- Related route/API: `/api/artifacts`
- Notes:

### Edit artifact

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Open an artifact.
  2. Change the title and content.
  3. Save and refresh.
- Expected result: Edits persist and remain visible only to the owner.
- Related route/API: `/api/artifacts/[id]`
- Notes:

### Run artifact action

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Open a saved artifact with content.
  2. Run an AI action such as "Make shorter."
  3. Review the preview before applying.
- Expected result: Usage enforcement applies, preview appears, and content is not changed until the user applies and saves.
- Related route/API: `/api/artifacts/[id]/actions`, `/api/artifacts/[id]`
- Notes:

### Move artifact to project

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Open Artifact Studio.
  2. Assign an artifact to a project.
  3. Open Project Home.
- Expected result: The artifact appears in the selected project summary/search surfaces.
- Related route/API: `/api/artifacts/[id]`, `/api/projects/[id]/home`, `/api/search`
- Notes:

### Delete artifact

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Create or select a QA artifact.
  2. Delete it after confirmation.
  3. Search for it.
- Expected result: The artifact no longer appears in Artifact Studio, Project Home, or search.
- Related route/API: `DELETE /api/artifacts/[id]`, `/api/search`
- Notes: Use disposable QA artifacts only.

### Search artifact

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Create an artifact with a unique title or phrase.
  2. Search globally and, if assigned, inside its project.
- Expected result: Search result opens Artifact Studio focused on the artifact.
- Related route/API: `/api/search`, `/api/artifacts/[id]`
- Notes:

## Playbooks

### Install starter playbook

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Open AI Playbooks.
  2. Install one starter template.
- Expected result: A user-owned playbook is created only after explicit action and does not auto-run.
- Related route/API: `/api/prompt-workflows`
- Notes:

### Create custom playbook

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Create a new playbook.
  2. Set name, description, category, expected output type, suggested assistant, and private visibility.
- Expected result: The playbook saves and reopens with metadata intact.
- Related route/API: `/api/prompt-workflows`, `/api/prompt-workflows/[id]`
- Notes:

### Add variables

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Add step prompts containing variables such as `{{business_name}}`.
  2. Open the run launcher.
- Expected result: Variables are detected and shown in the input form.
- Related route/API: `/api/prompt-workflows/[id]`
- Notes:

### Preview steps

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Fill required variables.
  2. Review expanded prompts before running.
- Expected result: Preview shows final prompts and previous-output chaining where enabled.
- Related route/API: local Playbook Studio UI, `/api/prompt-workflows/[id]`
- Notes:

### Run playbook

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Run a two-step text playbook.
  2. Run a playbook with a Prism/image step if available.
- Expected result: Text steps use `/api/chat`; image steps use `/api/images/generate`; usage warnings appear before run.
- Related route/API: `/api/chat`, `/api/images/generate`, `/api/prompt-workflows/[id]/runs`
- Notes:

### Check run history

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Complete a playbook run.
  2. Open run history.
- Expected result: History shows queued/running/completed/failed states and final output when available.
- Related route/API: `/api/prompt-workflows/[id]/runs`
- Notes:

### Save playbook output as artifact

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Complete a playbook run with final output.
  2. Save final output as Artifact.
- Expected result: Artifact is created with workflow/run metadata and no extra AI call.
- Related route/API: `/api/artifacts`, `/api/prompt-workflows/[id]/runs`
- Notes:

## Assistants

### Smart assistant router

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Type code, research, copywriting, image, and decision prompts.
  2. Observe recommendation chips.
  3. Accept and ignore recommendations.
- Expected result: Recommendations are local/rule-based, no OpenRouter call happens before send, and telemetry logs only appropriate outcomes.
- Related route/API: `/api/assistant-recommendations`, local router logic
- Notes:

### Assistant handoff

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Send a prompt and wait for a completed assistant message.
  2. Use "Send to..." for Nova, Velora, Axiom, Forge, Pulse, and Prism.
  3. Preview and edit the handoff prompt.
- Expected result: No AI request happens until confirm; text targets use `/api/chat`; Prism uses `/api/images/generate`.
- Related route/API: `/api/chat`, `/api/images/generate`
- Notes:

### Quality check action

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Open Quality actions on a completed assistant response.
  2. Try general and assistant-specific actions.
  3. Cancel one action and confirm another.
- Expected result: Actions generate editable prompts, preserve project/conversation context, and use the correct route only after confirmation.
- Related route/API: `/api/chat`, `/api/images/generate`
- Notes:

### Model Duel

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Type a text prompt in the composer.
  2. Open Model Duel and select at least two available text assistants/models.
  3. Run the duel, review candidates, and choose one winner.
  4. Refresh the conversation.
- Expected result: Model Duel is text-only, every generated candidate is billed/logged through text usage, raw provider cost is not shown to the user, and only the selected winner is saved into the conversation.
- Related route/API: `/api/model-comparisons`, `/api/model-comparisons/[id]/choose`, `/api/chat`
- Notes:

### Model Duel limit and error states

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Try Model Duel with no prompt.
  2. Try an unavailable assistant/model on the current plan if safely possible.
  3. Try near a text usage limit with a disposable QA user.
- Expected result: Empty, unavailable, and limit states show safe user-facing errors or upgrade nudges without bypassing billing enforcement.
- Related route/API: `/api/model-comparisons`, `/api/dashboard`, `/api/plan-requests`
- Notes:

### Custom assistant create/edit/test/delete

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Open Private Assistants.
  2. Create a text-only custom assistant with metadata.
  3. Test a draft prompt.
  4. Edit, duplicate, pin, select, and delete a disposable assistant.
- Expected result: Custom assistants remain private, text-only, and billed through existing text generation when tested; Prism/image modes are not available.
- Related route/API: `/api/custom-assistants`, `/api/custom-assistants/[id]`, `/api/custom-assistants/test`, `/api/chat`
- Notes:

## Memory Vault

### Open Memory Vault

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Create or open conversations with and without memory summaries.
  2. Open Memory Vault from Settings, Command Palette, and Project Home.
  3. Filter or navigate by project if data exists.
- Expected result: Memory Vault loads only the signed-in user's conversation memory summaries, shows honest empty states, and does not invent memory for conversations without summaries.
- Related route/API: `/api/memory-vault`, `/api/conversations`
- Notes:

### Copy and clear conversation memory

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Open a conversation with a memory summary.
  2. Copy the summary from Memory Vault.
  3. Clear the summary for that conversation.
  4. Refresh and verify conversation messages remain.
- Expected result: Copy works, clearing memory removes only the memory summary/status, and original messages remain intact.
- Related route/API: `/api/memory-vault`, `/api/conversations/[id]/memory`
- Notes:

### Memory user scoping

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Create a unique memory-bearing conversation as user A.
  2. Sign in as user B.
  3. Open Memory Vault and attempt direct access to user A's conversation memory route if safe.
- Expected result: User B cannot see, copy, or clear user A's memory data.
- Related route/API: `/api/memory-vault`, `/api/conversations/[id]/memory`
- Notes:

## Files And RAG

### Upload text file

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Upload a small `.txt` file to a conversation or project.
  2. Open its File Intelligence Card.
- Expected result: File is private, metadata is saved, and indexed/skipped status is honest based on embeddings setup.
- Related route/API: `/api/attachments`, `/api/files`, `/api/files/object`
- Notes:

### Upload code file

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Upload a small supported source file.
  2. Ask Forge about it with file context enabled.
- Expected result: Code file can be indexed when embeddings are configured and used through the normal `/api/chat` file-context path.
- Related route/API: `/api/attachments`, `/api/files`, `/api/chat`
- Notes:

### Upload PDF with text

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Upload a text-based PDF.
  2. Open File Intelligence.
  3. Ask about the PDF through Ask Files or file context.
- Expected result: Embedded text PDFs can be extracted, chunked, indexed, and queried when embeddings/pgvector are available.
- Related route/API: `/api/attachments`, `/api/files`, `/api/chat`
- Notes:

### Upload unsupported or binary file

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Upload a small unsupported/binary file in a safe QA environment.
  2. Open File Intelligence.
- Expected result: Upload does not expose private URLs; knowledge status is skipped or unsupported with a safe reason.
- Related route/API: `/api/attachments`, `/api/files`
- Notes:

### Ask Files

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Open Ask Files.
  2. Select one indexed file, multiple indexed files, then all indexed files in a project.
  3. Ask a question.
- Expected result: The request uses `/api/chat` with file context, stays scoped to selected files/project, and shows which files were used.
- Related route/API: `/api/files`, `/api/chat`
- Notes:

### Verify indexing status

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Review File Intelligence Cards for indexed, skipped, unsupported, failed, and pending examples if available.
- Expected result: Status labels and reasons are safe, understandable, and do not expose provider internals.
- Related route/API: `/api/files`
- Notes:

### Verify missing embeddings or pgvector states

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Run a test environment without embeddings or pgvector support.
  2. Upload a text file and open Ask Files.
- Expected result: The UI does not claim retrieval; it explains missing configuration or no indexed files honestly.
- Related route/API: `/api/files`, `/api/chat`
- Notes:

## Pulse

### Research Room

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Create a Pulse source-backed conversation.
  2. Open Pulse Research Room globally and from Project Home.
- Expected result: Recent Pulse conversations, message sources, saved source artifacts, and availability state load for the authenticated user only.
- Related route/API: `/api/pulse/research-room`
- Notes:

### Source display

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Open a Pulse response with sources.
  2. Inspect source cards/citations in message UI and Research Room.
- Expected result: Sources display title/domain/snippet safely and do not expose Tavily keys.
- Related route/API: `/api/chat`, `/api/pulse/research-room`
- Notes:

### Source save, copy, and open

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Copy a citation.
  2. Open a source in a new tab.
  3. Save a source as an Artifact.
- Expected result: Copy/open work as expected; source save creates a user-owned artifact without an AI call.
- Related route/API: `/api/artifacts`, `/api/pulse/research-room`
- Notes:

### No-key degradation

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Test without `TAVILY_API_KEY`.
  2. Open Pulse Research Room and send a Pulse prompt.
- Expected result: The UI is honest that live web search is unavailable and does not claim source-backed verification.
- Related route/API: `/api/pulse/research-room`, `/api/chat`
- Notes:

## Prism

### Studio gallery

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Generate at least one Prism image.
  2. Open Prism Studio.
  3. Filter by search, date, project, and favorites where data exists.
- Expected result: Gallery shows only owned images using protected preview URLs.
- Related route/API: `/api/images/history`, `/api/images/history/[id]`
- Notes:

### Favorite image

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Favorite and unfavorite a generated image.
  2. Refresh the gallery.
- Expected result: Favorite state persists correctly.
- Related route/API: `PATCH /api/images/history/[id]`
- Notes:

### Reuse or remix prompt

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Use Copy prompt, Reuse prompt, and Remix prompt.
  2. Confirm composer state before sending.
- Expected result: Prompt actions prepare Prism/image composer drafts and do not auto-generate.
- Related route/API: local Prism Studio actions; generation only after `/api/images/generate`
- Notes:

### Image history

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Generate images in and outside a project.
  2. Open history from Prism Studio and Project Home.
- Expected result: Image history is user-scoped and project filters work when metadata is present.
- Related route/API: `/api/images/history`, `/api/projects/[id]/home`
- Notes:

### Image credit enforcement

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Use an isolated low-credit plan/test override.
  2. Attempt Prism generation near and over the limit.
- Expected result: Image credit hints appear, over-limit generation is blocked by existing enforcement, and no raw model costs are shown.
- Related route/API: `/api/images/generate`, `/api/dashboard`
- Notes: Use staging or a disposable QA user.

## Usage And Plans

### Dashboard usage display

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Send text and image requests.
  2. Open Dashboard.
- Expected result: Displayed usage, plan, limits, plan request status, and safe user-facing usage data appear without raw provider costs.
- Related route/API: `/dashboard`, `/api/dashboard`
- Notes:

### Composer usage hint

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Type short, long, file-context, web-search, image, Model Duel, and playbook prompts.
- Expected result: Composer shows friendly low/medium/high or credit hints without changing billing calculations.
- Related route/API: `/api/dashboard`, local composer UI
- Notes:

### Manual plan request

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Open Pricing.
  2. Submit a manual request for a higher plan.
  3. Refresh Pricing and Dashboard.
- Expected result: Request status is visible and duplicate pending requests are handled safely.
- Related route/API: `/pricing`, `/api/plan-requests`, `/api/dashboard`
- Notes:

### Admin approve, reject, and activate

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. As admin, open plan requests.
  2. Approve, reject, and activate separate disposable requests.
- Expected result: Manual admin activation remains the only upgrade path and subscription state updates only after admin action.
- Related route/API: `/admin`, `/api/admin/plan-requests`, `/api/admin/plan-requests/[id]`
- Notes: Use staging or disposable QA accounts.

### Upgrade nudges

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Approach daily message/image/image-credit limits.
  2. Attempt premium or high-usage actions on a low plan.
- Expected result: Helpful nudges link to Pricing/manual request and do not bypass enforcement.
- Related route/API: `/api/dashboard`, `/pricing`, `/api/plan-requests`
- Notes:

### No Stripe or payment automation

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Inspect Pricing and plan request flows.
  2. Search UI for checkout/customer portal/payment automation prompts.
- Expected result: No Stripe checkout, customer portal, subscription-provider sync, or payment webhooks are exposed; manual plan requests remain the path.
- Related route/API: `/pricing`, `/api/plan-requests`, `/api/admin/plan-requests`
- Notes:

## Admin

### Admin dashboard

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Sign in as an admin.
  2. Open `/admin`.
- Expected result: Admin overview loads cost/margin data and product analytics; raw costs are admin-only.
- Related route/API: `/admin`, `/api/admin/overview`
- Notes:

### Product analytics

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Use admin filters for date range, plan, assistant, and user where available.
  2. Review activation funnel, feature adoption, operational signals, and users near limits.
- Expected result: Analytics render without leaking admin-only raw cost to normal user surfaces.
- Related route/API: `/api/admin/overview`
- Notes:

### User detail

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Open a user detail page from admin.
  2. Review profile, subscription, usage, plan requests, and recent activity.
- Expected result: Admin can inspect only through protected admin routes.
- Related route/API: `/admin/users/[id]`, `/api/admin/users/[id]`
- Notes:

### Plan request handling

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Create a plan request as a normal user.
  2. Handle it as admin.
  3. Reopen Pricing/Dashboard as the user.
- Expected result: Request status and activation state are consistent across admin and user views.
- Related route/API: `/api/plan-requests`, `/api/admin/plan-requests`
- Notes:

### Role protection

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Sign in as a non-admin.
  2. Open `/admin` and call an admin API directly if safe.
- Expected result: Non-admin access is blocked and no admin data is returned.
- Related route/API: `/admin`, `/api/admin/overview`, `/api/admin/users`
- Notes:

### Non-admin blocked from admin routes

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. With a non-admin session, request admin overview/users/plan request endpoints.
- Expected result: Responses are `401` or `403` as appropriate, with no raw cost or user data.
- Related route/API: `/api/admin/overview`, `/api/admin/users`, `/api/admin/plan-requests`
- Notes:

## GitHub Read-Only Integration

### Connect GitHub

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Configure a read-only GitHub App in the environment.
  2. Open GitHub repo context from Project Home or Command Palette.
  3. Start and complete the GitHub App installation flow.
- Expected result: Connection metadata is saved for the authenticated user; tokens and private keys are never exposed to the browser.
- Related route/API: `/api/integrations/github/connect`, `/api/integrations/github/callback`, `/api/integrations/github`
- Notes:

### List and select repo

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Open the connected GitHub panel.
  2. List repositories.
  3. Select a repository and branch if supported.
- Expected result: Only installation-accessible repositories appear, and the operation is read-only.
- Related route/API: `/api/integrations/github/repos`, `/api/integrations/github/repos/[owner]/[repo]/files`
- Notes:

### Import README, package, and source file

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Select README, `package.json`, and one small source file.
  2. Import them into a project.
  3. Open Project Home, File Intelligence, Ask Files, or Forge file context.
- Expected result: Selected files become private user/project-scoped knowledge records and can be retrieved through existing file/RAG paths when embeddings are configured.
- Related route/API: `/api/integrations/github/import`, `/api/files`, `/api/chat`, `/api/projects/[id]/home`
- Notes:

### Re-import

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Re-import previously selected files.
  2. Review import status and timestamps.
- Expected result: Re-import is explicit foreground work and does not start background sync.
- Related route/API: `/api/integrations/github/reimport`
- Notes:

### Disconnect

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Disconnect GitHub from the workspace.
  2. Attempt repo listing afterward.
- Expected result: Local access is disabled, future GitHub API calls fail safely, and already imported Zenquanta knowledge remains private unless removed separately.
- Related route/API: `DELETE /api/integrations/github`, `/api/integrations/github/repos`
- Notes:

### Confirm no write actions exist

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Inspect GitHub integration UI and network/API surface during connect, import, re-import, and disconnect.
  2. Confirm there are no issue, PR, commit, branch, status, webhook-processing, or repository-write actions.
- Expected result: GitHub integration remains read-only and foreground-only.
- Related route/API: `/api/integrations/github/*`
- Notes:

## Final Regression Sweep

### User scoping

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Use two normal users with unique projects, artifacts, files, searches, images, and GitHub imports.
  2. Try to access or search data across users.
- Expected result: No cross-user data leakage occurs, including global search, project search, files, generated images, artifacts, Model Duel records, Memory Vault, and GitHub imports.
- Related route/API: all protected user routes, `/api/search`, `/api/files/object`, `/api/memory-vault`, `/api/model-comparisons`
- Notes:

### Private file route protection

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Upload a private file as user A.
  2. Open or download it through the app.
  3. Inspect the network request and copied URL shape.
  4. Sign in as user B and attempt the same protected file URL if safe.
- Expected result: File access goes through `/api/files/object`, direct bucket URLs are not exposed, and user B cannot read user A's file.
- Related route/API: `/api/files/object`, `/api/files`, `/api/attachments`
- Notes:

### Text/image route separation regression

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Send text prompts through every text assistant, handoff, quality action, custom assistant test, Model Duel, and text playbook step.
  2. Generate images through Prism, Prism Studio prompt reuse, and any image playbook step.
  3. Inspect network requests.
- Expected result: Text generation uses `/api/chat` or text-specific action routes that call text billing; Prism image generation uses `/api/images/generate`; `/api/chat` rejects Prism/image requests.
- Related route/API: `/api/chat`, `/api/images/generate`, `/api/artifacts/[id]/actions`, `/api/custom-assistants/test`, `/api/model-comparisons`
- Notes:

### Server-only secrets

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Inspect browser network responses for chat, images, Pulse, files, GitHub, and dashboard.
- Expected result: OpenRouter, Tavily, embeddings, Neon, storage, and GitHub credentials are never returned to the browser.
- Related route/API: `/api/chat`, `/api/images/generate`, `/api/files/object`, `/api/integrations/github/*`
- Notes:

### Supabase runtime absence

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Inspect runtime behavior and network calls during auth, files, storage, and data flows.
- Expected result: The active app uses Neon and neutral storage. Historical Supabase migrations remain reference-only.
- Related route/API: auth, storage, and data APIs
- Notes:

### Manual upgrade path

- Status: [ ] Pass [ ] Fail [ ] Blocked
- Steps:
  1. Complete pricing, request, admin activation, and dashboard checks.
- Expected result: Plan upgrades remain manual/admin-driven; no automated payments are introduced.
- Related route/API: `/pricing`, `/api/plan-requests`, `/api/admin/plan-requests`
- Notes:
