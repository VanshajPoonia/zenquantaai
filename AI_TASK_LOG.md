# AI Task Log

## Current Status

The repository contains a real Zenquanta AI platform backed by Neon for runtime app data and credentials auth, neutral private file storage for new uploads/generated images, and OpenRouter for AI transport. Shared AI project memory files exist at the repo root. The workspace now includes Neon-backed global search through `/api/search`, a Cmd/Ctrl+K command palette, first-run onboarding through `/api/onboarding`, Artifact Studio through `/api/artifacts` (with shareable links via `/share/artifacts/[token]`), Prism Studio through `/api/images/history`, Pulse Research Room through `/api/pulse/research-room`, File Intelligence Cards through `/api/files`, Ask Files through the existing `/api/chat` file-context path, GitHub read-only repo context through `/api/integrations/github/*`, and a Memory Vault for visible conversation memory controls. The prompt library includes reusable Neon-backed prompt workflows (with shareable links via `/share/templates/[token]`), the composer includes Model Duel for text assistant comparisons, and the admin dashboard includes filtered cost/margin analytics.

Current direction: plan upgrades remain manual/admin-driven, payment automation is out of scope unless explicitly requested, and Neon/storage start fresh without importing Supabase database rows or storage objects.

## 2026-10-16 - Page buddy, redesigned die, quieter assistants panel, more 3D (Claude Code, user-requested implementation)

**Goal**: The user asked for an interactive buddy that stays on screen the whole time ("maybe the faces with letters"), less gradient in the assistants section while keeping it in "Same question. Your kind of answer.", more 3D and interactive elements, and a better die design and animation. Their stated aim is a design showpiece.

**What changed** (landing page only; the app is untouched):

- **Page buddy** (`components/landing/page-buddy.tsx`, `buddy.module.css`, `buddy-bus.ts`): a small CSS 3D onyx cube, fixed bottom right, with one assistant's initial on each face and eyes on whichever face is turned to the visitor. It looks toward the pointer, nods with scroll speed, blinks, dozes after 30 s idle, and closes its eyes while a password field has focus. Click or Enter rolls it to a new assistant and shows that assistant's line from `landing-data.ts`. It can also be spun by dragging. Four quick clicks make it dizzy. Sections claim it with `useBuddySpot(ref, face, hint)`: hero follows the playing demo, assistants follows the active key, tone shows Velora, the die section copies the rolled face, and sign-up gives a hint. Anything with `data-buddy-face` turns it on hover or focus: hero chips, keys, marquee prompts, tone start chips, die face buttons, footer links and wordmark letters. Each section's hint shows once per visit. A close button tucks it to the screen edge (remembered in `localStorage` under `zq-buddy-tucked`), and on phones it tucks itself while a form field has focus.
- **Die** (`die-scene.ts` rewritten, `die-accent.tsx`, `pip-face.tsx`): now a rounded onyx block (`RoundedBoxGeometry`) with clear coat, `RoomEnvironment` reflections and pips inlaid in each assistant's colour, drawn on one atlas with a bump map. The old hinged net (left from the removed unfold idea) is gone. Rolls are a hand-written throw: gravity and bounces for height, a roll about the travel axis that eases onto the chosen face, the die's true lowest point kept on the table so it lands on corners and rocks flat, and a correction so each throw starts from the die's current pose. Visitors can pick it up, carry it and throw it; it leans toward the pointer. Contact shadows replace the shadow map. The canvas reaches 45% above its stage (`overhang`, with a view-offset camera) so tosses are not clipped. The rolled assistant's colour pools on the table. The flat face buttons and the no-WebGL fallback match the onyx look.
- **Assistants section**: the panel's colour wash is gone (`.panelQuiet`) and the selected key's coloured glow is now a neutral shadow. The tone section keeps its glow.
- **Tone and temperature**: temperature now has a colour, cool to warm. It shows on the slider track up to the thumb, in the band label, in the thumb ring, in the chat window's top edge, and as light inside the chat window (three painted layers that cross-fade by opacity).
- **More 3D**: the hero window leans a few degrees toward the mouse, folded into the existing scroll tilt as one transform write. The footer wordmark is now nine letter blocks that tip forward onto a coloured top face when pointed at or tapped, then right themselves. The wordmark's scroll reveal was removed because on phones it sat below the reveal line and never appeared.
- `useCrossFade` in `landing-motion.ts` is now shared by the hero glow and the die's table light.

**Verification**:

- `pnpm run typecheck`, `pnpm run lint` and `pnpm test` (26 files, 135 tests) pass; `pnpm run build` passes.
- Production build, headless Chromium on Metal (M4), 1440x900 at 2x: 60 fps for hero idle, a 9 s scroll to the bottom and footer idle. Worst frame 18.7 ms, no frames over 33 ms, no long tasks. At 4x CPU slowdown it is still 60 fps with a worst scroll frame of 17.7 ms.
- The die makes 0 draw calls at rest. The result text matches the face that lands up.
- Screenshots at desktop and 390 px wide show no horizontal overflow and no page errors. The only console errors are the signed-out session 401 and the Vercel Analytics script 404 (which only resolves on Vercel).
- Reduced motion: the buddy is present at once with no running animations; Enter rolls it and announces the assistant through an `aria-live` region; the die rolls on click without the throw; password focus closes the buddy's eyes.

**Limits and risks**: Timings are headless, not the user's screen. The buddy covers a corner of the page; it can be tucked away, and on phones it hides while a field has focus. Bubble hints are page copy written for this release. The two P faces (Pulse, Prism) are told apart by colour. CSS 3D face sorting relies on `preserve-3d`, which current Chrome, Safari and Firefox support; it was only checked in Chromium.

**Next steps**: Check Safari and Firefox by hand (CSS 3D buddy, wordmark blocks, WebGL die). The e2e smoke tests do not cover the buddy yet.

## 2026-10-16 - Landing page performance, live workspace demos, tone and temperature section (Claude Code, user-requested implementation)

**Goal**: The user reported the site as very laggy, asked for more typing animation and real question and answer exchanges in the "Everything stays in one place" section, and asked for tone and temperature adjustment to be shown as a feature.

**Lag, measured first**: Production build profiled in headless Chromium on the Apple M4 GPU (Metal) at 1440x900, Retina scale, with effects switched off one at a time. Causes found: animated `filter: blur()` on the hero frame and every scroll reveal; the hero glow as a blurred 70rem layer re-blurred whenever the inherited `@property --hue` transitioned (which also restyled the whole hero subtree every frame); scroll handlers writing CSS custom properties (`--tilt`, `--scale`, `--p`) that restyled hundreds of descendants per scrolled frame; masks over moving layers (hero frame, marquee); backdrop blur on the fixed nav; the Prism example image's rain animated inside the same SVG as two Gaussian blur filters; the die redrawing 60 times a second while idle; and the die's textures getting per-pixel noise (12 x 512px `getImageData`) in one task.

**Fixes (`components/landing/*`)**:
- `landing.module.css`: rule at the top of the file (animate only opacity and transform). Reveal, `rise`, `unitIn`, `swapIn` and `develop` no longer blur. `@property --hue` removed; the hero glow is two unblurred gradient layers that cross-fade (`HeroGlow` in `landing-page.tsx`). The hero frame fade and the marquee edges are overlays, not masks. Nav uses a near-opaque fill instead of backdrop blur. Rain is its own tiled layer (`.rain`) over a static `PrismArt`. `[data-loop]` elements pause their animations while off screen (`useRevealOnScroll` toggles `data-playing`).
- Scroll work: `useScrollProgress` only listens while the element is near the screen and only calls back when the value changes. The tilt writes `transform` straight onto its element. The statement flips `data-lit` on each word once instead of restyling every word every frame.
- `hero-demo.tsx`: per-letter typing lives in a small `ComposerLine` child and the sidebar is memoized, so a keystroke re-renders a few nodes instead of the whole window.
- `die-scene.ts`: renders on demand (frames only while it moves, then sleeps until the next idle nudge, a roll, a drag or a resize), stops when off screen, compiles shaders with `compileAsync`, paints grain from one shared noise tile, yields between faces, and skips the inside faces when `inside` is not passed (the die accent no longer passes it).
- `components/chat/empty-state.tsx`: the new-chat glow lost its 40px blur.

**Results (same scripts, production build, M4)**: scrolling the page, style recalculation went from about 1,060 ms to about 110 ms per 6 s and dropped frames from 10 to 0 (worst frame 83 ms to 19 ms); the hero's worst idle frame went from 250 ms to 19 ms; GPU work with the die idle on screen went to 0. With the CPU throttled 4x the hero holds 60 fps and the die's creation task went from about 389 ms to about 118 ms. The chat workspace was also measured with mocked APIs: it idles at 60 fps and composer keystrokes take about 1 ms of script, the same keystroke-to-paint time as a bare textarea in this setup, so the lag was the landing page.

**Workspace section (`workspace-tiles.tsx`)**: each tile now plays a scripted example while on screen: a question typed into a composer, a "Retrieving excerpts from your files" or "Thinking" status (wording from the chat route's working notes), the answer streaming word by word, then the cited file highlighted with its quote; a memory follow-up that highlights the remembered note it uses; a playbook running step by step (Running, Done); a Model Duel with two answers streaming and one kept; and Cmd K search typing a query with results narrowing and the selection moving. Scripts are pure functions of `useLoopClock` (new in `landing-motion.ts`), which reads Infinity before playback and under reduced motion, so those visitors see the finished frame. Mock areas have fixed heights so streaming text never moves the page.

**Tone and temperature (`tone-demo.tsx`, new section "Same question. Your kind of answer.")**: the chat settings panel's Tone preset (labels from `SYSTEM_PRESET_CONFIGS`) and Temperature (0 to 2, step 0.05, bands from `getTemperatureQuantity`, hint text from the settings panel) driving one example question answered by Velora. Fifteen replies (five tones by three bands) are written for the page and labelled as examples. A row shows where each text assistant's temperature starts, read from `MODEL_ROUTE_CONFIGS` (Prism left out). A short tour plays while the section is on screen until the visitor changes something; the slider is a native range input under a custom track, so keyboard and screen readers work. The section copy says tone and temperature can be set per chat or as defaults in Settings, both of which exist (`settings-panel.tsx`, `settings-modal.tsx`). The die section moved off the band background so bands still alternate.

**Verification**: `pnpm run typecheck`, `pnpm run lint`, `pnpm run test` (26 files / 135) and `pnpm run build` pass; `/` is still static. Playwright on the dev server at 1440x900 and 390x844: no horizontal overflow and no console errors apart from the signed-out 401; tiles and the tone tour captured mid-play; the die lands, rolls and settles; reduced motion leaves nothing hidden or dimmed, runs no tour, and the slider responds to arrow keys.

**Not verified / known limits**: frame numbers come from headless Chromium, not a real display or a slower GPU. On a slow GPU, the die's first shader compile can still delay a frame or two the first time its section appears. The user's own setup was not profiled; `pnpm run dev` is much slower than a production build by nature.

**Next steps**: same as the 2026-10-15 entry (tool dialogs, syntax highlighting, e2e smoke tests for the landing page).

## 2026-10-15 - Landing page and workspace redesign after Cursor and Linear (Claude Code, user-requested implementation)

**Goal**: The user asked for the landing page and the main chat page to take inspiration and elements from Cursor, Linear and similar sites, with subtle animations, scroll animations and catchy details, with permission to rewrite whole components. They chose to keep the 3D die only as a small accent, and to restyle the whole workspace shell.

**Research**: Captured cursor.com, linear.app, raycast.com, vercel.com and resend.com with headless Chromium (the Chrome extension was not connected). Borrowed: Linear's near-black canvas, tight 560-weight headlines, two-tone statement paragraph and hairline structure; Cursor's product window as the hero; Raycast's lit keyboard keys; Resend's oversized footer wordmark.

**Landing (`components/landing/*`)**:
- `landing-page.tsx` rewritten. Hero: "Six AI specialists. One workspace." with a live product window (`hero-demo.tsx`) that plays one example chat per assistant (the app's real suggested prompts; replies written for the page and labelled "Example chat"). The page light, the window's top line and text selection take the hue of whichever assistant is playing (`@property --hue`). The window tips back and flattens as you scroll. "Now playing" chips jump between assistants.
- Statement paragraph whose words light up as you scroll, assistant names in their hues. Six assistants as lit keyboard keys (keys 1 to 6 work while in view, arrow keys move between tabs) with a detail panel from `ASSISTANT_FAMILY_COPY` and `ASSISTANT_PUBLIC_PAGES`. Two-row marquee of all 24 suggested prompts. Workspace bento (`workspace-tiles.tsx`: projects and files, memory, playbooks, Model Duel, search) with pointer spotlight borders. Plans table from `PLAN_CONFIGS` with count-up numbers. Sign-up form restyled (`landing-auth-form.tsx`, same auth calls). Footer with a large masked wordmark.
- The die (`die-accent.tsx`) is now one section, "Can't decide? Roll for it." three.js is fetched as the section approaches and the scene is built once it is on screen. `die-scene.ts` gained an optional `cameraDistance` for the close-up. Its "Start free" button only scrolls to sign-up; it does not set the starting assistant.
- Motion helpers in `landing-motion.ts`: reveal on scroll (content stays visible unless the script has switched motion on), scroll progress, in-view. Reduced motion: no tilt, statement fully lit, hero shows finished chats and advances slowly, nothing hidden.

**Workspace**:
- `app/globals.css`: new neutral dark tokens (near-black greys, translucent hairline borders, `--radius` 0.625rem, indigo `--sidebar-primary`), thin scrollbars, selection colour, and utilities `animate-arrive`, `text-shimmer`, `animate-breathe`, `animate-meter`, plus the composer's streaming line. `.font-display` is now Geist 600 with tight tracking; Instrument Serif is no longer loaded (`app/layout.tsx`). `.eyebrow` is now a plain small label.
- Sidebar: compact 32px rows with coloured assistant icons, CSS truncation (the width-estimate title fitting is gone), chats grouped Today / Yesterday / Previous 7 days / Previous 30 days / Older, actions on hover (always shown on touch), bordered New chat row, account row with avatar initial plus a Settings icon button, hairline resize handle.
- Header: flat 48px bar with a hairline, project / chat breadcrumb, and a Search pill with the platform shortcut.
- Messages: assistant replies are open text beside a tinted icon and the assistant name (no card); user turns are a quiet bubble without an avatar; new code block header with a Copy label; inline code, headings and lists retuned; "Thinking" / "Creating image" shimmer with a breathing hue dot while streaming; messages arrive with a short fade. Chat column narrowed to `max-w-3xl`. The chat ScrollArea now forces Radix's table wrapper to block so wide code scrolls inside the column on phones.
- Composer: focus ring and border in the current assistant's hue, a light running along the top edge while a reply streams, tighter controls.
- New chat empty state: "What are we working on?", the assistant switcher as lit keys (`mode-switcher.tsx`), suggested prompts as a list.
- Workspace Home: greeting, quick-action row with project picker, Continue and Recent chats as dense list rows, Suggested next, and a side column with Usage meters, Projects (with inline new project) and Library. Skeleton loading instead of a loading box.
- Sign-in gate and the restore screen restyled. `components/chat/spectrum-arc.tsx` deleted (no users left).

**Verification**: `pnpm run typecheck`, `pnpm run lint` (no warnings), `pnpm run test` (26 files / 135) and `pnpm run build` pass; `/` is still static and three.js is still its own chunk (about 135 KB gzipped). Playwright on the dev server: landing at 1440x900 and 390x844 with no horizontal overflow and no console errors (apart from the signed-out 401); all six hero chats render (list, table, code, sources, image); the die renders and rolls; reduced motion leaves nothing hidden. The signed-in workspace was checked with every `/api` call mocked in the browser (no database reads or writes): Workspace Home, an open chat, a new chat, a pending reply, and phone sizes, with no overflow or console errors.

**Not verified / known limits**: no real signed-in session or real streamed reply was used. The design detector's DESIGN.md advisories were ignored because the root `DESIGN.md` is a Runwai reference file, not this app's system; its one other finding is the loading shimmer's `background-clip: text`, kept on purpose. Code blocks still have no syntax highlighting. The e2e smoke tests still expect the old auth gate at `/` (they predate the landing page). Dialogs and tool panels (Artifact Studio, Playbooks, Settings and others) only pick up the new tokens; their layouts were not redesigned.

**Next steps**: restyle the tool dialogs to the new shell; add syntax highlighting to code blocks; update the e2e smoke tests for the landing page.

## 2026-10-14 - Landing page for signed-out visitors (Claude Code, user-requested implementation)

**Goal**: A distinctive, playful landing page with 3D elements and animation that explains the product and lets visitors sign up.

**Implemented**:
- Signed-out visitors at `/` now see `components/landing/landing-page.tsx` instead of the bare sign-in card (`chat-layout.tsx`, loaded with `next/dynamic`). Signed-in visitors still go straight to the workspace; `/c/<id>` signed out still shows `AuthGate`.
- A three.js die (`components/landing/die-scene.ts`, new dependency `three` plus `@types/three`): each face is an assistant in its accent hue. It drops in on load, rolls on click, drag or the "Roll the die" button, and the six small dice under it pick a face directly. While the assistant cards scroll by, it turns to that assistant's face; in the next section it unfolds into its cube net, showing the shared workspace printed inside.
- Sections: hero, six assistant cards (real suggested prompts from `ASSISTANT_FAMILY_COPY`), the unfold, a score-pad plan table from `PLAN_CONFIGS`, and a sign-up/sign-in "player card" (`landing-auth-form.tsx`) using the existing `requestPasswordSignUp`/`requestPasswordSignIn`. Nav "Start free" and "Sign in" jump to the form and focus the ID field.
- Fallbacks: reduced motion makes face changes instant and skips the drop; no WebGL shows a flat SVG die; the canvas only draws while the stage is visible.
- `PRODUCT.md` added at the repo root (audience, positioning, evidence on hand) for design work.
- No restore screen for new visitors: `lib/utils/session-hint.ts` defines a non-secret `zq_signed_in=1` cookie that the chat context sets once a session is confirmed and clears when the visitor is signed out. At `/`, a browser without it gets the landing page immediately while the session check runs; with it, the usual "Restoring your workspace…" screen. Until the cookie is read after hydration, the prerendered `/` shows a blank screen instead of the restore message. The hint grants nothing; a wrong hint only costs one restore screen or one landing flash before the check corrects it (and the cookie). Tests in `tests/session-hint.test.ts`.

**Verification**: `pnpm run typecheck`, `pnpm run lint`, `pnpm run test` (132) and `pnpm run build` pass; `/` is still static and three.js is in its own chunk (about 135 KB gzipped) loaded only by the landing page. Playwright at 1440x900 and 390x844: no horizontal overflow, no console errors apart from the existing signed-out 401; roll, pick a side, drag, Start free (scrolls and focuses the ID field), Sign in mode switch, client validation, and a wrong-password sign-in (server error shown) all work; a signed-in session at `/` still opens the workspace; reduced motion works on the production build. No account was created during testing.

Hint cookie (Playwright, dev server): a new visitor never sees the restore text and gets the landing page; a signed-in session gets the hint set and, on reload, sees the restore screen with no landing flash; a stale hint with no session shows the restore screen once, then the landing page, and the hint is cleared. Tests now 26 files / 135.

**Known limits / next steps**: signed-in users from before this change see the landing page once on their first visit until the session check sets the hint. Pulse's "searches the web" copy assumes `TAVILY_API_KEY` is set in production. The root `DESIGN.md` is a Runwai reference file, not this app's system, so the design detector's palette advisories against it were ignored.

## 2026-10-14 - UX structure, phase 3 part 2: Library, pages in the app, merged tools (Claude Code, user-requested implementation)

**Goal**: Finish the phase 3 product items from the UX audit, following the audit's own recommendations: a sidebar Library, Dashboard/Pricing/Knowledge inside the app layout, and merging Ask Files with Knowledge and the prompt library with Playbooks.

**Implemented**:
- Sidebar Library (`components/chat/sidebar.tsx`): a collapsible section under New Chat with Artifacts, Images (Prism Studio), Playbooks, Files (`/knowledge`), Memory (Memory Vault) and Research (Pulse Research Room). Rows are real links (`/?tool=<tool>` or `/knowledge`), so Cmd/Ctrl-click opens a new tab and a plain click opens the tool in place; on phones the drawer closes first. The collapsed state is remembered in localStorage. Knowledge Library left the account menu.
- Pages in the app layout: `app/dashboard`, `app/knowledge` and `app/pricing` moved into `app/(workspace)/` (URLs unchanged). `ChatShell` (`components/chat/chat-layout.tsx`) now renders the route's page beside the sidebar when the path is not `/` or `/c/<id>` (`isWorkspacePath` in `lib/utils/chat-path.ts`). The header shows the page name. The chat area is mounted the first time it is shown and then kept hidden while a page is open, so drafts, scroll and streams survive a trip to Dashboard. Signed-out visitors on `/pricing` still get the standalone page with Sign in. While the session restores on Dashboard or Files, the page shows with empty sidebar and header placeholders so nothing jumps. The "Back to app" / "Open workspace" / "Back to workspace" links are gone, and the pages have their own tab titles.
- Navigation from a page: `goHome`, `createNewChat`, `setCurrentChat` and `openConversation` call `router.push` back to `/` or `/c/<id>` when the current path is a page. The chat URL sync, the Back/Forward handler and the tab-title effect leave page routes alone.
- Deep links: the `/?tool=`, `/?conversationId=`, `/?view=project` and `/?openAskFiles=` handling is now `handleWorkspaceDeepLink` on the chat context, run by a small `WorkspaceDeepLinks` component (inside its own Suspense boundary, because it reads `useSearchParams`) whenever the query string changes. Before, it ran once per page load, which broke once the workspace stayed mounted, and Workspace Home's `router.push('/?tool=playbooks')` from `/` never opened anything.
- Files and Ask Files: the Files page (formerly Knowledge Library, `app/(workspace)/knowledge/*`) opens Ask Files in place, for one file or with an "Ask your files" button for the current project filter, instead of navigating to `/?openAskFiles=`.
- Prompts and playbooks: the composer popover had its own copy of the playbook editor. Its New and Edit buttons now open Playbook Studio's editor (`workflowId` and `playbookAction` on the workspace tool request), and the duplicate editor is gone (`prompt-library-button.tsx` 1,048 to 688 lines). Run and Share stay in the popover. The + menu has one "Prompts & playbooks" entry instead of "Prompt library" and "Playbooks".

**Verification**: `pnpm run typecheck`, `pnpm run lint`, `pnpm run test` (25 files / 132 tests) and `pnpm run build` pass; `/` is still prerendered as static. Playwright against the dev server (no AI calls, no writes): the Library lists six items and Artifacts opens Artifact Studio; Files opens `/knowledge` in the same document with the header "Files", the active row and the tab title, and "Ask your files" opens Ask Files over it; a sidebar chat from Files opens `/c/<id>`; Back goes to Files, then `/` with the composer draft kept; Forward works; Usage & plan opens the dashboard in the shell; a dashboard activity "Open" link opens that chat; Plans opens in the shell without Sign in; New chat from Plans returns to `/`; New AI Playbook in the popover opens the studio editor; `router.push('/?tool=playbooks')` opens Playbooks; Cmd-click on Images opens a new tab with Prism Studio; a direct load of `/dashboard` shows the page at once with placeholders, no layout jump and no `/api/workspace-home` request; signed-out `/pricing` shows no sidebar and a Sign in link; on a 390px phone, tapping Images closes the drawer and opens Prism Studio, Files opens with no horizontal overflow. No console errors apart from the existing 401 from the signed-out session check.

**Not changed / known limits**: tools are still dialogs; their URL is only an entry link (`/?tool=`) and the address does not follow an open tool. Admin pages stay outside the app layout. Playbook sharing is still only in the popover. Sidebar chat titles still use the width estimate (`getFittedSidebarTitle`) the audit flagged, and the list is not grouped by date. The per-request auth/profile round trips noted in part 1 are unchanged.

**Next steps**: sidebar chat list polish from the audit (CSS truncation, date groups, actions on hover); per-request auth cost; consider moving playbook sharing into Playbook Studio.

## 2026-10-14 - UX structure, phase 3 part 1: chat links and streaming speed (Claude Code, user-requested implementation)

**Goal**: Start phase 3 of the UX audit with the two items that do not need product decisions: per-chat URLs and loading/streaming performance.

**Implemented**:
- Chat URLs: the workspace moved into the `app/(workspace)/` route group. Its `layout.tsx` renders `ChatLayout`; `page.tsx` (`/`) and `c/[id]/page.tsx` (`/c/<id>`) render nothing, so the workspace stays mounted while the address changes. `lib/utils/chat-path.ts` has `getChatPath` / `getChatIdFromPath` (tests in `tests/chat-path.test.ts`). `lib/chat-context.tsx` keeps the address on the open chat (push on navigation, replace on the first sync after load and when leaving a chat that no longer exists), reopens what the address names on Back/Forward, and names the tab after the chat. On load `/c/<id>` opens that chat and `/` opens Workspace Home; the last chat is no longer restored from browser storage at `/`. Unknown or deleted chat ids show a toast and replace the address with `/`. The old `/?conversationId=` and `/?tool=` deep links still work.
- Sidebar chat rows are real links (stretched `<a href="/c/<id>">` with the actions button above it): keyboard focusable, Cmd/Ctrl/middle-click opens a new tab, a plain click still opens in place.
- Race fix: a slow message-page fetch could switch the view back to a chat the user had already left (Back, or clicking another chat within the 2 to 5 s fetch). `chatNavigationIdRef` now makes late fetches update the cached chat without making it current.
- Streaming: deltas are applied at most once per animation frame (`flushPendingDelta` in the `/api/chat` stream loop, flushed before any non-delta event and in `finally`). `ChatMessage` is wrapped in `React.memo`, and `ChatArea` passes handlers through the new `hooks/useStableCallback.ts`, so only the streaming message re-renders.
- Loading: the chat named in the address is fetched together with the other workspace requests instead of after the chat list. While it loads, the chat area shows a small skeleton instead of mounting Workspace Home, which used to fetch `/api/workspace-home` (about 5.5 s here) for nothing. `hasLoadedWorkspaceData` is now exposed on the chat context.

**Verification**: `pnpm run typecheck`, `pnpm run lint`, `pnpm run test` (25 files / 131 tests) and `pnpm run build` pass. Playwright against the dev server: click opens `/c/<id>` with the tab title; Back returns to `/` and Forward to the chat in the same document (no reload); New chat shows `/`; reload keeps the chat; Cmd-click opens it in a new tab; an unknown id shows the toast and replaces the address; keyboard Enter opens a row; the row actions menu still opens; phone tap opens the chat and closes the drawer; no console errors. Streaming was measured with an in-page fetch replacement (a fake 60-message chat and 400 streamed deltas, so no AI calls or database writes; the only non-GET request, an assistant-recommendations telemetry POST, was answered locally):

| Build | Before | After |
| --- | --- | --- |
| Production, 4x CPU throttle | 25.7 s to stream, ~200 long tasks (11.5 s blocked), 30.6 fps | 12 to 13 s, 2 long tasks (0.35 s), 57 fps |
| Production, unthrottled | 5.5 s, 1 long task (96 ms), worst frame 83 ms | 5.2 s, 0 to 1 (55 ms), worst frame 33 to 50 ms |
| Dev | 29.6 s, 401 long tasks (28 s blocked), 26.7 fps | 8.1 s, 16 long tasks (1.5 s), 53 fps |

**Not verified / known limits**: Loading a linked chat came out even locally (messages about 4.5 s after the session check), because `next start` serves HTTP/1.1 and Chrome caps a host at 6 connections, so the 8 parallel requests queue. Measured with curl, the list and single-chat endpoints do not slow each other. The saving should show over HTTP/2 in production but was not measured there. Every API request here spends about 2 s on `requireAuthenticatedUser` plus `ensureFromAuthUser` round trips to Neon; that per-request floor is the largest remaining loading cost. A real streamed reply was not sent (no AI calls).

**Next steps**: phase 3 product items still need the user's direction: a sidebar Library (artifacts, images, playbooks, files), merging overlapping tools, and bringing Dashboard/Pricing/Knowledge into the app shell. Separately: cut auth/profile round trips per API request.

## 2026-10-14 - UX declutter, phase 2 (Claude Code, user-requested implementation)

**Goal**: Phase 2 of the UX audit: declutter the composer, message actions, header and Settings, plus a wording and units pass. Layouts follow current AI chat conventions (single-row composer with a + tools menu, model picker beside Send, active tools as removable chips, hover action rows, settings with section navigation).

**Implemented**:
- Composer (`components/chat/composer.tsx`, new `composer-controls.tsx` and `composer-usage.tsx`): one toolbar row: + menu (attach, create image, search the web, use project files, prompt library, playbooks, Model Duel, Artifact Studio, Prism Studio, chat settings), assistant picker (built-ins plus enabled private assistants, "Create/Manage your assistants", "Which assistant should I use?"), intelligence picker, round Send/Stop. Image mode and web search show as removable chips. The always-on usage/intelligence card and the keyboard-shortcut line are gone; a one-line notice appears only near a limit, while a plan request is pending, in image mode, or for very large drafts. Files can be pasted or dropped onto the composer. `PromptLibraryButton`, `ModelComparisonButton` and `CustomAssistantButton` accept `hideTrigger` and are opened through `openWorkspaceTool`. The plan lookup (`/api/dashboard`) is done once per composer mount.
- Removed `components/chat/usage-transparency-hint.tsx`, `ModeSwitcherCompact` and `ModeSwitcherVertical` (no remaining users). The duplicate assistant switcher above open chats is gone.
- Message actions (`components/chat/message.tsx`): Copy, thumbs up/down, Regenerate menu (regenerate, different intelligence, ask another assistant), and a `...` menu (save as artifact, open image, improve this reply, send to another assistant). Hidden while streaming; Retry only appears on failed replies (it duplicated Regenerate). Older messages show actions on hover, focus, or always on touch screens. User message edit/resend buttons got labels.
- Errors: the generic error banner at the top of the chat is removed (the failed message already shows its error and Retry). Plan-limit errors show an upgrade card below the last message.
- Header (`components/chat/header.tsx`): chat title with a menu (rename inline, pin, chat settings, export Markdown/JSON, delete with confirm). Removed the unlabelled assistant icon, the Idle/Ready/Streaming badge, the separate export, session-settings and help buttons. Settings gear only shows when the sidebar (which has Settings) is closed. Added `renameChat` to the chat context; it updates the title optimistically and rolls back with an error toast on failure.
- Titles: `updateConversationSnapshot` (`lib/utils/chat.ts`) used to re-derive the title from the first user message on every save, so renames could never stick (and paged chats could derive from the wrong message). It now keeps any non-placeholder title and only derives while the title is still a "New ... chat" placeholder.
- Settings (`components/chat/settings-modal.tsx`): section navigation (General, Chats, Suggestions, Memory, Account & data), one row per setting, model sampling under a collapsed Advanced, delete tools on their own page, Save disabled until something changes, Discard, toasts on save. Removed the "Dark theme" button and accent style toggle, which changed nothing (`accentStyle` is stored but never read). Removed the About tab.
- Chat settings panel (`components/chat/settings-panel.tsx`): renamed from Session Settings; dropped the duplicate summary card; features first, sampling under Advanced; Advanced no longer auto-opens when intelligence changes.
- Wording and units: sidebar account menu no longer shows dollar "Estimated spend" (now chat and message counts plus "Usage & plan"); Dashboard usage card shows counts instead of dollars; pricing cards lead with messages and images a day and describe tokens as standard/premium model tokens; plain copy replaced "without running any AI calls", "without spending credits on page load", "Target project", and "Embedding provider is not configured" (user-facing message and `tests/file-helpers.test.ts` updated).

**Verification**: `pnpm run typecheck`, `pnpm run lint`, `pnpm run test` (24 files / 127 tests) and `pnpm run build` pass. Playwright on the local dev server at 1440x900 and 390x844: all menus open and close without leaving `pointer-events: none` on the body, Prompt library popover and Model Duel open from the + menu, rename updates the header and sidebar immediately and persists (test chat renamed and restored), Settings sections render with no horizontal overflow on phones, no console errors. Composer height on a phone is 152 of 844px (was about 52% of the screen).

**Not verified**: header delete success path (no data deleted), drag-and-drop and paste of files (code path only), Queue while streaming (no new AI calls were made).

**Next steps**: phase 3 (chat/tool URLs, sidebar Library, merge overlapping tools, bring Dashboard/Pricing/Knowledge into the app shell, loading and streaming performance).

## 2026-10-14 - UX quick fixes, phase 1 (Claude Code, user-requested implementation)

**Goal**: Implement the phase 1 quick fixes from the UX audit below.

**Implemented**:
- Dialog widths: base `DialogContent` and `AlertDialogContent` now use `w-[calc(100%-2rem)] max-w-lg` (no `sm:max-w-lg`), so consumer widths apply on desktop. Six dialog headers (Artifact Studio, Prism Studio, Memory Vault, Pulse Research Room, Model Duel, Onboarding) got `pr-10` so the close button no longer overlaps their header actions.
- New Chat: added `isNewChatDraft` to `lib/chat-context.tsx`; New Chat now shows the assistant welcome screen with starter prompts. Logo/Home still go to Workspace Home.
- Auth: `restoreSession` no longer turns the logged-out 401 into a red error; sign-in/sign-up use a new `requestAuthJson` helper, so a wrong password shows the server message instead of "Authentication required."; the auth gate is a real `<form>` (Enter submits) with sr-only labels and `username` / `current-password` / `new-password` autocomplete; stale session errors hide while a new attempt runs.
- Header: removed the dead "Share Chat" menu items; added aria-labels to icon-only header buttons.
- Usage copy: Workspace Home shows messages left today (and hides the credits meter) when the plan has no credit budget; Dashboard cards now show messages left today, images left today, and image credits left (or credits left this cycle when the plan has a credit budget), using the effective subscription with overrides like `/api/dashboard`.
- Feedback: mounted the existing sonner `Toaster` in `app/layout.tsx` (dark, top-center). Chat delete now asks for confirmation; delete, pin, and move failures show error toasts; a successful delete shows "Chat deleted".
- Mobile: the drawer no longer shows the desktop collapse button next to its own close button. Added aria-labels to sidebar icon buttons.
- Pricing: `/pricing` is public through new `getOptionalServerUser`; signed-out visitors get "Start free" / "Sign in to request". `requestPlanAction` still requires sign-in.

**Verification**: `pnpm run typecheck`, `pnpm run lint` (zero warnings), `pnpm run test` (24 files / 127 tests), and `pnpm run build` pass. Browser-verified with Playwright on the local dev server: no error on the sign-in screen, Enter submits, wrong password shows the server message, public pricing renders, New Chat shows the welcome screen, all large dialogs render at their intended widths with no close-button overlaps, export menu has only real items, delete confirm opens and Cancel keeps the chat, a simulated 500 on delete shows the error toast and keeps the chat, dashboard shows real limits, and the phone drawer has one close button. The successful-delete toast was not exercised, to avoid deleting data.

**Next steps**: phase 2 (declutter composer, message actions, header, Settings; wording pass) and phase 3 (chat/tool URLs, sidebar Library, loading and streaming performance) from the audit.

## 2026-10-14 - UX audit (Claude Code, review only, no app code changed)

**Goal**: User-requested UX/ease-of-use audit of the running app. Ran `pnpm run dev` locally and drove it with Playwright (installed Chrome) at 1440x900 and iPhone 13 sizes, plus code review of the shell, composer, sidebar, header, message actions, auth gate, and dialogs.

**Side effects**: Created one test account in the Neon database that `.env.local` points to (login ID `ux-audit-5f0ef7`, Free plan, onboarding skipped) and sent one short Nova chat message through OpenRouter. No other data was written. Delete the account from admin if it is not wanted.

**Highest-impact findings**:
- `components/ui/dialog.tsx` base class `sm:max-w-lg` overrides the unprefixed `max-w-*` widths on about 20 large dialogs (Settings, Onboarding, Artifact Studio, Playbooks, Memory Vault, Prism Studio, Pulse Room, Model Duel, Assistant guide), so they render at 512px on desktop.
- `createNewChat` and `goHome` in `lib/chat-context.tsx` are near-identical, so "New Chat" shows Workspace Home; `components/chat/empty-state.tsx` starter prompts are effectively unreachable.
- `restoreSession` turns the normal logged-out 401 into a visible red "Authentication required." on the auth gate.
- Auth gate is not a `<form>`: Enter does not submit, no autocomplete attributes, placeholder-only labels.
- "Share Chat" header menu items have no handler; chat delete has no confirm/undo; toaster components exist but are not mounted.
- Composer shows 15 icon-only controls plus an always-on usage/intelligence card; on phones the composer takes about 52% of the viewport. Assistant switcher is rendered twice in an open chat.
- No per-chat or per-tool URLs (current chat lives in localStorage), so back/refresh/bookmark/share do not work.
- Usage copy contradicts itself ("0 displayed credits left" next to "No limit"; dashboard "Remaining credits 0" for a Free user with messages left) and mixes $, credits, and tokens.
- Each streamed delta replaces the conversations array in the single 3,400-line context; `ChatMessage` is not memoized.

**Next steps**: See the audit summary in the Claude Code session for the phased plan (quick fixes, declutter, structure). No implementation started.

## 2026-07-12 - Deterministic chat order, intelligence controls, and admin plan sandbox

**Goal**: Continue the user-requested chat/admin work after the prior Claude session stopped at research: keep a new user prompt above its assistant response, make intelligence selectable beside the composer, allow a response to be regenerated at another intelligence level, let an admin switch its own plan for testing, and keep any user's plan editable from admin.

**Implemented**:
- Message ordering now has an explicit tie-break: when a user message and assistant placeholder share a timestamp, the user is ordered first. New assistant placeholders also receive a timestamp 1ms after their parent user message. The same comparator is used for Neon hydration, paged-message merges, and client-side message-page merging, covering both fresh sends and persisted reloads without a schema migration.
- The existing Fast/Balanced/Best quality/Lowest usage controls above the composer are now live. They map to the existing response profiles (`gemini`/`auto`/`claude`/`deepseek`) and update the current conversation's session settings; existing server-side plan/model checks remain authoritative.
- The last text response now has a Regenerate menu with “Same intelligence” plus the four intelligence levels. A selected regeneration level is sent as a request-scoped `responseModelOverride`, so it changes that response's model route without silently changing the conversation default.
- `/admin` now has an admin-only Plan sandbox for switching the current admin account between Free/Basic/Pro/Ultra/Prime. It resets the account to the exact selected plan limits, clears custom usage/model overrides, starts a fresh allowance period, and writes an admin audit event. The existing user table/detail controls remain the route for editing any user's plan, status, limits, role, and model overrides; their purpose is now labeled explicitly.

**Verification**: Focused ordering/routing tests pass (15 tests). Full suite passes (24 files / 125 tests), `pnpm run typecheck` passes, `pnpm run lint` passes with zero errors/warnings, `pnpm run build` passes, and `git diff --check` passes. The first sandboxed build attempt could not reach Google Fonts; rerunning with approved network access compiled all 61 static pages and dynamic routes successfully. Browser automation was not claimed: the installed `agent-browser` skill's CLI is unavailable, and the read-only localhost fallback could not be approved because the tool-approval service reported its usage limit.

**Risk / behavior boundary**: Best quality may be rejected on a plan that does not include the mapped premium model; this is intentional and produces the existing plan-availability error/upgrade path. No payment automation, user self-serve tier switching, database migration, or new AI gateway was added.

## 2026-07-12 - Temporal context awareness + critical migration-drift fix

**Feature**: Explicit user request for chat replies to be time/gap-aware instead of defaulting to generic "good morning"-style greetings (e.g. "good night" followed 2 minutes later by "hi" should read as a short gap, not a new day). Implemented as a new always-on `[Temporal context]` system-prompt block, following the same pattern as the existing web-search/file-knowledge blocks:

- `lib/chat-context.tsx` now sends `timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone` (the browser's IANA zone) with every `/api/chat` request; added `timeZone?: string` to `ChatRequest` in `types/index.ts`.
- `lib/ai/chat.ts` adds `buildTemporalContextBlock()`, computing the user's approximate local time (via the client-sent IANA zone, falling back to UTC) and the elapsed time since the message immediately before the current one in that conversation. The block is injected unconditionally (both budget-enabled and legacy prompt-assembly paths) right before the live message list, and counted in the Phase-2 token-budget accounting.
- `timeZone` is threaded through `buildOpenRouterMessages`, `buildPromptTextForUsage`, `generateAssistantStream`, and `completeConversationWithAssistant` in `lib/ai/chat.ts`, and from `app/api/chat/route.ts`'s `payload`.
- The instruction wording had to be tuned during testing: an initial conservative phrasing ("don't announce unless relevant") caused the model to just never mention short gaps. Rewriting it with a concrete example matching the user's exact scenario ("good night" → few minutes later → notice it, don't assume a new day) reliably produced replies like "Hey, back so soon?" for a 2-minute gap, while a 9-hour gap produced a natural "back again!" without forcing anything. Verified via real end-to-end `/api/chat` calls against a real OpenRouter model (not mocked), with message timestamps deliberately backdated in Neon to simulate gaps.
- No new feature flag: this is a small, low-risk prompt-content addition (unlike the flagged multi-phase context engine), so it ships always-on.

**Critical bug found and fixed while testing the above**: new conversations could not be saved at all. `lib/db/schema.ts` declares `memorySummaryStructured`, `summarizedThroughMessageId` (context engine Phase 1) and `summaryEmbedding` (Phase 4) columns on `zen_conversations`, and every conversation insert writes to them unconditionally — but the corresponding migrations (`neon/migrations/20260711_zenquanta_context_engine_summary.sql`, `20260712_zenquanta_context_engine_cross_chat.sql`) had never actually been run against the live Neon database, so every `INSERT INTO zen_conversations` failed with `column "memory_summary_structured" does not exist`. A third same-batch migration, `20260711_zenquanta_context_engine_memory_items.sql` (creates `zen_memory_items`, only load-bearing once `MEMORY_EXTRACTION` is enabled), was also un-applied. All three were applied directly against the live database with explicit user sign-off (confirmed via `AskUserQuestion` before running, since this is a live schema change). Verified afterward: all 36 tables declared in `schema.ts` now exist live, and a real conversation create → reply round trip succeeds.

**Risk / open item**: there is no automated migration runner in this repo — `neon/migrations/*.sql` are plain files someone must run manually (see `AI_CHECKLIST.md` → Migration Order), so this exact failure mode (schema.ts updated, migration written, but never executed against the real database) can recur silently for any future migration until a runner or CI check exists.

## 2026-07-12 - Full data reset and single admin re-seed

**What happened**: At explicit user request, all rows were deleted from `zen_users` in the live Neon database. Every other table's `user_id` foreign key cascades from (`ON DELETE CASCADE`) or nullifies against (`ON DELETE SET NULL`) `zen_users` — confirmed via `pg_constraint` before running — so this cascaded to remove all app data: profiles, credentials/sessions, subscriptions/usage, projects/conversations/messages, prompts/workflows, model comparisons, custom assistants, integrations, files/file-chunks, generated images, artifacts, feedback events, admin audit logs, and context-engine memory items. 8 users were deleted. The local object storage directory (`.storage/zenquanta`, provider is `local` per `.env.local`) was also cleared, though it contained no actual file bytes at the time (empty per-user subdirectories only).

**New state**: A single local-auth user was re-seeded directly via the same scrypt password scheme as `lib/auth/session.ts` (login_id `kayla.viehland`, role `admin` in both `zen_users` and `zen_profiles`). Verified the stored hash matches the given password before finishing. The database is otherwise empty.

**How it was done**: No admin/reset script exists in the repo for this; it was done with an ad hoc Node script (using `@neondatabase/serverless` directly, deleted afterward, never committed) rather than through the app's API routes, since this was a one-off destructive maintenance action, not a feature.

**Risk / open item**: There is no backup of the deleted data. If a reset script or admin bootstrap flow is wanted for repeatable use later, none currently exists in `lib/` or `scripts/`.

## 2026-07-11 - Context Engine Phase 1: Structured Rolling Summary (MEMORY_V2)

**Goal**: Explicit user request to build a context/memory system that (a) reduces client input-token usage, (b) lets all chats refer to each other, and (c) uses a cheap model to decide what's worth remembering long-term — pitched as "holds context better than most frontier chatbots." Full reconciled architecture (compared against a competing 19-phase external brief and the actual codebase) is documented in the new **`AI_CONTEXT_ENGINE.md`**. This entry covers Phase 1 only; Phases 2–5 are scoped there and tracked but not yet built.

**Why Phase 1 first**: The pre-existing "memory summary" in `lib/ai/memory.ts` was regex keyword-matching, not an LLM, and per-request context was a hard last-8-messages / ~24k-char cutoff with zero cross-chat memory. Replacing the regex with a real cheap-model structured summary is the biggest single-chat quality win and the foundation the later tiers (durable memory items, cross-chat recall) build on.

**What was built (all behind the `MEMORY_V2` env flag, default OFF — the legacy regex/last-8 path runs unchanged when the flag is off)**:
- **Migration** `neon/migrations/20260711_zenquanta_context_engine_summary.sql`: adds nullable `memory_summary_structured jsonb` and `summarized_through_message_id text` to `zen_conversations`. **Must be run before deploying with `MEMORY_V2` on** (columns are added to the Drizzle schema, so `select()` needs them present).
- **Schema** `lib/db/schema.ts`: the two new columns on `zenConversations`.
- **Types** `types/index.ts`: new `ConversationMemoryStructured` interface (objective/decisions/constraints/facts/openLoops/preferences) + optional `memorySummaryStructured`/`summarizedThroughMessageId` on `Conversation`.
- **Flags** `lib/context/flags.ts` (new): all context-engine flags (`MEMORY_V2`, `CONTEXT_BUDGET`, `MEMORY_EXTRACTION`, `CROSS_CHAT_RECALL`, `TOON_SERIALIZATION`, `CONTEXT_DEBUG`), env-driven, default OFF.
- **Summarizer** `lib/ai/memory-summary.ts` (new): `generateRollingSummary` calls `google/gemini-2.5-flash` via the existing OpenRouter client with a structured-output prompt that explicitly preserves identifiers/routes/numbers/code verbatim and merges into the prior summary incrementally (resumes from `summarizedThroughMessageId`, else last 14 messages). Robust JSON parse (tolerates code fences / surrounding prose), case-insensitive bullet dedupe, length caps. `renderStructuredSummary` emits the same section labels the legacy summarizer used, so the read path is unchanged. `maybeUpdateRollingSummary` is the background entry point — never throws (memory work must not break chat), no-ops unless `MEMORY_V2` + conversation memory are both on.
- **Repository** `lib/db/repositories/conversations.ts`: `updateMemorySummary` (owned solely by the async job; deliberately does NOT bump `updatedAt`, so background maintenance doesn't reorder the chat list; regular turn saves in `upsertConversationHeader` never touch these columns, so the two paths don't clobber) + row mapping for the new columns.
- **Orchestration** `lib/ai/chat.ts`: when `MEMORY_V2` is on, `completeConversationWithAssistant` skips the legacy regex `updateConversationMemory` and preserves whatever the async job last wrote (avoids per-turn flip-flop between regex and LLM summaries).
- **Route** `app/api/chat/route.ts`: after the response has fully streamed and the `done` event is emitted (off the critical path — zero added user-visible latency), calls `maybeUpdateRollingSummary` with the saved conversation.

**Verification**: `tsc --noEmit` clean; `eslint` clean on all touched files; full `next build` succeeds; added `tests/context-engine-summary.test.ts` (7 cases: JSON parse of clean/fenced/prose-wrapped/garbage/empty output, case-insensitive dedupe + non-string rejection, exact-GUID preservation through parse+render, section rendering/order) — all pass; full suite green (21 files / 95 tests). **Not** live-exercised end-to-end: the LLM summary path needs a real `OPENROUTER_API_KEY` and `MEMORY_V2=1`, which aren't set in this environment; the pure parse/render logic (the only fragile part) is covered by the unit tests, and the wiring is covered by typecheck/build.

**Note on `server-only`**: the two new modules deliberately do NOT import `'server-only'`, matching the existing `lib/ai` convention (`memory.ts`, `openrouter.ts`, `chat.ts` don't either — the guard is unresolvable under vitest and the layer relies on server-side usage discipline). They're server-only by usage (imported only from the chat route / `lib/ai/chat`).

**Not changed**: no durable memory items, no cross-chat recall (Phases 3–4 in `AI_CONTEXT_ENGINE.md`). The regex summarizer and fixed last-N window remain the live path until the flags are enabled.

## 2026-07-11 - Context Engine Phase 2: Token Governor + Cache-Friendly Ordering (CONTEXT_BUDGET)

**Goal**: Reduce input-token usage and coordinate the context blocks under one budget (the "reduced token" half of the user's ask), building on Phase 1. Behind the `CONTEXT_BUDGET` env flag, default OFF — legacy behavior is byte-for-byte identical when the flag is off (verified by keeping the original block order + `getRecentContextMessages` selection on the off-path).

**What was built**:
- **`lib/context/token-budget.ts`** (new): the governor. `computeMessageSelectionBudget({ contextBlockTexts, totalBudgetTokens? })` measures how many tokens the fixed blocks (system prompt, custom-assistant, memory, web search, file knowledge) already consume and hands the recent-message window the remainder, floored at `MIN_RECENT_MESSAGE_TOKENS` (1500) so a big memory/RAG payload can squeeze but never starve the immediate thread. Returns the char-based shape that the already-tested `selectBoundedContextMessages` (`lib/ai/memory.ts`) consumes, so the "always include latest user message + truncate oversized" semantics stay in one place. Single conservative `DEFAULT_TOTAL_INPUT_TOKENS` (8000) — deliberately NOT tier-aware yet, so the generation path and the billing-estimation path (both route through `buildOpenRouterMessages`) share one identical budget; tier-scaling is a documented follow-up.
- **`lib/ai/chat.ts` `buildOpenRouterMessages`**: when `CONTEXT_BUDGET` is on, selects recent messages via the governor instead of the fixed last-8, and reorders blocks stable-prefix-first (system → identity → memory → per-query retrieval → volatile recent turns) so a provider can cache the stable prefix. When off, the original selection and order are preserved exactly.

**Why the flag-off path is byte-identical**: the diff routes the two behaviors through one shared `mappedMessages` builder but keeps two separate return orderings, and the off-path return is the pre-existing array verbatim. Confirmed no behavior change for existing traffic until the flag is set.

**Verification**: `tsc --noEmit` clean; `eslint` clean on touched files; full `next build` succeeds; added `tests/context-token-budget.test.ts` (4 cases: block-token summation ignoring empty blocks, remainder allocation, floor enforcement when context exceeds budget, default-budget fallback) — all pass; full suite green (22 files / 99 tests). Not exercised live end-to-end (needs the flag on + a real conversation), but the allocator math is unit-covered and the wiring is covered by typecheck/build; the off-path is provably unchanged.

**Not changed**: still no durable memory items or cross-chat recall (Phases 3–4). Budget is not yet tier-aware. `CONTEXT_BUDGET` and `MEMORY_V2` are independent flags and can be enabled separately.

## 2026-07-11 - Context Engine Phase 3: Durable Cross-Chat Memory + Write Gate (MEMORY_EXTRACTION)

**Goal**: The differentiator — durable memory that spans *all* of a user's chats ("once I tell it something… it should go ahead" and store it) with a cheap-model write gate deciding what's worth keeping. Behind the `MEMORY_EXTRACTION` env flag, default OFF. When off, the retrieval layer returns `undefined`, the durable block is never injected, and the prompt is byte-identical to Phases 1–2. This entry covers the **backend** (write gate + read path); the Memory Vault UI surfacing of durable items is a scoped follow-up (Phase 3c).

**What was built (all behind `MEMORY_EXTRACTION`)**:
- **Migration** `neon/migrations/20260711_zenquanta_context_engine_memory_items.sql`: new `zen_memory_items` table (id, user_id, project_id nullable=global, source_conversation_id, kind, canonical_key, content, content_json, mode, importance, confidence, status, supersedes_id, embedding vector(1536) nullable, timestamps, last_confirmed_at, valid_until) + kind/status check constraints + btree indexes + HNSW cosine index. **Must be run before enabling `MEMORY_EXTRACTION`** (columns are in the Drizzle schema). Additive and safe to drop — raw messages stay the source of truth.
- **Schema** `lib/db/schema.ts`: `zenMemoryItems` table. Self-referential `supersedes_id` FK is declared in the migration SQL only (a Drizzle inline self-reference would be a forward reference).
- **Types** `types/index.ts`: `MemoryItemKind`, `MemoryItemStatus`, `MemoryItem`, `MemoryCandidate`, `DurableMemoryContext`.
- **Scope helper** `lib/context/memory-scope.ts` (new, pure): `resolveMemoryProjectScope` — the default inbox (`project-inbox`) and no-project map to the **global** bucket (`null`), so those chats share memory; real projects keep their id for isolation.
- **Exact-evidence detector** `lib/context/exact-evidence.ts` (new, pure): `containsExactEvidence` flags fragile tokens (paths, routes, URLs, code, long ids, snake_case, money/units, versions) so the read path renders them verbatim.
- **Repository** `lib/db/repositories/memory-items.ts` (new): `record` (canonical-key dedupe + supersession — unchanged fact bumps `last_confirmed_at`, changed fact inserts a new active row + marks the prior superseded, novel fact inserts; filters by `user_id` at every step), `search` (pgvector cosine over active in-scope items, ignores unembedded rows), `listActiveForScope` (importance/recency fallback when embeddings are unconfigured). Write scope = exact bucket match; read scope = globals + current project.
- **Write gate** `lib/ai/memory-extraction.ts` (new): deterministic pre-gate (`shouldAttemptExtraction` skips trivial acknowledgements for free) → one `google/gemini-2.5-flash` call → `parseCandidates` (tolerant array/object-wrapper/fenced JSON parse, kind coercion, canonical-key normalization, importance/confidence clamps, per-key dedupe, cap 6) → optional batch embedding (degrades gracefully when unconfigured) → `record`. `maybeExtractDurableMemories` is the background entry — never throws, no-ops unless `MEMORY_EXTRACTION` + conversation memory are both on.
- **Read path** `lib/ai/memory-retrieval.ts` (new): `retrieveDurableMemoryContext` prefers vector similarity to the user's message, then tops up with high-importance items so core identity is present even on an unrelated query; never throws (returns `undefined`). `lib/ai/memory.ts` `buildDurableMemoryBlock` renders a `[Durable user memory]` block splitting exact-evidence (verbatim, do-not-paraphrase) from soft preferences. `lib/ai/chat.ts` threads `durableMemoryContext` through `buildOpenRouterMessages`/`buildPromptTextForUsage`/`generateAssistantStream`/`completeConversationWithAssistant`, injecting the block in the stable-prefix region (after identity, before the rolling summary) in both the budget-on and legacy orderings.
- **Route** `app/api/chat/route.ts`: retrieves `durableMemoryContext` before generation (so billing sees the real prompt) and passes it through; runs `maybeExtractDurableMemories` after the `done` event alongside `maybeUpdateRollingSummary` (off the critical path, zero added user-visible latency).

**Design decisions** (recorded in `AI_DECISIONS.md`): (1) the extraction runs as its **own** cheap-model call, not merged into the Phase 1 summary call — independent flags / rollback beat the marginal cost of a second flash call; merging when both flags are on is a documented follow-up. (2) The **default inbox is the global memory bucket** — mapping it to a null scope is what makes "all chats refer to each other" true for the common case without breaking project isolation.

**Verification**: `tsc --noEmit` clean; `eslint` clean on touched files; full `next build` succeeds; added `tests/context-engine-memory.test.ts` (parse/dedupe/kind-coercion/clamp/truncate, pre-gate, scope resolution, exact-evidence detection, block split/ordering) — all pass; full suite green. **Not** live-exercised end-to-end: the model gate + pgvector recall need a real `OPENROUTER_API_KEY`/embeddings key + `MEMORY_EXTRACTION=1` + the migration applied, none set here; the fragile pure logic (parse, scope, exact-evidence, block render) is unit-covered and the wiring is covered by typecheck/build; the off-path is provably inert (retrieval returns `undefined` → no block).

**Not changed**: Memory Vault UI does not yet surface durable items (Phase 3c follow-up); no cross-chat *summary* recall yet (Phase 4 — this phase recalls durable *items*, not other conversations' summaries). `MEMORY_EXTRACTION` is independent of `MEMORY_V2`/`CONTEXT_BUDGET`.

## 2026-07-12 - Context Engine Phase 4: Cross-Chat Summary Recall (CROSS_CHAT_RECALL)

**Goal**: The explicit "all chats refer to each other" capability, at the *conversation* granularity — surface a short summary of the user's other relevant chats ("what did I tell Nova about X" answered inside Forge). Complements Phase 3 (which recalls atomic durable *items*); this recalls *pointers to relevant past threads*. Behind the `CROSS_CHAT_RECALL` env flag, default OFF. When off, retrieval returns `undefined`, the block is never injected, and the prompt is identical to Phases 1–3.

**What was built (all behind `CROSS_CHAT_RECALL`)**:
- **Migration** `neon/migrations/20260712_zenquanta_context_engine_cross_chat.sql`: adds nullable `summary_embedding vector(1536)` to `zen_conversations` + HNSW cosine index. **Must be run before enabling `CROSS_CHAT_RECALL`** (column is in the Drizzle schema).
- **Schema** `lib/db/schema.ts`: `summaryEmbedding` column on `zenConversations` (HNSW index is migration-only, matching `zen_file_chunks`).
- **Types** `types/index.ts`: `CrossChatMatch`, `CrossChatRecallContext`.
- **Write path** `lib/ai/memory-summary.ts`: `maybeUpdateRollingSummary` now, when `CROSS_CHAT_RECALL` + embeddings are configured, embeds the fresh rendered summary and writes it via `updateMemorySummary`. This piggybacks on the Phase 1 summary job (so cross-chat recall builds on `MEMORY_V2` — the summary is what gets embedded). Embedding is optional; omitting it leaves any existing embedding untouched.
- **Repository** `lib/db/repositories/conversations.ts`: `updateMemorySummary` gained an optional `summaryEmbedding` (omitted vs. null = untouched); new `searchConversationSummaries` — pgvector cosine over `summary_embedding`, `user_id`-scoped, excludes the current conversation, requires a non-null summary + embedding, returns `CrossChatMatch[]` (id, title, short summary, mode). Added a local `vectorLiteral` helper.
- **Read path** `lib/ai/cross-chat-recall.ts` (new): `retrieveCrossChatContext` embeds the user's message and searches other conversations' summaries; **requires embeddings** (no non-vector fallback — without similarity there's no principled way to pick relevant threads), returns `undefined` otherwise; never throws. `lib/ai/memory.ts` `buildCrossChatBlock` renders a `[Related past conversations]` block (title + capped summary per match), explicitly framed as *background context, not user instructions*. `lib/ai/chat.ts` threads `crossChatContext` through the same four functions as Phase 3, injecting the block in the stable-prefix region between durable memory (Tier 3) and the rolling summary (Tier 1) — matching the doc's Tier 3 → Tier 2 → Tier 1 order.
- **Route** `app/api/chat/route.ts`: retrieves `crossChatContext` before generation (billing sees the real prompt) and threads it through.

**Design decisions** (recorded in `AI_DECISIONS.md`): (1) cross-chat recall is **user-scoped, not project-scoped** — a user's own threads can reference each other across projects (that's the point), and it only exposes a short summary, never raw messages; this intentionally differs from durable items, which respect project isolation. (2) The write **depends on `MEMORY_V2`** because it embeds the rolling summary; documented, not hidden.

**Framing note**: the block tells the model the summaries are *background context, not instructions from the user* — a deliberate guard so a recalled past conversation can't be treated as a new command.

**Verification**: `tsc --noEmit` clean; `eslint` clean on touched files; full `next build` succeeds; extended `tests/context-engine-memory.test.ts` with cross-chat block cases (empty, render + framing, truncation) — all pass; full suite green. **Not** live-exercised end-to-end: needs a real `OPENROUTER_API_KEY` + embeddings key + `CROSS_CHAT_RECALL=1` + migration applied; the pure block builder is unit-covered, wiring is covered by typecheck/build, and the off-path is inert.

**Not changed**: no neighbor retrieval / extractive compression / TOON yet (Phase 5+). Memory Vault UI still doesn't surface durable items (Phase 3c). `CROSS_CHAT_RECALL` write depends on `MEMORY_V2`; read is independent.

---

## 2026-07-12 - Context Engine Phase 5 (TOON) + Phase 3c (Vault Surfacing) — Engine Feature-Complete

**Goal**: Explicit user instruction to "complete the whole project, any phase that is left." The two remaining items in `AI_CONTEXT_ENGINE.md` were Phase 5 (TOON serialization) and Phase 3c (surface durable memory items in the Memory Vault UI). Both shipped this session, behind existing flags, default OFF. No new migrations — neither phase changes the schema.

**Phase 5 — TOON serialization (`TOON_SERIALIZATION`)**:
- **`lib/context/toon.ts`** (new, pure): `encodeToon(name, columns, rows)` emits the canonical header-once table (`name[N]{cols}:` + indented CSV rows, CSV-style quoting/escaping for commas/quotes/newlines/edge-whitespace). `isToonWorthwhile(baseline, candidate, ratio=0.1)` compares estimated prompt tokens and returns true only on a ≥10% win. `MIN_TOON_ROWS = 4`.
- **`lib/ai/chat.ts`**: new private `maybeToonSourceList(...)` helper; `formatWebSearchBlock` and `formatFileKnowledgeBlock` now build the readable rendering as before, then — only when the flag is on AND rows ≥ 4 AND TOON beats the readable rendering by ≥10% — swap in the TOON form (preamble folded into the compared candidate so its cost counts). Flag-off and not-worthwhile are byte-identical to the legacy prompt. The token governor already sees the (possibly shrunk) block because the choice happens inside the block formatter.
- **Honest ROI**: the source blocks are long free-text, so the structural win rarely clears 10% and TOON usually stays inert — exactly what `AI_CONTEXT_ENGINE.md` §8 predicted. The capability is correct, tested, and safe (the gate means it can never enlarge a block), and engages automatically if a future block is a high-cardinality short-field array. Deliberately NOT applied to the durable-memory block (its exact-evidence split matters more than a few percent). Neighbor retrieval + extractive compression stay deferred-with-trigger (§7), not built speculatively.
- **Tests** `tests/context-engine-toon.test.ts` (7 cases): header/row format, number/boolean/nullish cells, quoting/escaping, empty array/columns, a real win on short multi-column rows vs JSON, no-win on free-text snippets, empty-baseline + custom-ratio gating.

**Phase 3c — Memory Vault surfaces durable items + "forget"** (read gated by `MEMORY_EXTRACTION`):
- **`lib/db/repositories/memory-items.ts`**: `listAllActiveForUser(userId, limit=200)` (all active items across every scope, importance/last-confirmed order) + `expire(userId, id)` (soft-delete: flip `status` to `expired`, user-scoped; returns whether an active row matched).
- **`lib/db/repositories/memory-vault.ts`**: `getVault` now also fetches durable items **only when `MEMORY_EXTRACTION` is on** (off → no extra query, empty section, unchanged cost), resolves each item's scope to a display name (`Global (all chats)` / project name / `Unknown project`), and returns `durableMemories` + `durableMemoryEnabled` + `totals.durableMemoryCount`. New `forgetDurableMemory(userId, id)` delegates to `expire`.
- **Types** `types/index.ts`: `MemoryVaultDurableItem` (lean client view, no embedding) + the three new response fields.
- **API** `app/api/memory-vault/durable/[id]/route.ts` (new): `DELETE` forgets one item (404 when nothing active matched), same auth/cookie-refresh pattern as `conversations/[id]/memory`.
- **Client** `hooks/useMemoryVault.ts` gains `forgetDurableMemory`; threaded through `lib/chat-context.tsx` (type + hook destructure + value + deps).
- **UI** `components/chat/memory-vault.tsx`: new "Durable memory" section (kind badge, scope, content, confirmed date, "open source chat" link, per-item Forget with an `AlertDialog` confirm mirroring Clear-summary), plus an empty/off state that explains whether the feature is on. `Sparkles` icon added.

**Verification**: `tsc --noEmit` clean; `eslint` clean on every touched file; full `next build` succeeds and registers `.next/server/app/api/memory-vault/durable/[id]/route.js`; full vitest suite **123 passed (24 files)** (was 116/23 — +7 TOON cases, nothing regressed). **Not** live-exercised: the Vault dialog is auth-gated (can't sign in here, and entering credentials is prohibited) and the durable section only populates with `MEMORY_EXTRACTION=1` + seeded `zen_memory_items`; there is no jsdom/testing-library setup, so the component isn't render-tested — its correctness rests on tsc + the successful build. The pure TOON logic (the only fragile new logic) is unit-tested.

**Not changed**: no schema/migration changes; durable-memory block rendering unchanged (TOON intentionally not applied there); no new dependencies; all five flags still default OFF, so `main` stays deployable.

---

## 2026-07-11 - Spectrum Identity Design Pass + Mobile Fix

**Goal**: Explicit user request ("implement that, and make it a better design, easy to use on mobile phones and all the devices") using the `frontend-design` skill guidance, after the 2026-07-10 cleanup/modularization pass. Scope was kept to the highest-traffic surfaces rather than a full app-wide visual rewrite, given session time constraints — see "Not changed" below.

**Direction**: The 2026-06-29 redesign pass explicitly kept Geist/Geist Mono as the only fonts and the six per-assistant accent colors as "the signature device, not replaced." This pass builds on that rather than reopening it: the six-hue system (Nova teal/Velora pink/Axiom violet/Forge green/Pulse cyan/Prism orange) is real, unique brand material tied to the literal product concept ("Zenquanta" spectrum, a literal "Prism" assistant), so it was leaned into harder instead of changed. Added `Instrument_Serif` (next/font/google) as a new second display face — `--font-display` / `.font-display` in `app/globals.css`, wired in `app/layout.tsx` — used only for hero/wordmark moments (never dense UI chrome), paired against the existing Geist body/mono. Added a new signature SVG motif, `components/chat/spectrum-arc.tsx` (`SpectrumArc`): the six mode hues plotted as an upward-bowing arc with the active mode's point lit/glowing, replacing the previous generic radial blur-blob glow. Added a `prefers-reduced-motion: reduce` global rule to `app/globals.css` (previously absent) forcing near-zero animation/transition duration site-wide, covering the existing `tw-animate-css` `animate-in`/`animate-float`/etc. usage.

**Applied to**: `components/chat/empty-state.tsx` (arc + `font-display` hero title, replacing the blur-blob), `components/auth/auth-gate.tsx` (arc + new `font-display` headline "Six assistants. One workspace.", replacing generic "Sign in to your workspace"), `components/chat/header.tsx` and `components/chat/sidebar.tsx` (wordmark spans switched to `.font-display`), `components/chat/chat-layout.tsx` (loading-screen copy switched to `.font-display`).

**Mobile bug found and fixed**: `ModeSwitcherCompact` (`components/chat/mode-switcher.tsx`) used `flex flex-wrap` with no `shrink-0` on itself or its buttons. Inside the composer's horizontally-scrollable toolbar row (`overflow-x-auto`, no `shrink-0` on children), the flex algorithm was shrinking the switcher's available width and its internal `flex-wrap` was collapsing the 6 mode icons into a vertical single-file stack instead of staying inline — confirmed live at 375–490px widths, verified fixed by adding `shrink-0` to the switcher container and its buttons and removing `flex-wrap`. Pre-existing bug, not introduced by this pass; the other `ModeSwitcherCompact` usage (`chat-area.tsx`, centered standalone) was unaffected either way since 6 compact icons comfortably fit any phone width once shrinking is prevented.

**Verification**: `tsc --noEmit` passes; `eslint` passes on all touched files (0 errors); `next build` passes cleanly. Manually driven live via `preview_*` tools at mobile (375/490px), tablet (768px), and desktop (1440px): created and deleted a disposable empty test conversation to force-render `EmptyState` (the normal "New Chat" flow lands on `WorkspaceHome` first, not `EmptyState` directly), confirmed the arc/serif hero renders correctly and stays anchored to its scroll container (added missing `relative` to `EmptyState`'s root — the old blur-blob had the same latent positioning gap, it was just too subtle to notice), confirmed the sidebar wordmark and composer toolbar fix render correctly at all three widths. Did not sign out to visually verify `auth-gate.tsx` live (same account-safety reasoning as prior passes — no risk taken with the only working login), but the change reuses the exact `relative` + `SpectrumArc` + `.font-display` pattern already proven live in `EmptyState`.

**Feature recommendation given (not implemented, awaiting user confirmation)**: conversation branching/regenerate-from-here, cross-assistant context handoff mid-thread, mobile PWA manifest/icons, shareable-link polish for `/share/*`.

**Not changed**: `WorkspaceHome`, `ProjectHome`, dashboard, pricing, knowledge library, admin pages, and all non-visual/API/billing/auth logic — this was a visual/typography/mobile-layout pass only, scoped to the components most users see most often (auth gate, header, sidebar, empty state, composer). A full-app pass (WorkspaceHome hero, pricing page, dashboard) was deliberately left for a follow-up if the user wants the spectrum-arc/serif treatment extended further.

---

## 2026-07-10 - Cleanup Pass: Package Manager, Lint, Deep Bug Review, Billing Race Fix

**Goal**: Explicit user request to inventory current functionality, audit the code against it, fix bugs found along the way, check for memory leaks, and prepare for eventual modularization. Scope was narrowed via explicit user choices to: package manager/lint cleanup, and a deep manual review (not just automated scan) of auth, billing/usage math, and the streaming chat pipeline.

**Package manager (resolved)**: The repo is pnpm-managed (`node_modules/.pnpm` present, only `pnpm-lock.yaml` committed) but `README.md`/`AGENTS.md`/`AI_CHECKLIST.md` documented `npm install`. Updated all three to `pnpm`, matching reality rather than switching package managers. `pnpm install --frozen-lockfile` confirmed the lockfile is current.

**Lint (0 warnings, was 10)**: Fixed all pre-existing warnings without behavior changes — removed a fully dead duplicate `components/ui/use-toast.ts` (only `hooks/use-toast.ts` was ever imported), removed a dead `generateImageAttachment()` in `lib/ai/chat.ts` (fully superseded by the exported `generateImageFromPrompt`), removed a dead `getSidebarChatTitle()` and an unused `projectLabelById` prop thread in `components/chat/sidebar.tsx`, removed an unused `AIMode` import and an unused `toNullableIsoString` import, converted `hooks/use-toast.ts`'s `actionTypes` runtime object to a type-only construct (never used as a value), added `argsIgnorePattern`/`varsIgnorePattern: '^_'` to `eslint.config.mjs` to codify the codebase's existing `_file`-style unused-arg convention, and suppressed (with a one-line justification comment) the two `no-img-element` warnings in `chat-image-message.tsx`/`message.tsx` since `next.config.mjs` already sets `images.unoptimized: true` project-wide, so `next/image` would add no benefit there while requiring risky layout changes (unknown attachment dimensions).

**Deep bug review findings (auth, billing, streaming chat) — verified by direct code reading, not just automated scan**:
- **Fixed — auth rate-limit spoofing**: `lib/auth/session.ts`'s `getRequestMetadata()` took the leftmost (client-controllable) entry of `x-forwarded-for` for the IP-scoped login rate limit, letting a caller spoof a fresh IP on every request and bypass the 20-failure IP lock (the per-login-id 5-failure limit was unaffected). Changed to take the rightmost entry, which is the one appended by a trusted reverse proxy.
- **Fixed — image credit undercharge**: `app/api/images/generate/route.ts` hardcoded `defaultImageCreditsPerImage: 10` for every tier, but Ultra/Prime route to `openai/gpt-5-image` which is priced at 20 credits/image in `lib/config/pricing.ts` — a 50% undercharge for those tiers. Now looks up the real value from `MODEL_PRICING_CONFIG.imageModels[routeConfig.model]`.
- **Fixed — billing check-then-act race condition (the significant one)**: `enforceTextUsage`/`enforceImageUsage` only checked an in-memory snapshot of the subscription fetched once at request start; the actual wallet deduction happened via a separate DB call only after the full LLM stream/image generation completed. Concurrent requests (e.g. multiple browser tabs) could all pass the check against the same stale snapshot and all get through, unbounded by concurrency — the daily-message/wallet limits provided no real ceiling under parallel load. Fixed with a reserve-then-reconcile pattern: added `reserveTextUsage`/`releaseTextUsage`/`finalizeTextUsage` and `reserveImageUsage`/`releaseImageUsage` to `lib/db/repositories/subscriptions.ts`, each a single atomic conditional `UPDATE ... WHERE (effective_included - used_column) >= amount AND daily_count < effective_limit RETURNING *` so concurrent requests for the same user serialize on the Postgres row lock instead of racing on a stale read. `app/api/chat/route.ts` and `app/api/images/generate/route.ts` now reserve a worst-case estimate (prompt tokens + requested max output tokens for text; the deterministic per-image credit cost for images) before generation starts, adjust down to actual usage on success (text only — image cost is deterministic so no adjustment needed), and release the full reservation on any error/abort so the existing "never charge for failures" behavior is preserved. Added `recordTextUsageEvent`/`recordImageUsageEvent` to `lib/billing/log-usage.ts` for event-row-only logging (the old `logTextUsage`/`logImageUsage`, which increment-then-log, are unchanged and still used by `app/api/artifacts/[id]/actions/route.ts`, `app/api/model-comparisons/route.ts`, and `app/api/custom-assistants/test/route.ts` — those routes were out of scope for this pass). Sanity-checked that per-request `maxOutputTokensPerRequest` caps (800–8,000 tokens across plans) are tiny relative to wallet sizes (1M–8M tokens), so the worst-case reservation approach won't cause false near-limit rejections in practice.
- **Fixed — cross-conversation UI hijack**: `lib/chat-context.tsx`'s NDJSON `start`/`done` handlers (and the image-generation completion handler) called `upsertConversation(conversation)` with `makeCurrent` defaulting to `true`, so a message finishing in the background after the user navigated to a different conversation would forcibly switch the visible chat back to it. Now only follows if the user hasn't already navigated to a different conversation (`!currentChatRef.current || currentChatRef.current.id === conversation.id`), in three call sites.
- **Fixed — Stop button could act on the wrong conversation**: `isStreaming` was a single global flag with no conversation scoping, so the Stop control in the composer would appear/act on whatever was streaming anywhere, not necessarily the conversation being viewed (a consequence of the same background-stream design as the previous finding). Scoped `isStreaming` to require `streamingState.conversationId === currentChat?.id`.
- **Fixed — unguarded `JSON.parse` in the NDJSON stream reader**: `lib/utils/stream.ts`'s `readNdjsonStream` would throw and abort the entire read loop (including any not-yet-processed `done` event) if a single line was malformed, which could leave the UI stuck in a permanent "streaming" state. Now catches and logs+skips malformed lines individually via a `parseNdjsonLine` helper, continuing to process the rest of the stream.
- **Investigated, not changed**: a latent (currently unreachable) trap where `/auth/reset-password` performs a full password change gated only on holding a valid session cookie, not on proof-of-recovery-intent — currently unreachable because no functioning magic-link/email-recovery path exists to land there with a fresh "recovery" session. Flagged for whoever eventually wires up email-based recovery. A minor TOCTOU in the auth failure-counter (`assertAuthAttemptsAllowed` read + `recordAuthFailure` upsert are two round trips) allows a small concurrent-request burst above the nominal 5/20 failure limit before lockout engages — low severity, DB-backed so the lock still eventually holds; not fixed in this pass.

**Files changed**: `README.md`, `AGENTS.md`, `AI_CHECKLIST.md`, `AI_PROJECT.md` (pnpm docs); `eslint.config.mjs`, `components/chat/mode-switcher.tsx`, `components/chat/sidebar.tsx`, `hooks/use-toast.ts`, `lib/ai/chat.ts`, `lib/db/repositories/model-comparisons.ts`, `lib/utils/files.ts` (unchanged, warning was a false positive resolved by the new eslint ignore pattern), `components/chat/chat-image-message.tsx`, `components/chat/message.tsx` (lint fixes); deleted `components/ui/use-toast.ts`; `lib/auth/session.ts` (XFF fix); `app/api/images/generate/route.ts` (credit fix + reservation wiring); `lib/db/repositories/subscriptions.ts`, `lib/billing/log-usage.ts`, `app/api/chat/route.ts` (billing race fix); `lib/chat-context.tsx`, `lib/utils/stream.ts` (streaming fixes).

**Verification**: `pnpm exec tsc --noEmit`, `pnpm exec eslint .` (0 warnings, was 10), `pnpm exec vitest run` (20 files, 88 tests, all passing), and `pnpm exec next build` all pass after every change. The billing reservation SQL was reasoned through carefully (standard atomic conditional-UPDATE pattern, row-level locking) but not exercised against a live concurrent-request test — no live Neon integration test harness exists in this repo per `AI_CHECKLIST.md`'s unit-test scope rules, and running one against a real database wasn't done without being asked.

**Modularization of `lib/chat-context.tsx` (3,883 → 3,414 lines)**: Extracted 8 self-contained feature domains into dependency-injected custom hooks under `hooks/`, following the existing `hooks/useSendMessage.ts` pattern (parent passes state/setters/callbacks in, hook owns its `useCallback`s, parent composes the return value into the context). New files: `usePrismImages.ts`, `useMemoryVault.ts`, `usePulseResearchRoom.ts`, `useModelComparisons.ts`, `useArtifacts.ts`, `useOnboarding.ts`, `usePromptLibrary.ts`, `useCustomAssistants.ts` (the last one covers only CRUD — `setCurrentCustomAssistant` stays in the core, see below). Moved four pure, stateless sort/normalize helpers (`normalizeAppSettingsState`, `sortProjects`, `sortPrompts`, `sortCustomAssistants`) from `lib/chat-context.tsx` into `lib/utils/chat.ts` so both the core and the new hooks can import them without a circular dependency (a first attempt at exporting them directly from `chat-context.tsx` and importing back into a hook created exactly that circularity — caught before it shipped). `ChatContextValue`'s public shape and every consuming component are unchanged; this was an internal reorganization only.
- **Deliberately NOT extracted** (assessed and rejected, not just skipped): Custom assistant *selection* (`setCurrentCustomAssistant`, `customAssistants`/`currentCustomAssistantId` state), Projects, Prompt Workflows/Playbooks, and Settings all turned out to be far more woven into the conversation/send lifecycle than their flat function-name list suggested — e.g. `currentCustomAssistantId` is read/reset from over 15 call sites across auth bootstrap, conversation switching, and the send pipeline, not just its own CRUD functions. Forcing an extraction there would mean the "hook" hands most of its internals back out to the core anyway, adding indirection without real encapsulation. Left in `lib/chat-context.tsx` (now ~3,400 lines: auth, conversation core, the streaming send pipeline, and these four coupled domains).
- **Live-verified in a browser, not just typecheck/build**: started a local dev server against the real `DATABASE_URL`/`OPENROUTER_API_KEY` in `.env.local`, created a disposable QA account (`modularizeqa1782673200` — not yet cleaned up; harmless local test data, self-serve deletable), and exercised: sign-up → auth bootstrap (`loadAuthedData`, which reads `customAssistants`/`promptLibrary`/`projects`/etc. state that several of the new hooks receive as props), the onboarding auto-open-on-empty-workspace path and `skipOnboarding` (both from the new `useOnboarding`), a full chat send/stream round trip on Nova (confirms the earlier cross-conversation-hijack and stop-button-scoping fixes didn't regress normal single-chat sending), and Save Artifact + reopening Artifact Studio to list it (`useArtifacts`). Zero console errors, zero regressions from the refactor itself.
- **Found and fixed a real bug while doing this live verification, unrelated to the refactor**: Save Artifact returned a 500. Root cause: `lib/db/repositories/artifacts.ts`'s `create()` wrapped two inserts in Drizzle's `db.transaction(...)`, but `lib/db/client.ts` uses `drizzle-orm/neon-http`, whose HTTP-based driver does not support interactive transactions at all — this call has presumably never worked. Fixed by making the artifact-row and initial-version-row inserts sequential instead of transactional (documented as a decision in `AI_DECISIONS.md`). Checked `lib/db/repositories/user-purge.ts`, the only other file using `.transaction()` — it correctly uses the raw Neon client's `sql.transaction()` batch API (which the HTTP driver *does* support), a different thing entirely from Drizzle's `db.transaction()`, so it was not affected.

**Files changed (this section)**: new `hooks/usePrismImages.ts`, `hooks/useMemoryVault.ts`, `hooks/usePulseResearchRoom.ts`, `hooks/useModelComparisons.ts`, `hooks/useArtifacts.ts`, `hooks/useOnboarding.ts`, `hooks/usePromptLibrary.ts`, `hooks/useCustomAssistants.ts`; `lib/chat-context.tsx` (extractions); `lib/utils/chat.ts` (relocated helpers); `lib/db/repositories/artifacts.ts` (transaction bug fix).

**Remaining/deferred**: Projects, Prompt Workflows/Playbooks, Settings, and custom-assistant *selection* remain unextracted in `lib/chat-context.tsx` for the coupling reasons above — a future pass could still split them, but it would need to either lift more state into the hooks themselves (bigger, riskier diffs touching many read sites) or accept a thinner "just the mutator functions" extraction like `useCustomAssistants` got. The one disposable QA account created for live verification (`modularizeqa1782673200`) has not been deleted.

## 2026-06-29 - Private Beta Preflight Audit

**Goal**: Explicit user request to run the full private-beta preflight audit against the 20-point checklist in `docs/BETA_LAUNCH_CHECKLIST.md`, verify readiness, and fix only targeted beta-blocking issues — no new features.

**Green checks (verified live against a local dev server + disposable QA accounts, not just code review)**:
- `/admin/system-health`, `/admin`, `/admin/users/[id]` all gated correctly: pages redirect via `requireAdmin()`, APIs return 401/403 via `requireAdminApiUser()`/`requireAuthenticatedUser()`, confirmed live with curl (307/401 for unauthenticated, 403 pattern verified in code for non-admin).
- Required env var names in `AI_PROJECT.md`/`docs/BETA_LAUNCH_CHECKLIST.md` match `.env.local` keys with no real values present in any doc; `.env.local` is gitignored and untracked.
- `neon/migrations/` contains exactly the 19 files in the order documented in `AI_CHECKLIST.md` and `docs/BETA_LAUNCH_CHECKLIST.md` §2 — confirmed by directory listing, not just doc cross-reference.
- Sign up, sign in, sign out, and invalid-password rejection all verified live via real `/api/auth/*` calls with a disposable account: sign-up creates a session, sign-out clears it server-side (subsequent `/api/auth/session` returns 401), wrong password returns a safe generic error with no field-level leak, rate limiting is enforced through `zen_auth_attempts` before sign-in.
- All five text assistants verified live end-to-end through `/api/chat`: Nova/Velora/Axiom/Forge returned correctly attributed, billed responses. Pulse was broken until the fix below; after the fix it streams correctly and shows the honest "no source context available" degradation note since no `TAVILY_API_KEY` is configured locally — confirms the no-key degradation path works.
- `/api/chat` rejects image/Prism requests with a 400 pointing to `/api/images/generate`; image generation through `/api/images/generate` was verified live (real OpenRouter image call, metadata persisted, protected preview URL returned).
- Protected file route `/api/files/object` verified live: 401 unauthenticated, 200 for the owning user, 404 for a second authenticated user attempting the same URL — cross-user image/file access is blocked.
- RAG/Ask Files honesty, search user-scoping, artifacts/versions/shares/template-share token safety, playbook step billing, Model Duel text-only enforcement, Prism Studio ownership, plan-request/admin-activation flow, and dashboard cost-boundary (raw cost/margin admin-only) were all code-audited in depth (file:line evidence) with no beta-blocking issues found. No Stripe/checkout/payment-webhook code exists anywhere in the repo.
- Self-serve/admin purge code (ownership derivation, self-purge blocking, tombstoning, safe grouped previews) matches `AI_TASK_LOG.md`'s 2026-06-20 entry with no regressions — but see the migration-gap blocker below, found only by actually invoking the route.
- `npm run typecheck`, `npm run lint` (0 errors, same 10 pre-existing warnings), `npm run test` (20 files, 88 tests), `npm run build` (all routes compile), and `npx playwright test` (12 passed, 1 intentionally skipped pending a dedicated Neon branch) all pass after the fixes below.
- Mobile (375px): `/pricing`, an assistant page (`/nova`), the unauthenticated auth gate, and the authenticated chat workspace all render with zero horizontal overflow and no console errors. `/dashboard` had a real overflow bug, fixed below. `/admin/system-health` could not be exercised live (no admin credentials available without guessing a real local admin's password) — its layout was code-audited and looks low-risk, but is unverified live; flagged below.

**Blockers fixed**:
1. **Pulse was broken for every free/basic-tier user.** `lib/config/assistants.ts` mapped free/basic tier `pulse` to `x-ai/grok-4.1-fast`, which OpenRouter now reports as deprecated, causing every Pulse send to fail mid-stream with a recoverable-but-real error. Pro/ultra/prime tiers already used the working `x-ai/grok-4.20`. Fixed by pointing free/basic at `x-ai/grok-4.20` (cost entry already existed in `lib/config/pricing.ts`, so no pricing gap). Verified live: Pulse now streams a full response, with the honest no-Tavily-key degradation note still present.
2. **`/dashboard` had a real horizontal-overflow bug at mobile width.** The "Recent conversations" and "Recent image generations" cards (`app/dashboard/page.tsx`) used `truncate` on a flex child without `min-w-0`, and the surrounding CSS Grid items also lacked `min-w-0` — both flex and grid items default to `min-width: auto`, so the long un-wrapped title text expanded its container instead of truncating. Verified via Playwright DOM inspection (found exact offending elements, not just a visual glance), confirmed `scrollWidth` dropped from 544px to exactly 375px after the fix, full-page screenshot confirms clean rendering.
3. **Password reset had no working admin-assisted path.** `/api/auth/password/reset-request` correctly tells the user reset is admin-assisted, but there was no admin-side tool anywhere to actually act on that — `/admin/users/[id]` had no password control. Per explicit user decision (not a unilateral feature add), added a minimal, scoped admin capability: a new `POST /api/admin/users/[id]/password` route (`requireAdminApiUser`-gated, 8-character minimum, reuses the existing scrypt hashing path via a new `setUserPasswordByAdmin()` in `lib/auth/session.ts`, revokes all of the target user's existing sessions via a new `revokeAllSessions()`, and writes an `admin_user_password_reset` audit log entry) plus a `UserPasswordResetCard` client component wired into `/admin/users/[id]`. No email provider or token table was introduced — this stays within the existing architecture. Verified live end-to-end with disposable QA accounts: a promoted QA admin reset a second QA user's password; the target's prior session immediately returned 401, the old password was rejected, the new password worked, a non-admin caller got 403, an unauthenticated caller got 401, and a sub-8-character password got 400.
4. **This local dev Neon database was missing the `zen_feedback_events` table** (migration #17, `neon/migrations/20260616_zenquanta_feedback_events.sql`), discovered by actually invoking `/api/account/delete-data` and hitting a 500 (`relation "public.zen_feedback_events" does not exist` inside `NeonUserPurgeRepository.preview`, `lib/db/repositories/user-purge.ts:97`). The code was correct — this was a migration-application gap in this one local database, not a bug. Per explicit user decision, applied migrations #17 and #18 (`20260616_zenquanta_incremental_performance_indexes.sql`, additive indexes only) directly to the local `DATABASE_URL` via `psql`; confirmed both via `information_schema` before/after and a successful live `/api/account/delete-data` call afterward. **This only fixes this local dev database** — confirm all 19 migrations are applied to whichever Neon database actually backs the beta before relying on deletion/purge there.

5. **`/admin/system-health`'s header used a layout pattern inconsistent with the rest of the app and risked clipping/awkward stacking at mobile width** (`flex items-center justify-between` with no mobile breakpoint, plus a right-aligned `items-end` block that would sit oddly under left-aligned text once stacked) — the same anti-pattern already fixed on `/dashboard` earlier in this audit. Fixed to `flex flex-col gap-4 ... sm:flex-row sm:items-center sm:justify-between`, matching the established header pattern used on `/dashboard` and `/admin/users/[id]`. Verified live at 375px: promoted a fresh disposable QA account to admin via a direct, scoped DB role update (not by guessing the real local admin's password), confirmed zero horizontal overflow and a clean stacked layout via screenshot, then deleted the QA account through self-serve deletion afterward.

**Known limitations / informational**:
- `docs/manual-product-smoke-test.md`'s "Password reset route behavior" section and `docs/BETA_LAUNCH_CHECKLIST.md` §16 were updated to describe the real admin-assisted flow (no self-serve email/token reset exists) instead of describing token states that were never backed by working code.
- All five disposable QA accounts created during this audit (two for general flow verification, two for the admin password-reset test, one for the system-health mobile check) were cleaned up via the app's own self-serve full-account deletion — none remain in the local database.
- Pre-existing, unchanged-by-this-audit: the destructive purge Playwright E2E test remains intentionally skipped pending a dedicated empty/schema-only Neon branch (per the 2026-06-20 entry); Tavily-with-key and GitHub integration paths could not be exercised locally (no `TAVILY_API_KEY`/GitHub App configured in this environment) — both degrade honestly without a key, which was verified.

**Files changed**:
- `lib/config/assistants.ts` — free/basic tier `pulse` model id `x-ai/grok-4.1-fast` → `x-ai/grok-4.20`.
- `app/dashboard/page.tsx` — added `min-w-0` to the "Recent conversations"/"Recent image generations" grid-item Cards and their truncated title `<p>` elements, and `shrink-0` to their adjacent badges, fixing real mobile horizontal overflow.
- `lib/auth/session.ts` — added `setUserPasswordByAdmin()` and `revokeAllSessions()`.
- `app/api/admin/users/[id]/password/route.ts` — new admin-only password-reset route.
- `components/admin/user-password-reset-card.tsx` — new admin UI card.
- `app/admin/users/[id]/page.tsx` — wired in the new card.
- `docs/BETA_LAUNCH_CHECKLIST.md`, `docs/manual-product-smoke-test.md` — corrected password-reset expectations to match real behavior.
- `app/admin/system-health/page.tsx` — mobile-responsive header (`flex-col` + `sm:flex-row`), matching the pattern already used on `/dashboard` and `/admin/users/[id]`.
- Local-database-only (not a code change): applied `neon/migrations/20260616_zenquanta_feedback_events.sql` and `20260616_zenquanta_incremental_performance_indexes.sql` to the local dev `DATABASE_URL`.

**Beta readiness recommendation**: **Ready, pending one environment check.** Core product surfaces (auth including admin-assisted password reset, all five text assistants, Prism, file/search/artifact/playbook ownership boundaries, billing/cost boundaries, admin gating, self-serve/admin deletion) are solid and verified live end-to-end, not just by inspection, and all real issues found (deprecated Pulse model, dashboard mobile overflow, system-health mobile layout) are fixed and verified, including on a real mobile viewport with an authenticated admin session. The only remaining action item is operational, not code: confirm all 19 migrations are actually applied to whichever Neon database backs the beta — this audit caught a real missing-table gap in the local dev DB by exercising the deletion path live rather than trusting documentation, and that database's gap has only been fixed for the local environment, not necessarily the beta one.

## 2026-06-29 - UI/Flow Redesign and Mobile Responsiveness Pass

**Goal**: Explicit user request to improve the app's UI/flow and make it mobile-friendly, using the `frontend-design` skill plus three fetched design references (`DESIGN.md` = runwayml, `together.ai/DESIGN.md`, `x.ai/DESIGN.md`) combined into one direction. This overrides the default "preserve current styling" rule in `AGENTS.md` for this task only.

**Direction**: Kept the existing dark oklch token system, Geist/Geist Mono fonts, and the six per-assistant accent colors (signature device, not replaced). Added: a shared `.eyebrow` utility (uppercase Geist Mono label) in `app/globals.css`, a `cta` pill button variant and `eyebrow` badge variant in `components/ui/button.tsx`/`badge.tsx`. Removed dead `.glow-*` CSS (the real glow mechanism is `getModeGlow()` in `lib/mode-utils.tsx`, which never referenced those classes).

**Mobile fixes (the actual product surface)**:
- `components/chat/sidebar.tsx` + `chat-layout.tsx`: sidebar now renders as a `Sheet` overlay with backdrop below 768px instead of pushing/crushing the chat column; defaults closed on phones on first mount; auto-closes on navigation actions.
- `components/chat/settings-panel.tsx`: was a hardcoded `w-80` `<aside>` with no responsive handling (would overflow on phones) — now a full-screen overlay below `md`, unchanged above it.
- Audited `artifact-studio.tsx`, `playbook-studio.tsx`, `memory-vault.tsx`, `prism-studio.tsx`, `pulse-research-room.tsx`, `ask-files-panel.tsx`, `github-integration-panel.tsx` — all are Radix `Dialog`-based and already mobile-safe (`w-[calc(100vw-1rem)]` or base responsive max-width); no changes needed.
- `components/chat/header.tsx`: added a mobile-only overflow menu folding help/session-settings/share/admin behind one trigger.
- `components/chat/composer.tsx`: send/stop buttons bumped from `h-9` to `h-10` for touch target; safe-area bottom padding was already present.
- Found and fixed a pre-existing bug while testing: a floating absolutely-positioned "reopen sidebar" button in `chat-layout.tsx` exactly overlapped the header's own identical hamburger button (both called `toggleSidebar`), making the header's button dead/unreachable. Removed the redundant floating one.

**Visual redesign**: `components/assistants/assistant-brand-page.tsx` (replaced repeated `rounded-3xl` card grid with eyebrow+display-headline hero and hairline-divided rows), `components/auth/auth-gate.tsx` (pill sign-in/sign-up toggle, mono eyebrow labels, fixed `h-screen items-center` → `min-h-screen` + scroll so the form doesn't clip on short mobile viewports with the keyboard open), `app/pricing/page.tsx` (plan cards → hairline-divided slab, pill CTAs).

**Verification**: `npm run typecheck`, `npm run lint` (same 10 pre-existing warnings, 0 errors), and `npm run build` all passed after every phase. Manually drove the app with Playwright + chromium at 375px/1280px: public assistant page and auth gate screenshots confirmed the new visual language; signed in with a temporary test account (`verifybot1782673032859` — not yet cleaned up, safe to purge) and confirmed the sidebar opens as a true overlay (not a push panel) on mobile, closes on backdrop click, and the settings panel renders as a usable full-screen overlay instead of the old crushed `w-80` panel.

**Not changed**: Admin pages, dashboard data views, knowledge library internals, and all API/billing/auth logic — visual-only pass, per the user-approved plan.

---

## 2026-06-20 - Self-Serve Data Deletion Verification

**Goal**: Audit the existing self-serve/admin purge implementation, add focused security and orchestration coverage, and run destructive end-to-end verification only against an explicitly approved dedicated Neon branch and non-production storage namespace.

**Audit result**: The existing purge repository covers all current user-owned product tables directly or through verified foreign-key cascades. Self-service routes derive their target only from the authenticated session; admin routes re-check the admin role in the handler, block self-purge, and use the protected path target. Full-account deletion removes auth access and tombstones identity rows. Object refs are collected before the database transaction, and protected reads depend on metadata that the transaction removes before best-effort object cleanup.

**Implemented**:
- Expanded purge helper tests for confirmation edge cases, invalid scopes, normalized counts, exact preview keys, unsafe/deduplicated object refs, and tombstone fields.
- Hardened preview sanitization so case/underscore variants and token/secret/password/private-provider URL fields cannot survive future sanitizer callers.
- Added service tests proving ref collection precedes the database transaction, object deletion follows it, invalid confirmation performs no deletion, and partial provider failures return counts without leaking the caught error.
- Added route tests proving guessed body IDs cannot change self-service scope, full-account responses clear cookies, non-admin access is rejected, admin self-purge is blocked, and admin audit payloads remain grouped/safe.
- Added a guarded Playwright fixture that creates disposable accounts through real auth routes, seeds all current purge categories, uploads real local neutral-storage objects, and verifies workspace deletion, full-account sign-out/tombstoning, admin purge, protected 404s, object removal, safe responses/audits, and an unaffected control user.
- Updated `AI_CHECKLIST.md`, `docs/BETA_LAUNCH_CHECKLIST.md`, `docs/HANDOFF.md`, and `tests/e2e/README.md` with the repeatable safety-gated workflow and current verification boundary.

**Verification**:
- Focused purge tests passed: 3 files, 15 tests.
- `npm run test` passed: 20 files, 88 tests.
- `npm run typecheck` passed.
- `npm run lint` passed with the same 10 existing warnings and 0 errors.
- `npm run build` passed and lists all four purge routes as dynamic handlers.
- `git diff --check` plus explicit checks for the three new untracked test files passed.
- `npm run test:e2e -- user-purge.spec.ts` started the app and safely skipped the destructive test because the dedicated opt-in/database variables were absent.
- Browser fallback: the `agent-browser` CLI was unavailable. The existing Playwright smoke suite loaded all six public assistant pages, while six unauthenticated workspace/auth-gate checks timed out at `Restoring your Zenquanta workspace…`; this is outside the purge code path and remains a separate environment/runtime risk.

**Remaining risks**: Seeded Neon/object deletion, protected 404s, actual sign-out, and real admin purge are not yet runtime-proven because no dedicated empty/schema-only branch was supplied. The harness currently forces local neutral storage under `/tmp`; if beta uses S3/R2, repeat object cleanup against a non-production bucket. Do not mark `docs/BETA_LAUNCH_CHECKLIST.md` §19 complete until that run passes.

**Not changed**: No public route shape, tombstone decision, schema/migration, dependency, Supabase, Stripe, payment automation, or unrelated `pnpm-workspace.yaml` change was introduced.

---

## 2026-06-17 - Manual Per-User Cleanup SQL Support Guide

**Goal**: Replace vague beta manual cleanup fallback notes with an operator-safe SQL guide for one-user cleanup when self-serve/admin purge fails or needs manual follow-up.

**Files changed**:
- `docs/support/per-user-cleanup-sql.md` — New support guide covering warnings, target verification, object-ref export, dry-run counts, workspace-data cleanup SQL, full-account tombstone cleanup SQL, cascade notes, object-storage cleanup, verification queries, protected URL checks, and safe audit/support logging.
- `docs/BETA_LAUNCH_CHECKLIST.md` — §19 now points operators to the support SQL playbook as the manual fallback path.

**Coverage**: The guide covers current user-owned Neon tables from `lib/db/schema.ts`, including auth/profile/session/credential rows, conversations/messages/memory, projects, prompts, workflows/steps/runs, custom assistants, artifacts/versions/shares, template shares, model comparisons/candidates, files/chunks, generated images/image events, usage/subscriptions/plan requests/overrides, recommendation/feedback telemetry, GitHub integration accounts/items, and admin audit references.

**Assumptions**: Self-serve/admin purge remains the primary path. The SQL guide is fallback-only, does not execute destructive SQL itself, does not hard-delete `zen_users`, and keeps `.env.local`/secrets out of docs.

**Verification**: `git diff --check` passed. Typecheck, lint, and build were skipped because this is docs-only.

---

## 2026-06-17 - AI_CHECKLIST Neon Migration Order Sync

**Goal**: Verify and record that `AI_CHECKLIST.md` uses the current authoritative Neon migration order.

**Verified**:
- Inspected `neon/migrations/` and confirmed the 19 current Neon migration files are present.
- Cross-checked `AI_CHECKLIST.md` against `docs/BETA_LAUNCH_CHECKLIST.md`; both list the same 19-file order, including `20260616_zenquanta_artifact_shares.sql`, `20260616_zenquanta_feedback_events.sql`, `20260616_zenquanta_incremental_performance_indexes.sql`, and `20260617_zenquanta_template_shares.sql`.

**Files changed**:
- `AI_TASK_LOG.md` — Added this docs-only verification entry.

**Not changed**: Runtime code, `.env.example`, Supabase, Stripe, and the existing uncommitted purge implementation were not touched for this task.

**Checks**: `git diff --check` passed. Typecheck, lint, and build were skipped because this was a docs-only verification/logging pass.

---

## 2026-06-17 - Self-Serve Data Deletion / User Purge v1

**Goal**: Add foreground, authenticated deletion flows for user workspace-data deletion, user full-account deletion, and admin target-user purge.

**Implemented**:
- Added shared purge types plus pure validation/sanitization helpers for scopes, typed confirmations, safe grouped previews/results, object-ref normalization, deletion-order documentation, and tombstone patches.
- Added server-only purge repository/service layers that collect upload/generated-image object refs first, revoke database access through scoped deletes/tombstoning, then attempt object-store deletion best-effort.
- Added protected routes: `POST /api/account/delete-data/preview`, `POST /api/account/delete-data`, `POST /api/admin/users/[id]/purge/preview`, and `POST /api/admin/users/[id]/purge`.
- Added Settings Danger Zone controls for users and an admin purge card on `/admin/users/[id]`, including preview summaries, scope selection, typed confirmations, self-purge prevention for admins, and full-account sign-out redirect acknowledgement.
- Updated project/checklist/beta/decision docs for the tombstone-account decision, route coverage, 19-file migration list, and beta deletion verification.

**Safety behavior**: Preview/result payloads expose grouped counts only. They do not expose bucket names, storage keys, source URLs, content, raw model costs, provider tokens, or secrets. Full-account deletion preserves scrubbed `zen_users` / `zen_profiles` rows so admin audit references remain intact.

**Verification**:
- `npm run test -- --run tests/user-purge-utils.test.ts` passed.
- `npm run test` passed: 18 files, 78 tests.
- `npm run typecheck` passed.
- `npm run lint` passed with 10 existing warnings and 0 errors.
- `npm run build` passed.
- `git diff --check` passed.

**Remaining risks**: No seeded Neon/browser manual QA was run yet, so the first staging pass should test user data-only deletion, user full-account deletion, admin purge, self-purge blocking, protected file/image 404s after purge, and safe partial object-cleanup reporting.

---

## 2026-06-17 - Developer Handoff Doc

**Goal**: Give the next coding agent (ChatGPT/Codex) a single self-contained entry point to continue the project. Documentation only.

**Files changed**:
- `docs/HANDOFF.md` — New handoff doc: TL;DR, non-negotiable ground rules (no Supabase/Stripe, secrets server-only, no `.env.example`, separate text/image transports, where each concern lives), required-reading order, current shipped state, environment status, prioritized open work, definition of done, and the handoff-back protocol.

**Environment status captured**: Operator confirms Neon is running, an admin user exists in `zen_profiles`, and all 19 Neon migrations are applied — including the three newest (`20260616_zenquanta_artifact_shares`, `20260616_zenquanta_feedback_events`, `20260617_zenquanta_template_shares`), which the operator ran on 2026-06-16/17. `/admin/system-health` is noted as an optional green-light sanity check, not a required remediation step.

**Open work flagged for the next agent (prioritized)**: (1) self-serve data deletion to replace the manual `BETA_LAUNCH_CHECKLIST.md` §19 cleanup; (2) sync the 16→19 migration list in `AI_CHECKLIST.md`; (3) draft the exact per-user cleanup query set.

**Verified**: Doc-only change. No runtime code modified, so typecheck/lint/build were not re-run.

**Next steps**: Point ChatGPT/Codex at `docs/HANDOFF.md` (with repo access) or share it plus the six required-reading files (plain web, no secrets). Default first task is self-serve data deletion.

---

## 2026-06-17 - Beta Launch Checklist & Bug Bash Plan

**Goal**: Prepare Zenquanta AI for a small private beta with an operator/admin-facing readiness checklist and tester bug-bash plan. Documentation only.

**Files changed**:
- `docs/BETA_LAUNCH_CHECKLIST.md` — New 20-section beta launch + bug bash doc: required env vars, Neon migration order (authoritative 19-file list), admin setup, storage provider checks, OpenRouter/Tavily/embeddings/GitHub verification, manual plan request + admin activation, file/search privacy, usage/billing + Prism credit enforcement, mobile checks, known limitations, bug report template, rollback plan, manual data-deletion notes, first 10 tester tasks, and a sign-off block. Points operators at `/admin/system-health` as the pre-flight.
- `ZENQUANTA_PROJECT_CONTEXT.md` — Fixed two stale `.env.example` references (lines ~87 and ~716) to reflect that secrets live in `.env.local` and there is no committed `.env.example`.

**`.env.example` → `.env.local` sweep**: Searched the repo for `.env.example` references. The recent docs (`README.md`, `AGENTS.md`, `CLAUDE.md`, `AI_CHECKLIST.md`, `AI_PROJECT.md`) and the System Health validator already use `.env.local` correctly. Only `ZENQUANTA_PROJECT_CONTEXT.md` still pointed at `.env.example` as a live file — now corrected. Remaining `.env.example` mentions are intentional policy statements ("do not recreate/add to `.env.example` unless explicitly requested") in `AGENTS.md`, `CLAUDE.md`, and the integration plan docs, plus one historical note in this log — all left as-is. No `.env.example` file exists on disk; `.gitignore` still ignores it (harmless).

**Beta readiness status**: Documentation and pre-flight tooling are ready. Core platform (Neon auth, chat, projects, billing/usage, admin) is implemented. Open items before invites are operational, not code: apply all 19 Neon migrations to a fresh DB, set required env vars, promote an admin in `zen_profiles`, choose a durable storage provider (s3/r2) if uploads must persist, take a Neon snapshot for rollback, and draft the per-user manual-deletion query set (no self-serve account deletion exists yet).

**Verified**: Doc-only change. No runtime code modified, so typecheck/lint/build were not re-run for this task. Migration list and env var names cross-checked against `neon/migrations/`, `AI_CHECKLIST.md`, and `AI_PROJECT.md`.

**Next steps**: Operator works through `docs/BETA_LAUNCH_CHECKLIST.md` §1–§4, confirms `/admin/system-health` shows 0 missing required services, then sends the §20 task script to the first cohort. Consider a future self-serve data-deletion endpoint to replace the manual cleanup in §19.

---

## 2026-06-17 - Shareable Prompt and Playbook Templates v1

**Goal**: Allow users to create controlled share links for prompt templates and AI Playbook templates. Public visitors can preview the template and copy it into their own workspace. Run history, conversations, and project data are never exposed.

**Files changed**:
- `lib/db/schema.ts` — Added `zenTemplateShares` table and `templateShareTypeCheck` constant
- `neon/migrations/20260617_zenquanta_template_shares.sql` — Migration SQL for `zen_template_shares`
- `types/index.ts` — Added `TemplateShareType`, `TemplateShareVisibility`, `TemplateShareInfo`, `TemplateShareCreated`, `TemplateShareInput`, `PublicPromptShare`, `PublicPlaybookShare`, `PublicTemplateShare`, `TemplateCopyResult`
- `lib/db/repositories/template-shares.ts` — New repository: `create`, `list`, `revoke`, `getPublicByToken`, `copyToWorkspace`
- `lib/db/repositories/index.ts` — Exports `neonTemplateSharesRepository`
- `app/api/prompts/[id]/shares/route.ts` — `GET` (list) + `POST` (create) for prompt shares
- `app/api/prompts/[id]/shares/[shareId]/route.ts` — `DELETE` (revoke) for prompt shares
- `app/api/prompt-workflows/[id]/shares/route.ts` — `GET` (list) + `POST` (create) for playbook shares
- `app/api/prompt-workflows/[id]/shares/[shareId]/route.ts` — `DELETE` (revoke) for playbook shares
- `app/api/share/templates/[token]/route.ts` — Public JSON API (no auth)
- `app/api/share/templates/[token]/copy/route.ts` — Copy-to-workspace endpoint (auth required)
- `app/share/templates/[token]/page.tsx` — Public read-only server component; shows prompt content or playbook steps
- `app/share/templates/[token]/copy-button.tsx` — Client component for copy-into-workspace CTA
- `components/chat/prompt-library-button.tsx` — Share button on prompt cards + playbook cards, share dialog (create/copy/revoke)

**Architecture decisions**:
- **Single table**: `zen_template_shares` stores both prompt and playbook shares with `template_type: 'prompt' | 'playbook'` and `template_id: text` (no FK, since prompts use a composite PK `(user_id, id)` which cannot be referenced with a simple FK). Share records linger as audit trail after template deletion; `getPublicByToken` returns null if the underlying template no longer exists.
- **Token model**: Identical to artifact shares — 32 random bytes base64url (43 chars). Raw token returned only on creation; SHA-256 hash stored in DB. Token validation regex `/^[A-Za-z0-9_-]{40,60}$/` on public routes.
- **Copy-to-workspace**: `POST /api/share/templates/[token]/copy` (auth required). For prompts: inserts into `zen_prompt_library`. For playbooks: inserts into `zen_prompt_workflows` + `zen_prompt_workflow_steps` with fresh IDs. No run history, no project scoping, no conversation data copied.
- **Public page**: `/share/templates/[token]` server component. Shows prompt content (monospace) or playbook title/description/variables/steps (assistant + template text). `CopyToWorkspaceButton` client component redirects unauthenticated users to `/sign-in?next=...`.
- **Private data**: `getPublicByToken` never returns `userId`, `projectId`, `conversationId`, run history, or workflow run outputs. For playbooks, step IDs are excluded from the public payload.
- **Revocation**: `revokedAt` field; revoked links immediately return 404 at the public API and page level.
- **Expiry**: `expiresAt` nullable; checked server-side.

**Verified**: `npm run typecheck` clean, `npm run lint` 0 errors (10 pre-existing warnings), `npm run build` succeeds with all 8 new routes in the manifest.

**Remaining risks**:
- Migration `neon/migrations/20260617_zenquanta_template_shares.sql` must be run in Neon before the feature is live.
- `template_id` has no FK — if a prompt or playbook is deleted, its shares become silently 404-returning dead links (audit trail preserved, no cascade). This is intentional.
- Unauthenticated copy flow redirects to `/sign-in` which must exist (it does in this repo).

**Next steps**: Run the Neon migration. Consider surfacing "shared" badge on prompt/playbook cards if they have active share links (requires client-side share count check).

---

## 2026-06-17 - Production Environment Validator v1

**Goal**: Provide admins a server-only diagnostic tool at `/admin/system-health` (and `GET /api/admin/system-health`) that checks whether all required env vars and service dependencies are configured, without exposing any secret values.

**Files changed**:
- `types/index.ts` — Added `HealthStatus`, `HealthCheck`, `SystemHealthReport`
- `lib/system-health/checks.ts` — New server-only module: 12 named checks across DB, AI services, web search, embeddings, storage, and environment. Returns `SystemHealthReport` with per-check status and summary counts.
- `app/api/admin/system-health/route.ts` — Admin-only `GET` route. Returns `SystemHealthReport` JSON. Protected by `requireAdminApiUser`.
- `app/admin/system-health/page.tsx` — Admin-only server component with `requireAdmin`. Renders grouped check cards (Database / AI Services / Web Search / RAG / File Storage / Environment). Shows healthy/degraded/missing/unknown status with icons and summary chips.
- `app/admin/page.tsx` — Added "System health" button link in the header next to "Back to app".

**Checks implemented**:
1. `db_url` — DATABASE_URL / NEON_DATABASE_URL / POSTGRES_URL presence. Shows sanitized host, never credentials.
2. `db_connect` — Live `SELECT 1` via Neon client. Reports connection failure message safely.
3. `db_schema` — Queries `information_schema.tables` for 5 expected tables (`zen_users`, `zen_subscriptions`, `zen_auth_sessions`, `zen_artifact_shares`, `zen_template_shares`). Lists missing tables when any absent.
4. `pgvector` — Queries `pg_available_extensions WHERE name = 'vector'`. Distinguishes not-available vs available-but-not-installed vs installed (with version).
5. `openrouter` — OPENROUTER_API_KEY present via `hasOpenRouterConfig()`.
6. `tavily` — TAVILY_API_KEY via `hasWebSearchConfig()`. Missing = degraded (not missing), Pulse degrades gracefully.
7. `embeddings` — EMBEDDINGS_API_KEY or OPENAI_API_KEY via `hasEmbeddingConfig()`. Missing = degraded; shows current model name.
8. `storage_provider` — FILE_STORAGE_PROVIDER resolved value. Local in production = degraded with warning.
9. `storage_creds` — If s3/r2, checks endpoint/access-key-id/secret/bucket all present. Shows endpoint hostname and bucket name (no secret values).
10. `auth_security` — NODE_ENV check: production = cookies use Secure flag; non-production = degraded with dev note.
11. `app_url` — NEXT_PUBLIC_APP_URL or VERCEL_URL; missing = degraded (share links may use wrong base URL).
12. `deploy_env` — VERCEL_ENV / NODE_ENV detection for deployment context.

**Architecture decisions**:
- No secret values ever returned. Endpoint URLs truncated to hostname only. Credentials shown as `(configured)` or listed as missing by var name only.
- All DB checks wrapped in try/catch — a check failure captures the error message safely and returns `unknown` or `missing`, never throws through the route.
- DB checks run in parallel (`Promise.all`) to minimize latency.
- `dynamic = 'force-dynamic'` on the page so checks always run fresh (not cached at build time).
- Never calls paid AI APIs (no OpenRouter completions, no embedding generation, no Tavily search). DB `SELECT 1` and extension queries are free reads.

**Verified**: `npm run typecheck` clean, `npm run lint` 0 errors, `npm run build` succeeds with 2 new routes in manifest.

---

## 2026-06-17 - Shareable Artifact Links v1

**Goal**: Allow users to create controlled share links for selected artifacts. Links are read-only. Revoked links stop working immediately.

**Files changed**:
- `lib/db/schema.ts` — Added `zenArtifactShares` table and `artifactShareVisibilityCheck` constant
- `neon/migrations/20260616_zenquanta_artifact_shares.sql` — Migration SQL for `zen_artifact_shares`
- `types/index.ts` — Added `ArtifactShareVisibility`, `ArtifactShareInfo`, `ArtifactShareCreated`, `ArtifactShareInput`, `PublicArtifactShare`
- `lib/db/repositories/artifact-shares.ts` — New repository: `create`, `list`, `revoke`, `getPublicByToken`
- `lib/db/repositories/index.ts` — Exports `neonArtifactSharesRepository`
- `app/api/artifacts/[id]/shares/route.ts` — `GET` (list) + `POST` (create)
- `app/api/artifacts/[id]/shares/[shareId]/route.ts` — `DELETE` (revoke)
- `app/api/share/artifacts/[token]/route.ts` — Public JSON API (no auth)
- `app/share/artifacts/[token]/page.tsx` — Public read-only server component page
- `components/chat/artifact-studio.tsx` — Share button + Share dialog (create/copy/revoke)

**Architecture decisions**:
- **Token model**: 32 random bytes as `base64url` (43 chars). Raw token never stored — only SHA-256 hash stored in `zen_artifact_shares.token_hash`. Unique index on hash. Identical to session token pattern in `lib/auth/session.ts`.
- **Token validation**: Public routes reject tokens that don't match `/^[A-Za-z0-9_-]{40,60}$/` before hitting DB.
- **Visibility**: `public_link` (no auth required) or `private_link` (same token-gate, future use). Both currently accessible by anyone with the token — token entropy provides the access control.
- **Expiry**: `expiresAt` nullable. Checked server-side on `getPublicByToken` — expired links return null.
- **Revocation**: Sets `revokedAt`. `list()` filters `revokedAt IS NULL`. `getPublicByToken` returns null if revoked. Revoked at token remains in DB for audit.
- **Public page**: `/share/artifacts/[token]` is a Next.js server component. Calls repository directly (no auth check). Exposes only `title`, `artifactType`, `content` — no userId, projectId, conversationId, metadata.
- **Token delivery**: Raw token returned only on `POST` creation response (`ArtifactShareCreated`). Not stored in client state after the dialog closes.
- **Security**: Share links expose no project files, conversation history, or owner workspace data. `Content-Security-Policy` and `robots` meta on the public page set to `noindex` for private links.

**Verified**: `npm run typecheck` clean, `npm run lint` 0 errors, `npm run build` succeeds with all 4 new routes in the manifest.

**Remaining risks**:
- Migration must be run in Neon before the share feature can be used. Artifact owners will need to run `20260616_zenquanta_artifact_shares.sql`.
- Token validation regex assumes base64url output from Node `randomBytes(32).toString('base64url')` (always 43 chars). Range 40–60 gives buffer if source changes.
- `private_link` and `public_link` are currently equivalent in access (token is the only gate). Future implementation could require Zenquanta login for `private_link`.

**Next steps**: Run the Neon migration. Consider adding a per-artifact share count to the `ProjectHomeArtifactSummary` or workspace home surface if shares become a first-class metric.

---

## 2026-06-16 - Notion Read-Only Integration Plan

**Goal**: Plan a safe Notion integration for importing selected pages and databases into Zenquanta projects and Ask Files. Documentation only — no code changed.

**Deliverable**: `docs/integrations/notion-readonly-plan.md`

**Key decisions documented**:

- **OAuth model**: Notion uses capability-based permissions set at the developer portal, not OAuth scope strings. Required capabilities: `read_content` + `read_user_info` only. Insert/update capabilities must remain off. The user selects which pages to share inside Notion's OAuth UI — no folder-browser UX is needed post-connect.
- **Token storage**: Notion access tokens are permanent (no expiry, no refresh_token). AES-256-GCM encryption using existing `zen_integration_accounts.encrypted_token_payload` column. Key from `NOTION_TOKEN_ENCRYPTION_KEY` env var. No refresh logic needed — simpler than Drive, but permanent tokens carry higher breach risk.
- **Content assembly**: Notion has no binary file download. Pages are assembled by recursively fetching blocks via `GET /v1/blocks/{id}/children` (paginated, depth limit 6, block count limit 500) and rendering to Markdown using a `renderBlocksToMarkdown()` function. Output stored as `mimeType: 'text/markdown'` bytes, fed into the existing `indexUploadedFileForKnowledge()` pipeline unchanged.
- **Database import**: `POST /v1/databases/{id}/query` (cap 50 rows). Properties extracted as a structured Markdown document — block-level content per row is not fetched in v1.
- **Schema change**: Update `integrationProviderCheck` in `lib/db/schema.ts` to include `'notion'` (and `'google-drive'` if that migration has not yet run). One migration SQL statement.
- **Import path**: Mirrors GitHub import — `zen_files` with `provider: 'external'`, `bucket: null`, `storagePath: null`, `metadata.source: 'notion'`. Tracked in `zen_integration_items` with `externalId: 'notion-page:{pageId}'` or `'notion-db:{databaseId}'`.
- **Revocation**: No public Notion revoke endpoint. DELETE route clears `encryptedTokenPayload`, sets `status: 'revoked'`. UI instructs user to also revoke from their Notion connected apps settings.
- **Re-import optimization**: Store `lastEditedTime` from Notion in item metadata. On reimport, check current `lastEditedTime` before re-fetching all blocks.
- **No background sync in v1**: Notion has no public webhook/push API for page changes. User-triggered only.
- **Rate limiting**: Notion enforces 3 req/sec per integration. Block pagination calls must be sequential.

**New lib files planned**: `lib/integrations/notion.ts`, `lib/integrations/notion-import.ts`, `lib/integrations/notion-tokens.ts`

**New API routes planned** (7): `GET/DELETE /api/integrations/notion`, `GET /api/integrations/notion/connect`, `GET /api/integrations/notion/callback`, `GET /api/integrations/notion/pages`, `POST /api/integrations/notion/import`, `POST /api/integrations/notion/reimport`

**New env vars**: `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`, `NOTION_CALLBACK_URL`, `NOTION_TOKEN_ENCRYPTION_KEY`

**Security risks addressed**: permanent token (no expiry) requires encryption key discipline, CSRF state cookie, block ID validation (UUID format check), memory limit on block fetch, rate limit handling, 401 detection sets `status: 'error'`.

**No code changed. No app behavior modified.** Ready for implementation when requested.

## 2026-06-16 - Google Drive Read-Only Integration Plan

**Goal**: Plan a safe Google Drive integration for importing selected Drive documents into Zenquanta projects and Ask Files. Documentation only — no code changed.

**Deliverable**: `docs/integrations/google-drive-readonly-plan.md`

**Key decisions documented**:

- **OAuth scope**: `drive.readonly` recommended for v1 (enables folder browsing + content download). `drive.file` + Google Picker deferred to a future version. Always request `offline` access for `refresh_token`.
- **Token storage**: Use existing `zen_integration_accounts.encrypted_token_payload` (jsonb column already present, currently null for GitHub). AES-256-GCM encryption with key from `GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY` env var; plaintext tokens never stored. Token refresh logic detects expiry before each API call and updates DB.
- **Schema change**: Update `integrationProviderCheck` in `lib/db/schema.ts` to include `'google-drive'`. One migration SQL statement to update the check constraint on `zen_integration_accounts`. No new tables needed.
- **Import path**: Mirrors GitHub import exactly — Drive bytes fetched server-side, written to `zen_files` with `provider: 'external'` (no object storage), indexed via `indexUploadedFileForKnowledge()`, tracked in `zen_integration_items` with `externalId = driveFileId`.
- **Google Workspace files**: Google Doc → export DOCX → mammoth; Google Sheet → export CSV. Slides/Drawings/Scripts skipped in v1.
- **File types**: All existing Zenquanta extractors apply (PDF, DOCX, TXT, CSV, Markdown, JSON, code).
- **No background sync in v1**: All imports are user-triggered. No webhooks, cron, or Changes API.
- **Revocation**: DELETE route decrypts token, calls Google revoke endpoint, clears `encryptedTokenPayload`, sets status `revoked`. Imported files remain as Zenquanta knowledge.
- **Drive API 401/403**: Treated as implicit revocation; sets status to `error` and surfaces reconnect CTA.
- **Knowledge Library**: `metadata.source = 'google-drive'` already surfaced by `fileToIntelligence`. Option A: add "Google Drive" tab alongside GitHub tab. Option B (deferred): show Drive badge in "All" tab only.

**New lib files planned**: `lib/integrations/google-drive.ts`, `lib/integrations/google-drive-import.ts`, `lib/integrations/google-drive-tokens.ts`

**New API routes planned** (7): `GET/DELETE /api/integrations/google-drive`, `GET /api/integrations/google-drive/connect`, `GET /api/integrations/google-drive/callback`, `GET /api/integrations/google-drive/files`, `POST /api/integrations/google-drive/import`, `POST /api/integrations/google-drive/reimport`

**New env vars**: `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_CALLBACK_URL`, `GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY`

**Security risks addressed**: token encryption at rest, CSRF state cookie pattern (same as GitHub), SSRF mitigated by Drive API own-account scoping, size limits enforced before reading response body, refresh race condition noted (defer to v1.1), revocation detection on 401/403.

**No code changed. No app behavior modified.** Ready for implementation when requested.

## 2026-06-16 - Knowledge Library v1

**Goal**: Dedicated page where users can browse, filter, and manage all uploaded and imported knowledge files across projects.

**New route**: `/knowledge` (dynamic, server-rendered, auth-gated via `requireServerUser`).

**Files changed**:

- **`lib/db/repositories/files.ts`** — `fileToIntelligence` now exposes `source` from the raw DB metadata in `FileIntelligence.metadata`. GitHub files carry `source: 'github'`; upload files have `source: null`. This enables client-side source detection without a full DB query.
- **`app/api/files/[id]/route.ts`** — New `PATCH` handler accepts `{ projectId: string | null }`. Validates the project belongs to the authenticated user before patching. Returns updated `FileIntelligence` on success. Existing `DELETE` is unchanged.
- **`app/knowledge/page.tsx`** — Server component. Auth gates with `requireServerUser`, fetches user's project list, renders `KnowledgeLibraryClient`.
- **`app/knowledge/knowledge-library-client.tsx`** — Client component. Fetches files from `/api/files` with project scoping. Tabs: All / Indexed / Skipped+Failed / GitHub. Project filter select, search input. Renders `FileIntelligenceCard` for each file with source badge, project context, and "Assign to project" button. Actions available: View (protected URL), Download, Ask this file (navigates to `/?openAskFiles=<fileId>`), Re-index, Assign to project (dialog with PATCH call), Remove (with AlertDialog confirm).
- **`components/chat/chat-layout.tsx`** — `ChatShell` reads the `openAskFiles` URL param on mount (once `authState.status === 'authenticated'`) and calls `openWorkspaceTool({ tool: 'ask-files', fileId })`. Cleans up the URL with `window.history.replaceState`. This closes the round-trip from Knowledge Library → workspace Ask Files.
- **`components/chat/sidebar.tsx`** — Added `Knowledge Library` link in the user account dropdown alongside Dashboard and Plans.

**Source detection**: `file.metadata?.source === 'github'` for GitHub-imported files; all others treated as uploads. No object-storage path is exposed to the browser; `viewUrl` and `downloadUrl` point to `/api/files/object?…` (the authenticated protected route).

**Not implemented in v1**: multi-select bulk actions, pagination beyond the 300-file limit, conversation-scoped view, GitHub-specific reimport button from the library page.

**Verification**: `npm run typecheck` ✓ · `npm run lint` 0 errors, 10 pre-existing warnings ✓ · `npm run build` all 58+ routes ✓ (new `/knowledge` route appears as `ƒ Dynamic`).

## 2026-06-16 - Expanded File Extraction for Business and Developer Files

- Expanded `lib/rag/extraction.ts` to support Markdown, JSON, CSV, and DOCX beyond plain text/code and PDF.
- Added `mammoth 1.12.0` (no native deps) via pnpm for DOCX text extraction; added `types/mammoth.d.ts` with a minimal ambient declaration since no `@types/mammoth` package exists on npm.
- **Markdown (`.md`, `.mdx`)**: Previously read as raw UTF-8 (worked but syntax tokens polluted embeddings). Now strips markdown rendering markers (headings, bold/italic, inline code, fenced code blocks kept as content, links reduced to display text, images removed, blockquotes/bullets/table pipes cleaned) before normalizing and chunking, producing cleaner prose for vector embeddings.
- **JSON (`.json`, `application/json`)**: Previously read as raw UTF-8. Now validates with `JSON.parse` and pretty-prints with `JSON.stringify(…, null, 2)` so chunks align on object boundaries rather than arbitrary character positions. Returns `unsupported` with a clear reason if the file is not valid JSON.
- **CSV (`.csv`, `text/csv`)**: Previously read as raw UTF-8. Now parsed with a minimal RFC 4180 parser (handles quoted fields containing commas, newlines, and escaped `""` pairs) and converts each data row to `Header: value | Header: value` format for readable semantic search. Capped at 10,000 rows and 2× `MAX_EXTRACTED_CHARS` of input scanning to avoid huge memory use on large exports.
- **DOCX (`.docx`)**: Was previously `unsupported`. Now extracted via `mammoth.extractRawText`, which handles standard Word document structure (paragraphs, headings, lists). Returns `unsupported` with a clear reason for encrypted or corrupted files. Dynamic import (`await import('mammoth')`) keeps mammoth out of the critical path for non-DOCX uploads.
- **Unchanged behavior**: All other text and code file types (`.ts`, `.py`, `.sql`, `.html`, etc.) continue through the existing generic UTF-8 reader path. PDF handling is unchanged.
- **Dispatcher order**: PDF → DOCX → (unsupported boundary for non-text) → JSON → CSV → Markdown → generic text. DOCX check must precede the `!isTextKnowledgeFile` guard because DOCX is binary.
- **Skipped / not supported**: OCR, image-based PDFs, password-protected DOCX, external parsing services, external vector DBs, Supabase, Stripe.
- `isDocxKnowledgeFile` is now exported alongside `isTextKnowledgeFile` and `isPdfKnowledgeFile` so future upload-path code can detect DOCX without re-implementing the same logic.
- Did not change `lib/rag/indexing.ts` (unchanged — already calls `extractTextFromFileBytes` and handles all status variants), `lib/storage/attachments.ts` (unchanged), or any API routes.
- Verification: `npm run typecheck` ✓ · `npm run test` 73/73 ✓ · `npm run lint` 0 errors, 10 pre-existing warnings ✓ · `npm run build` all routes ✓

## 2026-06-16 - Ask Files Source Citations V1

- Improved `SourceList` in `components/chat/message.tsx` to properly display file chunk citations when users ask questions about uploaded files.
- **What changed**: Replaced the flat single-section source list with a type-aware split that handles file and web sources separately.
- **File sources now show**:
  - `FileText` icon to visually distinguish from web links
  - File name (from `source.title`, which is the original `fileName` from `zen_files`)
  - **Chunk label** (`Chunk N` derived from `source.chunkIndex + 1`) — honest section indicator, no fake page numbers
  - Snippet text (line-clamp-3, up to 700 chars from the chunk content already stored in `FileKnowledgeSource.snippet`)
  - "Open file" link via `ExternalLink` icon if `source.url !== '#'`; non-clickable `<div>` if URL is `'#'` (no bucket/storagePath stored)
  - Honest `"Relevant file context used"` label when snippet is absent
- **Web sources**: unchanged behavior — sequential ID badge, domain, external link icon
- **Mixed responses** (file context + web search): two separate panels labeled "File context used" and "Web sources"; single-type responses keep the existing "Sources" label
- **No backend changes needed**: the full data pipeline was already in place — `lib/rag/retrieval.ts` retrieves `FileKnowledgeSource` with all required fields, `/api/chat/route.ts` streams them via the `sources` event and persists them to `zen_messages.sources`, and the `FileKnowledgeSource` type already carries `fileName`, `chunkId`, `chunkIndex`, `snippet`, `score`, `fileId`, and `url`.
- Added `FileKnowledgeSource` and `MessageSource` imports to `message.tsx` to enable the `isFileKnowledgeSource` type guard.
- Did not add page numbers (no page data exists in chunks), did not expose private files beyond existing storage URLs, did not add an external vector DB, did not add Supabase or Stripe, did not bypass billing.
- Remaining risks: `source.url` for file sources is a pre-signed or local storage URL generated server-side at retrieval time. Pre-signed URLs expire; if a user opens a persisted message hours later the "Open file" link may no longer work. The graceful `'#'`-check prevents broken links but does not guarantee freshness for stored old responses.
- Verification: `npm run typecheck` ✓ · `npm run lint` 0 errors, 10 pre-existing warnings ✓ · `npm run build` 57 routes ✓

## 2026-06-16 - User Preference Center V1

- Implemented User Preference Center v1 as an expanded and reorganized settings modal (`components/chat/settings-modal.tsx`).
- Added two new functional settings:
  - **Usage Optimization** (`usageOptimization: UsageOptimization`) — 4-card picker (Balanced / Fast / Best Quality / Lowest Usage) that maps directly to `sessionDefaults.modelOverride` (`auto` / `gemini` / `claude` / `deepseek`). Selecting a card sets the default model profile for new sessions without bypassing plan or model limits. Per-session overrides remain available in the session panel.
  - **Default Project Behavior** (`defaultProjectBehavior: DefaultProjectBehavior`) — 2-option picker (Remember last project / Always start in Inbox) wired to workspace load in `lib/chat-context.tsx`. When `inbox` is selected, the stored browser project selection is ignored on auth restore and new sessions always open in the general workspace (`all`).
- Added `UsageOptimization` and `DefaultProjectBehavior` types to `types/index.ts`.
- Added `getModelOverrideForUsageOptimization` and `getUsageOptimizationFromModelOverride` helpers to `lib/config/models.ts`.
- Updated `DEFAULT_APP_SETTINGS` with `usageOptimization: 'balanced'` and `defaultProjectBehavior: 'last_used'` defaults.
- Updated `lib/db/repositories/settings.ts` with validated normalization for both new fields; unknown values fall back to defaults.
- All 10 requested settings are now present and functional in the modal:
  1. Default assistant (existing mode grid, relabeled "Default Assistant")
  2. Default response style (Balanced / Concise / Detailed)
  3. Memory enabled/disabled (Session Feature Defaults toggle)
  4. File context default (Session Feature Defaults toggle)
  5. Web search default (Session Feature Defaults toggle)
  6. Assistant recommendation toggle
  7. Personalized recommendation toggle
  8. Usage optimization preference (Fast / Balanced / Best Quality / Lowest Usage)
  9. Default project behavior (Inbox / Last Used)
  10. Theme/UI preferences (dark theme locked + accent style picker)
- Did not expose raw cost, add Supabase, add Stripe, or bypass plan limits.
- Remaining risks: `usageOptimization` is derived from `sessionDefaults.modelOverride` at render time via `getUsageOptimizationFromModelOverride`; if a user manually sets `modelOverride` to `gpt` or `qwen` in the session panel, the preference center will show `balanced` as the nearest match until they explicitly select an optimization card.
- Verification pending: `npm run typecheck`, `npm run lint`, `npm run build`.

## 2026-06-16 - Personalized Assistant Recommendations V2

- Added opt-in Personalized Assistant Recommendations v2 on top of the existing local Smart Assistant Router. Base prompt classification remains the source of truth; personalization only applies bounded confidence/explanation nudges when the user enables it.
- Extended settings with `assistantRecommendations.personalized`, defaulting to `false` for existing and new users, and added a separate Settings toggle that is disabled when assistant recommendations are off.
- Added safe personalization summary types and pure router helpers that derive task-level signals from recommendation outcomes, Feedback V1 metadata/ratings, selected Model Duel winners, and recent assistant usage without storing prompts, message content, snippets, raw costs, provider secrets, or cross-user data.
- Added protected `GET /api/assistant-recommendations/personalization`, scoped to the authenticated user, and wired authenticated workspace hydration to fetch the summary only when personalization is enabled.
- Updated inline recommendation chip and send-time recommendation dialog to show the base reason plus a subtle personalized explanation such as “You usually choose Forge for coding tasks.”
- Added unit coverage for unchanged base routing when personalization is off, Forge/code acceptance history, Pulse rejection confidence suppression, Velora creative feedback, and unrelated Model Duel winner non-overrides.
- Preserved constraints: no external ML, no OpenRouter routing call, no Supabase, no Stripe, no plan/model-limit bypass, and no hidden prompt/router auto-tuning beyond the opt-in local nudge.
- Remaining risks: no seeded Neon/browser QA was run to verify a real account’s personalization summary over time; the v2 summary is request-time derived and may need caching if high-volume accounts make the settings/workspace load slower.
- Verification: `npm run test` passed with 17 files and 73 tests; `npm run typecheck` passed; `npm run lint` passed with the existing 11 warnings and 0 errors; `npm run build` passed with the known Node `module.register()` deprecation warning.

## 2026-06-16 - Feedback Loop V1

- Added Feedback Loop v1 for user-scoped assistant/message, Model Duel candidate, artifact action, playbook run, Prism image, and backend-ready search-result feedback capture.
- Added forward-only Neon migration `20260616_zenquanta_feedback_events.sql`, Drizzle `zenFeedbackEvents`, shared feedback request/response types, a pure validation/sanitization helper, and `neonFeedbackRepository`.
- Added protected `POST /api/feedback`; it requires the authenticated Neon session, hydrates the user profile, validates entity/rating input, returns `404` for missing/foreign concrete entities, and stores sanitized append-only events.
- Added reusable feedback controls to completed assistant messages, completed Model Duel candidates, artifact action previews, playbook final outputs, and selected Prism images. Downvotes can include an optional short reason; submissions show a lightweight thanks acknowledgement and make no AI call.
- Extended admin product analytics with aggregate feedback counts, rating breakdowns, downvote rate, entity-type buckets, and negative-feedback operational signals. Normal users do not receive cross-user feedback data.
- Search-result feedback is supported by the backend with sanitized metadata, but command-palette row UI wiring is deferred to keep the v1 UI low-risk.
- Added focused Vitest coverage for feedback entity/rating validation, reason trimming, and metadata stripping of snippets, content, object-store internals, secrets, and raw-cost fields.
- Verification: `npm run test` passed with 17 files and 68 tests; `npm run typecheck` passed; `npm run lint` passed with the existing 11 warnings and 0 errors; `npm run build` passed with the known Node `module.register()` deprecation warning; `git diff --check` passed.

## 2026-06-16 - Workspace Home V1

- Added Workspace Home v1 as the authenticated first screen inside `/` when no conversation or Project Home is open. `/dashboard` remains focused on usage, plan status, admin-adjacent dashboard data, and Activity Timeline.
- Added shared `WorkspaceHome*` response types, `lib/workspace-home/suggestions.ts`, and unit-tested rule-based suggestion logic. Suggestions are deterministic and make no AI calls or token-using requests on page load.
- Added `lib/db/repositories/workspace-home.ts` and exported `neonWorkspaceHomeRepository`; it derives capped, user-scoped summaries from existing Neon projects, conversations, artifacts, prompt workflow runs, files, and generated images. Responses exclude raw costs, admin data, provider secrets, direct object-store URLs, and large content payloads.
- Added protected `GET /api/workspace-home`, which requires the authenticated Neon session, hydrates the user profile, computes a displayed-only usage snapshot from existing billing helpers, and returns continue items, recent workspace lists, suggestions, and generated timestamp.
- Added `components/chat/workspace-home.tsx` and updated `components/chat/chat-area.tsx` so Project Home still wins when selected, active conversations still render normally, and Workspace Home replaces the old generic empty state for authenticated users with no active chat.
- Quick actions use existing chat-context methods: new chat, inline new project, upload to target project, open Playbooks, prepare Prism image draft, open Pulse Research Room, and open global search.
- Updated project/checklist docs to include `/api/workspace-home` and the authenticated `/` Workspace Home.
- Remaining risks: no seeded Neon/browser QA was run to click every Workspace Home target; playbook-run links currently open the Playbooks surface rather than focusing an exact historical run row; upload quick action requires a target project.
- Verification: `npm run test` passed with 16 files and 64 tests; `npm run typecheck` passed; `npm run lint` passed with the existing 11 warnings and 0 errors; `npm run build` passed with the known Node `module.register()` deprecation warning.

## 2026-06-16 - Workspace Activity Timeline V1

- Added Workspace Activity Timeline v1 as a user-scoped feed derived from existing Neon tables, without event sourcing, background jobs, external analytics, Supabase, Stripe, or a database migration.
- Added shared activity domain types in `types/index.ts` plus pure timeline helpers in `lib/activity/timeline.ts` for valid event types, limit/cursor normalization, update-event suppression, safe workspace hrefs, and newest-first paging.
- Added `lib/db/repositories/activity.ts` and exported `neonActivityRepository`; it derives capped activity from projects, conversations, user messages, files and knowledge status, artifacts, playbook runs, generated images, completed Model Duel records, custom assistants, and plan requests. All reads are scoped by authenticated `userId`; project filters remain project-scoped; raw cost, admin audit logs, provider secrets, and direct private file URLs are not exposed.
- Added protected `GET /api/activity` with `requireAuthenticatedUser`, profile hydration, project ownership validation, and `projectId`, `type`, `limit`, and `before` filters. Invalid type/limit/cursor returns `400`; foreign project filters return `404`.
- Added a server-rendered Activity Timeline card to `/dashboard` with project/type filters, compact chronological items, empty state, and links back to conversations/messages, Project Home, Artifact Studio, Ask Files, Prism Studio, Playbooks, Model Duel conversations, Custom Assistants, and Pricing.
- Added lightweight workspace deep-link handling in `lib/chat-context.tsx` so dashboard links can open conversations/messages or the relevant workspace tool after authenticated workspace hydration.
- Added Vitest coverage for activity helper behavior: mixed-source sorting, type/project/cursor/limit filtering, duplicate update suppression, event type validation, cursor/limit validation, and safe workspace link generation.
- Remaining risks: no seeded Neon `EXPLAIN ANALYZE`, cross-user fixture, or browser QA was run for the derived feed; project/tool deep links use existing workspace tool request support and do not yet focus every nested entity such as a specific playbook workflow row.
- Verification: `npm run test` passed with 15 files and 60 tests; `npm run typecheck` passed; `npm run lint` passed with the existing 11 warnings and 0 errors; `npm run build` passed with the known Node `module.register()` deprecation warning.

## 2026-06-16 - Artifact Export Pack V1

- Added server-backed Artifact Export Pack v1 for saved artifacts.
- Added pure export formatting helpers for Markdown, plain text, and JSON with safe filename sanitization, MIME type selection, and a JSON envelope that excludes `userId`.
- Added protected `GET /api/artifacts/[id]/export?format=markdown|text|json`, which requires the authenticated Neon session, reads artifacts through the user-scoped artifact repository, returns `404` for missing/foreign artifacts, returns `400` for unsupported formats, and sends attachment headers with `private, no-store` plus `nosniff`.
- Updated Artifact Studio to replace the single Markdown-only export button with an export dropdown. Saved artifacts now export Markdown, plain text, or JSON through the protected route; unsaved drafts keep local Markdown export only.
- Added focused Vitest coverage for export format validation, filename sanitization, Markdown/text content, and JSON export privacy.
- PDF export remains out of scope for v1 because the repo has PDF extraction support but no safe existing PDF generation pattern, and no new document-generation dependency was added.
- No database migration, external storage, Google Docs integration, Supabase, Stripe, billing, artifact editing, artifact versioning, search, or Project Home behavior changed.
- Verification: `npm run test` passed with 14 files and 55 tests; `npm run typecheck` passed; `npm run lint` passed with the existing 11 warnings and 0 errors; `npm run build` passed with the known Node `module.register()` deprecation warning; `git diff --check` passed.

## 2026-06-16 - Artifact Version History V1 Verification

- Verified the existing Artifact Version History implementation instead of duplicating schema or routes.
- Confirmed `neon/migrations/20260603_zenquanta_artifact_versions.sql` and `zenArtifactVersions` already provide the `zen_artifact_versions` table with artifact/user ownership, metadata snapshots, optional `created_by_action`, baseline backfill, and version lookup indexes.
- Confirmed artifact create and update paths write version snapshots transactionally, restore writes a new `restore_version` snapshot, and duplicate creates a new artifact plus its initial version snapshot.
- Confirmed applied Artifact Actions still follow the intended flow: `/api/artifacts/[id]/actions` performs a billed preview only, the UI stamps `metadata.lastArtifactAction` when the user applies the preview, and `created_by_action` is recorded only after the user explicitly saves the edited artifact.
- Confirmed protected version APIs remain present and user-scoped: `GET /api/artifacts/[id]/versions`, `POST /api/artifacts/[id]/versions/[versionId]/restore`, and `POST /api/artifacts/[id]/versions/[versionId]/duplicate`; missing or foreign artifacts/versions return `404`.
- Confirmed Project Home and global/project search continue to read current `zen_artifacts` rows rather than historical version rows, so restoring or duplicating updates the normal artifact surfaces without adding historical-version search noise.
- No runtime code, public route, response type, Supabase, Stripe, realtime collaboration, external storage, automatic AI call, or billing behavior changed in this pass.
- Verification: `npm run test` passed with 13 files and 49 tests; `npm run typecheck` passed; `npm run lint` passed with the existing 11 warnings and 0 errors; `npm run build` passed with the known Node `module.register()` deprecation warning; `git diff --check` passed.
- Remaining risk: seeded Neon/manual browser QA should still exercise create, edit, action apply/save, history preview, restore, duplicate, Project Home, and search together on a real account.

## 2026-06-16 - Large Conversation Performance And Persistence Safety Refresh

- Confirmed the current large-conversation foundations are already present: `/api/conversations` returns message-light shells, `/api/conversations/[id]?messageLimit=80` hydrates the newest page, `/api/conversations/[id]/messages` loads older pages, the chat UI exposes `Load older messages`, and older-page prepends preserve scroll position.
- Confirmed generation context is bounded before OpenRouter: conversation memory can be injected, only recent non-system messages are selected, per-message and total character caps are enforced, and the latest user request is preserved.
- Confirmed normal text sends persist with header/message upserts instead of delete-and-reinsert, streaming passes the request abort signal, stopped/failed generations persist safe assistant error state, and Pulse/file sources persist on assistant messages.
- Optimized conversation header refresh so saves aggregate message count, latest preview, token/cost totals, credits, and image count in SQL instead of selecting every message `usage` JSON payload for long conversations.
- Tightened admin user detail loading so admin detail uses message-light conversation rows, matching the current UI which only shows conversation count.
- Added pure unit coverage for mapping aggregate usage rows into the existing `UsageEstimate` shape.
- Updated stale project risk documentation that still described conversation saves as destructive full rewrites.
- Remaining risks: no seeded Neon `EXPLAIN ANALYZE` was run; multi-tab concurrent sends still rely on the client send queue and message upserts rather than a schema-backed send lease/version field; admin analytics still need aggregate/materialized reporting if production volume grows.
- Verification: `npm run test` passed with 13 files and 49 tests; `npm run typecheck` passed; `npm run lint` passed with the existing 11 warnings and 0 errors; `npm run build` passed with the known Node `module.register()` deprecation warning; `git diff --check` passed.

## 2026-06-16 - Incremental Database Performance And Indexing Pass

- Reviewed Neon/Drizzle query patterns across search, projects, conversations/messages, artifacts, prompt workflows/runs, Prism history, dashboard/admin analytics, Model Duel, custom assistants, files, attachments, and GitHub integration imports.
- Added forward-only migration `neon/migrations/20260616_zenquanta_incremental_performance_indexes.sql` for current high-frequency access paths:
  - b-tree indexes for project lists, file conversation lists, generated-image project/favorite history, usage and image event user/admin filters, plan request user/status history, GitHub imported-file project summaries, and message attachment JSON cleanup.
  - trigram indexes for existing ILIKE search fields not covered by the prior pass: project name/description, conversation memory summary, prompt workflow title/description, workflow step title/template, generated-image negative prompt, and custom assistant description.
- Mirrored representable b-tree indexes in `lib/db/schema.ts`; trigram and JSONB GIN indexes remain migration-only performance details.
- Improved query/list behavior without changing response shapes:
  - Capped prompt library, prompt workflow, custom assistant, and project repository list methods with conservative defaults and maximums.
  - Capped the admin plan-request list route to 200 rows by default and 1000 maximum while leaving internal analytics calls unbounded unless they pass a limit.
  - Replaced file deletion attachment cleanup so it queries only owned messages whose attachment JSON contains the deleted file id, instead of hydrating every conversation and every message for the user.
- Kept existing pagination unchanged for conversations, message pages, files, artifacts, Prism image history, search, and workflow runs because they already use limits/cursors.
- Remaining risks: no seeded Neon dataset or `EXPLAIN ANALYZE` proof was run in this pass; admin overview still performs broad in-memory product analytics and should move to aggregate SQL, cached summaries, or materialized reporting tables once production volume justifies it; JSONB metadata ILIKE search remains intentionally unindexed.
- Verification: `npm run typecheck` passed; `npm run lint` passed with the existing 11 warnings and 0 errors; `npm run build` passed with the known Node `module.register()` deprecation warning; `git diff --check` passed. `npm run test` was not run because this pass did not add or change test files.

## 2026-06-16 - User-Scope And Privacy Hardening Pass

- Reviewed route protection for `/api/search`, projects, conversations, artifacts, prompt workflows, prompts, custom assistants, model comparisons, images, attachments, protected file objects, dashboard, settings, admin routes, auth helpers, GitHub integration routes, and the relevant Neon repositories.
- Confirmed the core user-owned routes require `requireAuthenticatedUser`, admin APIs require `requireAdminApiUser`, and owned resource IDs are generally validated through user-scoped repository lookups before reads/writes.
- Confirmed private file reads go through `/api/files/object`, Prism history responses return protected private file URLs with `sourceUrl: null`, raw model cost/margin are scrubbed from normal user AI responses, and search queries remain scoped to `auth.user.id` with owned project validation.
- Issue found and fixed: `/api/integrations/github` returned the full GitHub account shape, including provider/internal fields such as `installationId` and `syncState`. Added a client-safe GitHub account serializer so status responses expose only display-safe connection fields.
- Added a unit test proving GitHub client status serialization omits installation IDs, sync metadata, provider/internal IDs, and private key values.
- Remaining risks: no seeded cross-user database fixtures or authenticated E2E tests currently prove ownership boundaries at runtime; keep authenticated workspace/search/integration leakage tests deferred until a safe Neon/session fixture exists.
- Verification: `npm run test` passed with 12 files and 47 tests; `npm run typecheck` passed; `npm run lint` passed with the existing 11 warnings and 0 errors; `npm run build` passed; `git diff --check` passed.

## 2026-06-16 - Stabilized Playwright Smoke Tests

- Stabilized the existing Playwright smoke suite instead of adding duplicate E2E infrastructure.
- Switched Playwright to a dedicated local dev server on `127.0.0.1:3100` and kept `npm run test:e2e` as `playwright test`.
- Updated route navigation helpers to wait for `domcontentloaded`, preserving smoke coverage for the unauthenticated auth gate, sign-in/sign-up forms, protected dashboard/pricing/admin redirects, and public assistant pages.
- Documented that authenticated workspace, command palette, and global search E2E remain deferred until a seeded Neon/session fixture exists; tests must not use `.env.local` secrets, production credentials, real API keys, Supabase, Stripe, or external services.
- Planning failure mode documented: the previous Playwright web server on port 3000 accepted connections but route requests hung, causing `page.goto` timeouts across all smoke routes.
- Verification: `npm run test:e2e` passed with 12 Chromium smoke tests after rerunning with local-server sandbox approval; `npm run test` passed with 11 files and 45 tests; `npm run typecheck` passed; `npm run lint` passed with the existing 11 warnings and 0 errors; `npm run build` passed; `git diff --check` passed.

## 2026-06-16 - Verified Automated Test Foundation

- Confirmed the lightweight Vitest unit-test foundation already exists with `npm run test`, `npm run test:watch`, `vitest.config.ts`, Node test environment, and the existing `@/` alias.
- Confirmed existing pure-helper coverage includes assistant routing/config, pricing/billing display helpers, prompt precheck/router behavior, file helpers, custom assistant validation, search result normalization, playbook variable interpolation, conversation/context helpers, artifact versions, storage/security, and user-scope security.
- Updated `AI_CHECKLIST.md` to state that unit tests must not require `.env.local` values or read/copy local secrets.
- No package scripts, dependencies, runtime code, Supabase, Stripe, external-service tests, or secret-dependent tests were added.
- Verification before this entry: `npm run test` passed with 11 files and 45 tests, `npm run typecheck` passed, and `npm run lint` passed with 11 existing warnings and 0 errors.

## 2026-06-16 - Refreshed Manual Product Smoke Test Checklist

- Updated `docs/manual-product-smoke-test.md` in place as the complete manual QA checklist for sign-up through advanced Zenquanta AI product flows.
- Refreshed the checklist metadata for the current `.env.local`/staging-safe workflow and Neon migrations through `20260603_zenquanta_performance_indexes.sql`.
- Added standalone manual smoke coverage for onboarding/starter packs, authenticated password update/reset behavior, Model Duel, and Memory Vault.
- Tightened regression checks for text/image route separation, private file route protection, user-scoped search/data access, GitHub read-only behavior, and manual plan/admin activation without Stripe/payment automation.
- No runtime code changed.

## 2026-06-16 - Aligned Environment Docs With `.env.local`

- Updated repo workflow docs to treat `.env.local` as the intentional local-only development env file and to avoid restoring or committing `.env.example` unless explicitly requested.
- Updated setup/checklist language to create or edit `.env.local` directly, while keeping env examples as non-secret placeholder key references only.
- Added the artifact version history and performance index Neon migrations to the checklist migration list.
- No product code changed. The previous post-feature audit found no required product-code fixes; the remaining work from that pass was stale environment/setup documentation.
- Verification plan for this docs-only cleanup: `rg -n "\\.env\\.example" README.md AI_CHECKLIST.md AGENTS.md CLAUDE.md AI_TASK_LOG.md AI_PROJECT.md AI_DECISIONS.md`, `git diff --check`, and `git status -sb`.

## 2026-06-16 - Post-Feature Product Audit

- Performed a documentation-only audit of the recent Zenquanta AI feature wave across the required project docs, Neon schema/migrations/repositories, chat context, API routes, chat/admin/ui components, auth, billing, storage, RAG, search, and config modules.
- No product code was changed. Follow-up env documentation now records that `.env.local` is the local-only development env file and `.env.example` should not be restored unless explicitly requested.

| Feature name | Status | Main files involved | API routes involved | Database tables/migrations involved | User-facing UI entry point | Known risks | Recommended follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Command palette | Implemented | `components/chat/command-palette.tsx`, `components/chat/chat-layout.tsx`, `components/chat/header.tsx`, `lib/chat-context.tsx` | `/api/search` | Searches Neon user rows across conversations, messages, artifacts, prompts, files, generated images, model comparisons, custom assistants; `20260603_zenquanta_performance_indexes.sql` | Header search button and Cmd/Ctrl+K workspace palette | Depends on authenticated search responses; no seeded browser E2E in this audit | Add authenticated command-palette E2E coverage for opening each result/action type |
| Global search | Implemented | `app/api/search/route.ts`, `lib/db/repositories/search.ts`, `components/chat/command-palette.tsx` | `/api/search` | User-scoped Neon search over conversation, message, artifact, prompt, file, image, model comparison, and custom assistant tables | Command palette global search mode | Results include content snippets, so session/auth leakage tests matter | Add fixtures proving one user cannot see another user's snippets or rows |
| Onboarding and starter packs | Implemented | `components/chat/onboarding-dialog.tsx`, `app/api/onboarding/route.ts`, `lib/config/onboarding.ts` | `/api/onboarding` | `zen_user_settings`, `zen_projects`, `zen_prompt_library` | First-run onboarding dialog | Repeat-completion/idempotency was not browser-tested here | Add onboarding repeat-run and starter-pack creation tests |
| Project Home | Implemented | `components/chat/project-home.tsx`, `app/api/projects/[id]/home/route.ts`, `lib/db/repositories/project-home.ts` | `/api/projects/[id]/home` | `zen_projects`, `zen_conversations`, `zen_files`, `zen_generated_images`, `zen_prompt_workflows`, `zen_artifacts`, `zen_integration_items` | Project panel/home surface in workspace | Route has a harmless extra project-list query; no seeded project-home QA | Remove redundant query and add project-home fixture coverage |
| Project-specific search | Implemented | `components/chat/command-palette.tsx`, `components/chat/project-home.tsx`, `app/api/search/route.ts`, `lib/db/repositories/search.ts` | `/api/search?projectId=...` | Same search tables with owned project validation; `20260603_zenquanta_performance_indexes.sql` | Project Home search action and command palette project scope | Project scope excludes non-project-owned resources such as reusable prompts/custom assistants by design | Add leakage tests for foreign `projectId` and document scoped result behavior |
| Artifact Studio | Implemented | `components/chat/artifact-studio.tsx`, `app/api/artifacts/*`, `lib/db/repositories/artifacts.ts` | `/api/artifacts`, `/api/artifacts/[id]`, `/api/artifacts/[id]/versions`, restore, duplicate | `zen_artifacts`, `zen_artifact_versions`; `20260526_zenquanta_artifacts.sql`, `20260603_zenquanta_artifact_versions.sql` | Artifact Studio panel and save/open artifact actions | Version behavior was not seeded-Neon/browser-tested here | Add version history restore/duplicate integration QA |
| Artifact actions | Implemented | `app/api/artifacts/[id]/actions/route.ts`, `components/chat/artifact-studio.tsx`, `lib/ai/chat.ts`, `lib/billing/*` | `/api/artifacts/[id]/actions` | `zen_artifacts`, `zen_usage_events` | Artifact Studio action controls | Action previews are billed AI outputs but not automatically persisted | Add UX tests for preview, apply, and save-as-version flow |
| AI Playbooks | Implemented | `components/chat/playbook-studio.tsx`, `app/api/prompt-workflows/*`, `lib/db/repositories/prompt-workflows.ts` | `/api/prompt-workflows`, `/api/prompt-workflows/[id]`, `/api/prompt-workflows/[id]/runs` | `zen_prompt_workflows`, `zen_prompt_workflow_steps`, `zen_prompt_workflow_runs`, `zen_prompt_workflow_step_runs`; `20260522_zenquanta_prompt_workflows.sql` | Playbook Studio and workspace actions | V1 runs foreground queued chat/image actions, not a background automation engine | Add recovery/partial-run QA for foreground execution |
| Playbook Builder improvements | Implemented | `components/chat/playbook-studio.tsx`, `lib/config/playbook-templates.ts`, prompt workflow repository | `/api/prompt-workflows*` | Prompt workflow metadata JSON; `20260528_zenquanta_playbook_builder_metadata.sql` | Playbook Builder/Studio | Metadata is flexible JSON and usage estimates are qualitative | Add validation tests for builder metadata and template loading |
| Smart Assistant Router | Implemented | `lib/router/*`, `hooks/usePromptPrecheck.ts`, `components/chat/smart-router-dialog.tsx`, `components/chat/assistant-recommendation-chip.tsx` | `/api/assistant-recommendations` | `zen_assistant_recommendation_events` | Composer recommendation chip/dialog | Rule quality can be noisy; telemetry is useful but not proof of routing accuracy | Review telemetry and add suppression/acceptance heuristics after real usage |
| Assistant Handoffs | Implemented | `lib/config/assistant-handoffs.ts`, `components/chat/message.tsx`, `lib/chat-context.tsx` | Existing `/api/chat` or `/api/images/generate` paths | Normal conversation/message/usage tables | Message-level handoff menu | Handoffs are not separately tracked as analytics events | Add optional handoff telemetry if product decisions need it |
| Quality-check actions | Implemented | `lib/config/assistant-quality-actions.ts`, `components/chat/message.tsx`, `lib/chat-context.tsx` | Existing `/api/chat` or `/api/images/generate` paths | Normal conversation/message/usage tables | Message quality/action menu | Action provenance is mostly prompt/content based, not structured metadata | Add lightweight action metadata if auditability becomes important |
| Memory Vault | Implemented | `components/chat/memory-vault.tsx`, `app/api/memory-vault/route.ts`, `app/api/conversations/[id]/memory/route.ts`, `lib/db/repositories/memory-vault.ts` | `/api/memory-vault`, `/api/conversations/[id]/memory` | `zen_conversations.memory_summary`, `memory_updated_at`, `session_settings` | Memory Vault panel and conversation memory controls | Memory is conversation-derived and should not become hidden global preference memory without a privacy design | Add explicit preference-memory design only if requested later |
| Model Duel | Implemented | `components/chat/model-comparison-button.tsx`, `app/api/model-comparisons/*`, `lib/db/repositories/model-comparisons.ts` | `/api/model-comparisons`, `/api/model-comparisons/[id]/choose` | `zen_model_comparisons`, `zen_model_comparison_candidates`; `20260522_zenquanta_model_comparisons.sql` | Composer Model Duel button | Text-only by design; first-action flow was not browser-tested in this audit | Add seeded QA for brand-new conversation Model Duel and candidate billing |
| Prism Studio | Implemented | `components/chat/prism-studio.tsx`, `app/api/images/history/*`, `app/api/images/generate/route.ts`, `lib/db/repositories/generated-images.ts` | `/api/images/generate`, `/api/images/history`, `/api/images/history/[id]` | `zen_generated_images`, `zen_image_generation_events`; `20260528_zenquanta_prism_studio_metadata.sql` | Prism Studio panel and Prism assistant flow | Requires storage health for protected URLs; gallery pagination/assets were not manually inspected here | Add gallery asset-health QA against production-like object storage |
| Pulse Research Room | Implemented | `components/chat/pulse-research-room.tsx`, `app/api/pulse/research-room/route.ts`, `lib/db/repositories/pulse-research.ts`, `lib/search/web-search.ts` | `/api/pulse/research-room`, plus `/api/chat` when sending research prompts | `zen_messages.sources`, conversations, artifacts as saved outputs | Pulse Research Room panel | Tavily absence degrades search capability; source-history UX needs real API QA | Add source-history tests with and without `TAVILY_API_KEY` |
| File Intelligence Cards | Implemented | `components/chat/file-intelligence-card.tsx`, `app/api/files/*`, `lib/db/repositories/files.ts`, `lib/rag/*` | `/api/files`, `/api/files/[id]`, `/api/files/[id]/reindex`, `/api/files/object` | `zen_files`, `zen_file_chunks`; `20260522_zenquanta_file_knowledge.sql` | File cards in attachments/project/file panels | GitHub external files intentionally have no object-store download URL | Improve external-file states and add bulk/file-manager QA |
| Ask Files | Implemented | `components/chat/ask-files-panel.tsx`, `lib/chat-context.tsx`, `lib/rag/retrieval.ts`, `/api/chat` file-context handling | `/api/files`, `/api/chat` | `zen_files`, `zen_file_chunks` | Ask Files panel and file-context composer flow | Quality depends on extracted chunks and embedding config; large selected-file sets need caps | Add selected-file cap UX and citation display checks |
| PDF text extraction without OCR | Implemented | `lib/rag/extraction.ts`, `lib/rag/indexing.ts`, `lib/utils/files.ts` | Upload/reindex paths through `/api/attachments`, `/api/files/[id]/reindex`, and `/api/chat` retrieval | `zen_files.metadata.knowledgeBase`, `zen_file_chunks` | File upload, File Intelligence Card, Ask Files | Scanned/image-only or password-protected PDFs remain unsupported by design | Add OCR as a separate future milestone with explicit cost/privacy decisions |
| Usage transparency | Implemented | `components/chat/usage-transparency-hint.tsx`, `app/api/dashboard/route.ts`, `lib/billing/*` | `/api/dashboard`, normal AI action routes | `zen_subscriptions`, `zen_usage_events`, `zen_image_generation_events`, `zen_plan_change_requests` | Composer usage hint, dashboard, pricing surfaces | Composer hint is qualitative and not a binding quote | Calibrate labels against real usage data after launch |
| Upgrade nudges | Implemented | `components/chat/upgrade-nudges.tsx`, `app/pricing/page.tsx`, `app/dashboard/page.tsx`, `app/api/plan-requests/route.ts` | `/api/plan-requests`, `/api/dashboard` | `zen_plan_change_requests`, `zen_subscriptions`, usage tables | Composer/errors, pricing, dashboard | Dismissal/visibility behavior may be session-local depending on surface | Add persistent nudge dismissal only if it improves UX |
| Admin product analytics | Implemented | `app/admin/page.tsx`, `components/admin/*`, `app/api/admin/overview/route.ts`, `lib/db/repositories/admin.ts` | `/api/admin/overview`, `/api/admin/users`, `/api/admin/plan-requests` | Profiles, subscriptions, usage, image events, projects, files, workflows, comparisons, custom assistants, plan requests | `/admin` | Request-time aggregation may get heavy with large datasets | Add caching or materialized summaries once production volume justifies it |
| Custom Assistant Builder v2 | Implemented | `components/chat/custom-assistant-button.tsx`, `app/api/custom-assistants/*`, `lib/db/repositories/custom-assistants.ts`, `lib/config/custom-assistants.ts` | `/api/custom-assistants`, `/api/custom-assistants/[id]`, `/api/custom-assistants/test` | `zen_custom_assistants`; `20260525_zenquanta_custom_assistants.sql`, `20260528_zenquanta_custom_assistant_builder_v2.sql` | Composer private assistant builder | Text-only/private by design; prompt-library references live in metadata | Add project-scoping/sharing only as an explicit future feature |
| Integration architecture planning | Implemented | `AI_DECISIONS.md`, `AI_PROJECT.md`, `AI_CHECKLIST.md`, `AI_TASK_LOG.md` | None for planning itself | Planning plus `zen_integration_accounts`, `zen_integration_items` for GitHub | Docs and GitHub panel | Roadmap/docs can drift because GitHub shipped before broader provider rollout | Reconcile roadmap and token-encryption policy before adding more providers |
| GitHub read-only integration | Implemented | `components/chat/github-integration-panel.tsx`, `app/api/integrations/github/*`, `lib/integrations/github.ts`, `lib/integrations/github-import.ts`, `lib/db/repositories/integrations.ts` | `/api/integrations/github/connect`, `/callback`, `/repositories`, `/repository`, `/import`, `/status` | `zen_integration_accounts`, `zen_integration_items`, imported `zen_files`/`zen_file_chunks`; `20260528_zenquanta_github_readonly_integrations.sql` | GitHub integration panel, Project Home imported context | Current code is read-only; external App configuration and removal flows still need production QA | Validate GitHub App permissions in production and add imported-content remove/disconnect UX |

Cross-cutting audit checks:

- User scoping: new protected routes use `requireAuthenticatedUser`, project filters validate owned projects, search uses `userId` filters, file object reads verify owned private metadata before object-store access, and admin routes use `requireAdminApiUser`.
- Neon repositories: audited feature routes call the fresh Neon repository layer rather than Supabase runtime clients. No runtime Supabase client reintroduction was found outside historical docs/migrations.
- Billing: `/api/chat`, `/api/images/generate`, artifact actions, Model Duel candidates, and custom assistant tests enforce/log usage. Playbooks, handoffs, and quality actions dispatch through the existing billed chat/image paths. Normal user responses scrub `rawCostUsd` and `marginUsd`.
- Prism separation: `/api/chat` rejects image/Prism requests and keeps image generation on `/api/images/generate`.
- Private files: private file reads go through `/api/files/object`; generated image history returns protected file URLs and hides source URLs; global/project search is auth-protected and user-scoped.
- GitHub integration: route surface is read-only repository listing/summary/import. No GitHub write route was found; installation tokens appear short-lived and `encrypted_token_payload` is currently not persisted.
- Admin/raw cost boundaries: raw cost and margin analytics are exposed through admin repository/routes/pages only; normal dashboard/pricing surfaces use displayed usage summaries.
- Payments: no Stripe checkout, webhooks, customer portal, or payment automation was found; manual plan requests/admin activation remain the current billing workflow.

Verification:

- `npm run typecheck` passed.
- `npm run lint` passed with 11 existing warnings: two raw `<img>` warnings, several unused symbol warnings in chat/UI/db utilities, and two `actionTypes` type-only warnings.
- `npm run build` passed with the known Node `module.register()` deprecation warning under Next.js 16.2.0/Turbopack.
- Runtime browser QA and seeded Neon integration tests were not performed in this audit.

## 2026-06-11 - Fixed New-Conversation 404 In Prism And Model Duel

- Audited every Neon-backed API route for the same premature-404 pattern fixed in `/api/chat` (client-generated `conversationId` for a not-yet-persisted conversation rejected before create/upsert can run). Artifacts, projects, prompts/workflows, files, Pulse research room, GitHub integration, and custom assistants only ever operate on server-issued IDs and were unaffected.
- `app/api/images/generate/route.ts`: applied the same `&& !body?.conversation` exemption as `/api/chat`, so a brand-new conversation's first Prism request no longer 404s before `resolveConversation`/`save` can persist it.
- `app/api/model-comparisons/route.ts`: the client (`runModelComparison` in `lib/chat-context.tsx`) never sent a `conversation` payload at all, so it always 404'd on a brand-new conversation's first Model Duel run. Added `conversation?: Conversation` to `ModelComparisonRequest` (`types/index.ts`), had the client send `conversation: currentChatRef.current ?? undefined`, and mirrored the route's `projectScope`/`scopedConversation`/404-exemption handling from `/api/chat` so new conversations persist correctly.
- Verification: `npm run typecheck` passed.
- Remaining risk: should manually verify in the browser that running Prism or Model Duel as the very first action in a brand-new chat persists the conversation without "Conversation not found."

## 2026-06-11 - Fixed New-Conversation 404 In Chat Send

- Fixed `/api/chat` returning `Conversation not found.` (404) for every first message of a brand-new conversation. The user-scoping check added in `8b7c7e0` ("tighten user scoped route validation") rejected client-generated `conversationId`s before `saveTurnStart` could create the row via `upsertConversationHeader`.
- `app/api/chat/route.ts`: the early 404 now only fires when `body.conversationId` is set, no stored conversation exists, and the request also lacks a `body.conversation` seed payload (mirroring the existing `projectScope` fallback at the same spot). New conversations with a `conversation` payload now pass through and persist normally.
- This also explains the "pressing Enter doesn't send" symptom: the composer's Enter handler was correct, but the resulting `/api/chat` request errored immediately on new chats, surfacing as a failed/erroring response.
- Verification: `npm run typecheck` passed.
- Remaining risk: should manually verify in the browser that starting a brand-new chat now persists and shows up in the sidebar/history without the "Conversation not found." error.

## 2026-06-10 - Responsive Workspace Composer And Chat Flow

- Compacted the workspace header/sidebar controls for small screens, including smaller hamburger buttons, tighter header spacing, hidden secondary actions on mobile, and a capped sidebar width that cannot consume the full viewport.
- Reworked the composer layout so the textarea, tool controls, and send/stop actions stack naturally on mobile instead of overlapping; the tool row now scrolls horizontally, the send action becomes compact on small screens, and mobile keyboard-helper text is hidden.
- Reduced the mobile footprint of the usage transparency hint and improved chat message wrapping/widths so long text, code, and attachments stay inside the viewport.
- Updated chat scrolling so a new assistant response scrolls to the top of that response, streaming does not keep forcing the viewport downward while the user reads, and loading older messages preserves the current scroll position.
- Fixed a runtime Drizzle schema mismatch where assistant recommendation events tried to insert an unused `project_id` column that the fresh Neon migration does not create.
- Verification: `npm run typecheck` passed; `npm run lint` passed with the existing 11 warnings; `curl http://localhost:3000/` returned 200 while the dev server was running.
- Remaining risk: real-device QA should still test a long streaming response on a narrow screen to tune exact scroll offset and composer height if needed.

## 2026-06-10 - Nested Button Hydration Fix

- Fixed a React/Next hydration warning caused by full-card `<button>` elements wrapping Radix `Checkbox` buttons.
- Converted the onboarding starter-project/starter-prompts cards, Model Duel assistant selection cards, and GitHub import file rows to keyboard-accessible `div role="button"` wrappers while preserving click and Enter/Space toggling behavior.
- Verification: `npm run typecheck` passed; `npm run lint` passed with the existing 12 warnings.
- Remaining risk: browser-level manual QA should confirm each patched card still toggles as expected in its dialog.

## 2026-06-07 - 20-Commit GitHub Publish Handoff

- Prepared the 2026-06-03 artifact version history, large-conversation performance/persistence, and database performance/indexing progress for a deliberate 20-commit publish to `origin/main`.
- Scope for the publish: artifact version migrations/APIs/UI, conversation message paging and incremental persistence, bounded chat context, query caps/indexes for dashboard/admin/files/images/artifacts, focused tests, and the project task log entries above.
- Verification before slicing: `npm run test` passed with 11 files and 45 tests; `npm run typecheck` passed; `npm run lint` passed with the existing 12 warnings; `npm run build` passed with the known Node `module.register()` deprecation warning.
- GitHub note: `gh auth status` reports an invalid token, so this handoff uses direct `git push` to `origin/main` instead of GitHub CLI PR operations.

## 2026-06-03 - Artifact Version History V1

- Added Artifact Version History for saved artifacts:
  - New forward-only migration `neon/migrations/20260603_zenquanta_artifact_versions.sql` creates `zen_artifact_versions`, indexes user/artifact history lookups, and backfills one baseline version per existing artifact.
  - Drizzle schema now includes `zenArtifactVersions` with artifact/user cascade ownership and artifact-type validation.
  - Artifact repository create/update paths now write version snapshots transactionally after successful artifact writes, so all existing save-as-artifact surfaces are covered.
  - Artifact action preview remains unchanged and does not call AI or save automatically; once the user applies the preview and clicks Save, the update snapshot records `metadata.lastArtifactAction.actionType` as `created_by_action`.
- Added protected version APIs:
  - `GET /api/artifacts/[id]/versions`
  - `POST /api/artifacts/[id]/versions/[versionId]/restore`
  - `POST /api/artifacts/[id]/versions/[versionId]/duplicate`
  - Routes require authenticated users and use repository-level `userId` scoping; missing or foreign artifacts/versions return `404`.
- Updated Artifact Studio:
  - Saved artifacts now expose a History button.
  - Users can view version timestamps, artifact type, content length, action label, content, and metadata.
  - Users can copy version content, restore a version into the current artifact, or duplicate a version as a separate artifact.
- Added shared version response types and chat-context helpers for listing/restoring/duplicating versions.
- Added unit coverage for artifact-version action extraction.
- Verification: `npm run test` passed with 11 files and 45 tests; `npm run typecheck` passed; `npm run lint` passed with the existing 12 warnings; `npm run build` passed with the known Node `module.register()` deprecation warning.
- Remaining risks: runtime version backfill/restore/duplicate behavior still needs seeded Neon manual QA; version diffs are metadata/time/content preview only, not a side-by-side textual diff.

## 2026-06-03 - Large Conversation Performance And Persistence Safety

- Implemented hybrid large-conversation loading:
  - `/api/conversations` now returns lightweight conversation shells by default with preserved preview/message counts and empty `messages`.
  - `/api/conversations/[id]?messageLimit=80` returns the newest message page for normal workspace opens.
  - Added `GET /api/conversations/[id]/messages?limit=80&before=...` for older-message pagination.
  - Added optional `messagePageInfo` to conversations so the UI knows loaded count, total count, older-page cursor, and whether more history exists.
- Updated workspace behavior:
  - Initial workspace restore uses shells, then hydrates the remembered active conversation with the latest 80 messages.
  - Selecting/opening a shell conversation loads the newest message page on demand.
  - Chat area now shows a `Load older messages` control when an older-page cursor exists.
  - Sidebar local filtering now uses title, preview, project name, and attachment names; full message search remains the Neon-backed global/project search path.
- Replaced destructive message persistence for normal chat/image sends:
  - Conversation saves now upsert headers/messages instead of deleting and reinserting all messages.
  - Chat and Prism generation persist the user message plus streaming placeholder first, then update the same assistant message on completion.
  - Retry/regenerate/edit flows delete only the intended message tail before writing the new placeholder.
  - Mid-stream failures or user stops mark the persisted assistant placeholder as `error` with safe text and any partial content/sources.
- Added explicit context guards:
  - OpenRouter text context still uses memory plus recent turns, now bounded by per-message and total character caps while always preserving the latest user request.
  - `/api/chat` and `/api/images/generate` load only the newest stored message page for existing conversations and ignore client-sent conversation bodies for stored conversation context.
  - Text streaming now passes the route abort signal into the OpenRouter streaming helper.
- Added unit coverage for message-page merge/dedupe helpers and bounded context selection.
- Verification: `npm run test` passed with 10 files and 42 tests; `npm run typecheck` passed; `npm run lint` passed with the existing 12 warnings; `npm run build` passed with the known Node `module.register()` deprecation warning.
- Remaining risks: repository-level runtime behavior for tail deletion and partial failure persistence still needs seeded Neon integration tests; UI scroll-position preservation after prepending older pages is basic and may need refinement after manual QA with very long histories.

## 2026-06-03 - Database Performance And Indexing Pass

- Added forward-only Neon migration `neon/migrations/20260603_zenquanta_performance_indexes.sql`.
- Indexes added:
  - Scoped recent lists: conversations by user/project/updated and user/assistant/updated, files by user/project/created, playbooks by user/project/updated, playbook runs by user/project/created, Model Duel comparisons by user/project/created, and integration items by user/project/status/import time.
  - Billing/admin filters: usage events by subscription/created and assistant/created, image generation events by subscription/created and model/created, plan requests by status/updated.
  - Private object lookup: files by user/bucket/storage path.
  - Existing ILIKE search paths: enabled `pg_trgm` and added GIN trigram indexes for conversation title/preview, message content, artifact title/content, prompt title/content, file name, generated-image prompt, Model Duel prompt, and custom-assistant name/instructions.
- Mirrored representable b-tree indexes in `lib/db/schema.ts`; trigram/opclass indexes remain migration-only because they are search-performance details rather than table-shape metadata.
- Query and pagination changes:
  - `neonConversationRepository.list` now supports `projectId`, `limit`, `beforeUpdatedAt`, and optional message hydration; `GET /api/conversations` defaults to the latest 100 conversations while preserving the array response shape and full message hydration.
  - `GET /api/images/history` supports `limit` and `before`, defaults Prism Studio history to 80 rows, and fetches usage details only for the returned image message ids.
  - `GET /api/files` supports `limit` and `before`, defaults File Intelligence/Ask Files listing to 100 rows, and applies the cap in SQL.
  - `GET /api/artifacts` supports `limit` and `beforeUpdatedAt`/`before`, keeping the existing max cap of 100 rows.
  - Dashboard API and dashboard page now fetch current-subscription-period usage/image rows and only the recent conversations/image summaries needed for display instead of loading all user history.
  - Admin overview/user rows now resolve plan/user filters first, then fetch user-scoped usage/image events and user-scoped product rows; workflow step runs, Model Duel candidates, and source-backed messages are loaded by scoped parent ids.
  - Pulse Research Room now limits the recent conversation scan in SQL before fetching capped message/source rows.
- Remaining risks: admin activation-funnel semantics still need all-time rows for some "first event" calculations, so product tables are user-scoped but not aggressively date-pruned everywhere; full query-plan proof needs seeded Neon data and `EXPLAIN ANALYZE` outside this code-only pass.
- Verification: `npm run typecheck` passed; `npm run lint` passed with the existing 12 warnings; `npm run build` passed with the known Node `module.register()` deprecation warning.

## 2026-06-03 - File And Object Storage Security Hardening

- Reviewed private upload, generated image storage, protected file reads, file indexing/RAG, File Intelligence/Ask Files surfaces, Prism Studio gallery responses, file deletion/re-index APIs, and GitHub read-only import paths.
- Findings:
  - Protected file reads already checked Neon file ownership before object-store access, and direct object URLs were not exposed through File Intelligence or Prism Studio.
  - Uploads had a 25MB helper limit, but route-level size rejection and shared MIME/data URL/object-ref validation could be tighter.
  - Generated image ingestion rejected obvious non-HTTPS/private IPv4 URLs, but needed stronger data URL validation, image MIME checks, response size checks, and safer stored source URL validation.
  - File indexing failures were safe in UI, but persisted metadata could store raw exception messages.
  - GitHub imports were size-limited and user/project-scoped, but repo paths and skipped error reasons needed stricter normalization/scrubbing.
- Fixes made:
  - Added `lib/storage/security.ts` with shared private-file size caps, MIME normalization, object bucket/key validation, object ref validation, and strict base64 data URL parsing.
  - Enforced safe object refs in `lib/storage/object-store.ts` for local and S3/R2 put/get/delete URL construction and protected app URL creation.
  - Hardened `/api/attachments` and `lib/storage/attachments.ts` with early 25MB rejection, normalized MIME types, and strict imported data URL parsing while preserving unsupported-file upload behavior.
  - Hardened generated-image ingestion in `lib/storage/generated-images.ts` with valid image data URL parsing, HTTPS/non-private URL checks, image response MIME checks, content-length/body size caps, and safe stored `sourceUrl` handling.
  - Updated protected file reads to validate bucket/path params and use stored file names for `Content-Disposition` instead of internal object keys.
  - Made conversation, file intelligence, file chunk, Project Home, and Prism gallery URL hydration tolerant of legacy malformed object refs by omitting protected URLs instead of throwing.
  - Changed RAG indexing failure metadata to store a generic safe reason rather than raw provider/parser exception text.
  - Added GitHub repo path normalization to reject absolute, traversal, backslash, control-character, and malformed paths before listing/fetch/import, and scrubbed raw provider errors from GitHub import skipped reasons.
  - Tightened `/api/files` mixed project/conversation scope validation for Ask Files/File Intelligence listing.
  - Added Vitest coverage for storage security helpers.
- Verification: `npm run test` passed with 8 files and 38 tests; `npm run typecheck` passed; `npm run lint` passed with the existing 12 warnings; `npm run build` passed with the known Node `module.register()` deprecation warning.
- Remaining risks: full runtime proof for private object access, generated-image remote fetch behavior, and GitHub provider failures still needs seeded integration/storage fixtures; this pass keeps those paths foreground, user-scoped, and server-token-only.

## 2026-06-03 - User Scope And Privacy Hardening Pass

- Reviewed protected API route families across search, projects, conversations, artifacts, prompt workflows/AI Playbooks, prompts, custom assistants, Model Duel, Prism/images, attachments/files, dashboard/settings, admin, memory, Pulse, and GitHub integration routes.
- Confirmed safe boundaries that remain in place: normal feature routes use `requireAuthenticatedUser`, admin APIs use `requireAdminApiUser`, search repositories are user-scoped, private file reads stay behind `/api/files/object`, Prism stays on `/api/images/generate`, GitHub integration remains read-only/server-token-only, and admin raw-cost analytics remain admin-only.
- Issues found and fixed:
  - Scrubbed `/api/dashboard` `recentImages` so normal-user responses return safe summaries instead of raw `ImageGenerationEvent` rows with raw cost, margin, or private output URL arrays.
  - Scrubbed `/api/images/history` and `/api/images/history/[id]` so Prism Studio receives protected app image URLs only and does not receive stored provider/source URLs.
  - Validated conversation create/update `projectId` ownership before persisting, preserving `project-inbox` through the owned default-project path.
  - Added early `404` checks in `/api/chat` and `/api/images/generate` when a supplied `conversationId` is missing or foreign, and validated client-supplied new conversation project scope before generation/persistence.
  - Validated AI Playbook create/update `projectId` ownership before repository writes.
  - Tightened mixed `projectId` plus `conversationId` inputs for attachments and playbook runs so both IDs must be owned and the conversation must belong to the supplied project.
- Added `SECURITY_CHECKLIST.md` with route protection expectations for auth, ownership, private file/image URLs, billing/cost data, integrations/secrets, search, and memory.
- Added focused Vitest coverage for safe dashboard image mapping and project/conversation scope helpers.
- Verification: `npm run test` passed with 7 files and 33 tests; `npm run typecheck` passed; `npm run lint` passed with the existing 12 warnings; `npm run build` passed with the known Node `module.register()` deprecation warning.
- Remaining risks: dynamic cross-user route checks still need seeded Neon/API fixtures for full runtime coverage; this pass used code review plus pure unit tests for the highest-risk response mapping and scope-validation seams.

## Post-Feature Product Audit - 2026-06-02

Documentation-only audit after the recent feature wave. No product features, routes, APIs, auth, billing, storage, styling, dependencies, or runtime behavior were changed for this audit.

| Feature | Status | Main files involved | API routes involved | Database tables / migrations | UI entry point | Known risks | Recommended follow-up |
|---|---|---|---|---|---|---|---|
| Command palette | Implemented | `components/chat/command-palette.tsx`, `components/chat/chat-layout.tsx`, `lib/chat-context.tsx` | Uses `/api/search` for workspace search; navigates existing routes | No dedicated migration | Cmd/Ctrl+K in authenticated workspace | Palette now owns many workspace tool entry points, so regressions can affect navigation broadly | Add focused keyboard/navigation tests and keep command labels synced with feature names |
| Global search | Implemented | `lib/db/repositories/search.ts`, `app/api/search/route.ts`, `components/chat/command-palette.tsx` | `GET /api/search` | Existing Neon tables across projects, conversations, messages, artifacts, prompts, workflows, assistants, files, images, comparisons | Command palette search | Simple ILIKE search, no ranking/indexing strategy yet | Add Postgres full-text indexes/ranking after usage patterns settle |
| Onboarding and starter packs | Implemented | `app/api/onboarding/route.ts`, `components/chat/onboarding-dialog.tsx`, `lib/config/onboarding.ts`, `lib/chat-context.tsx` | `POST /api/onboarding`, `/api/settings` | `zen_user_settings` JSONB; optional `zen_projects`, `zen_prompt_library` | First authenticated empty workspace; Settings reopen action | State lives in settings JSON, so schema is flexible but less queryable | Add analytics for completion/skip and starter-pack usefulness |
| Project Home | Implemented | `components/chat/project-home.tsx`, `lib/db/repositories/project-home.ts`, `app/api/projects/[id]/home/route.ts` | `GET /api/projects/[id]/home` | Aggregates `zen_projects`, `zen_conversations`, `zen_files`, `zen_generated_images`, `zen_prompt_workflows`, `zen_artifacts`, integration items | Project selector/sidebar explicit home action | Aggregate query breadth grows as feature count grows | Add pagination/lazy section loading if project data becomes large |
| Project-specific search | Implemented | `lib/db/repositories/search.ts`, `app/api/search/route.ts`, `components/chat/command-palette.tsx` | `GET /api/search?q=&projectId=` | Existing project-scoped Neon tables | Command palette scope toggle; Project Home search action | Prompt library/custom assistants remain global-only because they have no `projectId` | Consider project association for prompts/assistants before expanding scope |
| Artifact Studio | Implemented | `components/chat/artifact-studio.tsx`, `lib/db/repositories/artifacts.ts`, `lib/artifacts/validation.ts` | `GET/POST /api/artifacts`, `GET/PATCH/DELETE /api/artifacts/[id]` | `zen_artifacts`; `20260526_zenquanta_artifacts.sql` | Workspace Artifact Studio, message actions, command palette, Project Home | No version history or rich editor; content stored as text | Add lightweight revisions/version restore before collaborative editing |
| Artifact actions | Implemented | `app/api/artifacts/[id]/actions/route.ts`, `lib/artifacts/actions.ts`, `components/chat/artifact-studio.tsx` | `POST /api/artifacts/[id]/actions` | `zen_artifacts`, `zen_usage_events` | Artifact Studio action preview panel | Preview is not persisted; over-limit users depend on existing billing errors | Add optional save-as-new-version once artifact revisions exist |
| AI Playbooks | Implemented | `components/chat/playbook-studio.tsx`, `lib/db/repositories/prompt-workflows.ts`, `lib/config/playbook-templates.ts` | `/api/prompt-workflows`, `/api/prompt-workflows/[id]`, `/api/prompt-workflows/[id]/runs` | `zen_prompt_workflows`, steps, runs, step runs; prompt workflow migrations | Composer, command palette, Project Home | Foreground execution only; no durable background automation | Add clearer run recovery for interrupted foreground sessions |
| Playbook Builder improvements | Implemented | `components/chat/playbook-studio.tsx`, `lib/utils/prompt-workflows.ts`, `lib/db/repositories/prompt-workflows.ts` | Existing `/api/prompt-workflows*` routes | `zen_prompt_workflows.metadata`; `20260528_zenquanta_playbook_builder_metadata.sql` | Playbook Studio builder | Usage estimate is qualitative only; metadata remains JSONB | Add validation/UI tests for variables, previous-output chaining, and preview |
| Smart Assistant Router | Implemented | `hooks/usePromptPrecheck.ts`, `components/chat/assistant-recommendation-chip.tsx`, `lib/router/*`, `components/chat/composer.tsx` | `POST /api/assistant-recommendations` telemetry | `zen_assistant_recommendation_events` | Composer recommendation chip and send-time fallback | Rule-based recommendations can be noisy for ambiguous prompts | Add telemetry review loop and per-user suppression controls |
| Assistant Handoffs | Implemented | `components/chat/message.tsx`, `lib/assistant-handoffs.ts`, `lib/chat-context.tsx` | Existing `/api/chat` or `/api/images/generate` through send pipeline | Normal conversations/messages and usage events | Assistant message `Send to...` menu | Prompt templates are local and not persisted as handoff metadata | Add analytics for accepted handoff targets and prompt quality tuning |
| Quality-check actions | Implemented | `components/chat/message.tsx`, `lib/assistant-quality-actions.ts`, `lib/chat-context.tsx` | Existing `/api/chat` or `/api/images/generate` through send pipeline | Normal conversations/messages and usage events; artifacts if saved | Assistant message `Quality` menu | V1 stores only normal messages, not action metadata | Add lightweight action outcome telemetry if useful |
| Memory Vault | Implemented | `components/chat/memory-vault.tsx`, `lib/db/repositories/memory-vault.ts`, `lib/ai/memory.ts` | `GET /api/memory-vault`, `PATCH/DELETE /api/conversations/[id]/memory` | `zen_conversations.memory_summary`, `memory_updated_at`, `session_settings`; no new migration | Settings, command palette, Project Home memory status | Project memory is derived from conversation memory; no dedicated preference vault | Add explicit user preference store only after privacy model is designed |
| Model Duel | Implemented | `components/chat/model-comparison-button.tsx`, `lib/db/repositories/model-comparisons.ts`, `app/api/model-comparisons/route.ts` | `POST /api/model-comparisons`, `POST /api/model-comparisons/[id]/choose` | `zen_model_comparisons`, `zen_model_comparison_candidates`; `20260522_zenquanta_model_comparisons.sql` | Composer and command palette | Blind/scoring labels are mostly session-level; text-only by design | Persist scoring labels if users rely on them outside artifact saves |
| Prism Studio | Implemented | `components/chat/prism-studio.tsx`, `lib/db/repositories/generated-images.ts`, `lib/storage/generated-images.ts` | `/api/images/history`, `/api/images/history/[id]`, existing `/api/images/generate` | `zen_generated_images`; `20260528_zenquanta_prism_studio_metadata.sql` | Command palette, composer image tools, Project Home | Four-more-like-this sends multiple normal image requests; old rows may lack project/favorite metadata | Add pagination and stronger gallery asset health checks |
| Pulse Research Room | Implemented | `components/chat/pulse-research-room.tsx`, `lib/db/repositories/pulse-research.ts`, `lib/search/web-search.ts` | `GET /api/pulse/research-room`; research actions use `/api/chat` | `zen_messages.sources`, `zen_artifacts`; no source-table migration | Command palette and Project Home research action | No separate source database; Tavily unavailable cases are not logged in v1 | Add source bookmark/history table and Tavily health telemetry |
| File Intelligence Cards | Implemented | `components/chat/file-intelligence-card.tsx`, `lib/files/intelligence.ts`, `lib/db/repositories/files.ts` | `GET /api/files`, `POST /api/files/[id]/reindex`, `DELETE /api/files/[id]`, `/api/files/object` | `zen_files`, `zen_file_chunks`; file knowledge migration | Chat attachments, Project Home, Settings recent attachments | Re-index requires embeddings plus stored object; external GitHub files lack object downloads | Add bulk file manager and clearer external-file action states |
| Ask Files | Implemented | `components/chat/ask-files-panel.tsx`, `lib/chat-context.tsx`, `lib/rag/retrieval.ts` | Uses `GET /api/files` and normal `/api/chat` with `fileContext` | `zen_files`, `zen_file_chunks` | Command palette, Project Home, File Intelligence Card Ask action | Large project scopes may attach too many indexed files; citations depend on returned chunks | Add selection caps/pagination and richer citation UI |
| PDF text extraction without OCR | Implemented | `lib/rag/extraction.ts`, `lib/rag/indexing.ts`, `lib/utils/files.ts` | Existing upload/reindex APIs | `zen_files.metadata.knowledgeBase`, `zen_file_chunks`; no PDF-only migration | File upload, re-index, Ask Files/File Intelligence status | Scanned/image-only PDFs are skipped; layout/table fidelity is limited | Keep OCR as explicit future milestone and add sample PDF fixtures/tests |
| Usage transparency | Implemented | `components/chat/usage-transparency-hint.tsx`, `components/chat/composer.tsx`, `app/api/dashboard/route.ts` | `GET /api/dashboard` safe summary | Existing subscriptions/usage/image events/plan requests | Chat/image composer | Usage level is qualitative and not a billing quote | Calibrate hints against real usage distribution and user feedback |
| Upgrade nudges | Implemented | `lib/billing/upgrade-nudges.ts`, `components/chat/usage-transparency-hint.tsx`, `app/pricing/page.tsx`, `app/dashboard/page.tsx` | `GET /api/dashboard`, `GET/POST /api/plan-requests` | `zen_plan_change_requests`, `zen_subscriptions`, usage tables | Composer, pricing, dashboard | Dismissal is session-local; rejected admin notes need careful display | Add persistent per-surface dismissal and admin-note length/safety review |
| Admin product analytics | Implemented | `lib/db/repositories/admin.ts`, `app/admin/page.tsx`, `app/api/admin/overview/route.ts` | `GET /api/admin/overview`, admin users/plan routes | Existing usage, profile, project, file, image, workflow, comparison, assistant tables | `/admin` | Computed at request time; Tavily unavailable not logged | Add cached/periodic aggregates if admin data grows |
| Custom Assistant Builder v2 | Implemented | `components/chat/custom-assistant-button.tsx`, `lib/custom-assistants/validation.ts`, `lib/db/repositories/custom-assistants.ts` | `/api/custom-assistants`, `/api/custom-assistants/[id]`, `/api/custom-assistants/test` | `zen_custom_assistants.metadata`; `20260528_zenquanta_custom_assistant_builder_v2.sql` | Private Assistants studio and custom assistant selector | Starter prompts are metadata-linked ids, not a join table; text-only by design | Add project availability only with explicit scoping rules |
| Integration architecture planning | Implemented | `AI_DECISIONS.md`, `AI_TASK_LOG.md`, `AI_PROJECT.md`, `AI_CHECKLIST.md` | None | Future `zen_integration_accounts`/`zen_integration_items` concept; GitHub now implemented | Documentation only | Provider order changed in practice because GitHub was implemented first | Reconcile provider roadmap after GitHub production learnings |
| GitHub read-only integration | Implemented | `lib/integrations/github.ts`, `lib/integrations/github-import.ts`, `components/chat/github-integration-panel.tsx`, `lib/db/repositories/integrations.ts` | `/api/integrations/github/*` | `zen_integration_accounts`, `zen_integration_items`, `zen_files`, `zen_file_chunks`; `20260528_zenquanta_github_readonly_integrations.sql` | Project Home, command palette, GitHub repo context panel | Requires external GitHub App config; no background sync; imported files are not object-store downloads | Validate production GitHub App permissions, add provider health checks, and design optional remove-imported-content flow |

### Cross-Cutting Findings

- New protected feature routes use `requireAuthenticatedUser`; admin analytics routes use `requireAdminApiUser` and admin pages use `requireAdmin`.
- Normal user dashboard/pricing surfaces show displayed usage, while raw cost appears confined to billing internals and admin pages/APIs.
- Prism image generation remains separate through `/api/images/generate`; `/api/chat` rejects Prism/image-mode requests.
- Private files use `/api/files/object` and file intelligence APIs; GitHub-imported files are private Neon knowledge records, not object-store downloads in v1.
- Search is Neon-backed and user-scoped, with project ownership validated before project searches.
- GitHub integration is read-only GitHub App based, foreground-only, and has no issue, PR, commit, branch, webhook-processing, or write behavior.
- No Supabase runtime clients or Stripe/payment automation were found. Historical Supabase migrations remain reference-only.

### Verification

- `npm run typecheck`: passed.
- `npm run lint`: passed with 12 existing warnings in `components/chat/chat-image-message.tsx`, `components/chat/composer.tsx`, `components/chat/message.tsx`, `components/chat/mode-switcher.tsx`, `components/chat/settings-modal.tsx`, `components/chat/sidebar.tsx`, `components/ui/use-toast.ts`, `hooks/use-toast.ts`, `lib/ai/chat.ts`, `lib/db/repositories/model-comparisons.ts`, and `lib/utils/files.ts`.
- `npm run build`: passed with the known Node `module.register()` deprecation warning.

## Product Feature Readiness Audit

Audit date: 2026-05-26. Documentation-only audit before new product features; no runtime behavior changed.

### Implementation Map

- Workspace state management is centralized in `lib/chat-context.tsx` through `ChatProvider` and `useChatContext`. It owns auth/session restore, conversations/current chat, current assistant mode, app/session settings, streaming state, sidebar/settings UI state, sidebar `searchQuery`, projects/selected project, prompt library, prompt workflows, custom assistants, queued workflow prompts, attachment upload, text send, Prism image send, prompt workflow runs, and model comparisons.
- New client features should reuse the existing `requestJson`, `loadAuthedData`, `upsertConversation`, `applyConversationPatch`, `persistConversationMutation`, `uploadAttachments`, `runTextAction`, `runImageAction`, `runPromptWorkflow`, `runModelComparison`, and `chooseModelComparisonResponse` patterns instead of creating a second client store.
- Neon repositories are server-only singleton modules under `lib/db/repositories/*`. User-owned writes generally call `neonUsersRepository.ensureUserReference(userId)` or route handlers call `neonProfilesRepository.ensureFromAuthUser(auth.user)` before repository work. Repositories use Drizzle, row mapper helpers, ISO/JSON normalization helpers, scoped `userId` filters, and `returning()`/upsert patterns.
- API routes in `app/api/*` use Node runtime route handlers, `requireAuthenticatedUser` or `requireAdminApiUser`, defensive JSON parsing, repository calls, `NextResponse.json`, and refreshed session cookies through `appendAuthCookies`. Text chat remains streamed NDJSON from `/api/chat`; Prism image generation remains JSON from `/api/images/generate`.
- Chat UI composition is provider-shell based: `ChatLayout` wraps `AuthGate`, `Sidebar`, `Header`, `ChatArea`, `SettingsPanel`, `SettingsModal`, and assistant dialogs. `components/chat/*` are client components that consume `useChatContext`. `components/ui/*` follow shadcn/Radix-style primitives with `cn`, `data-slot`, CVA variants, `asChild`, dialogs/dropdowns/tooltips, and lucide/local icon buttons.
- Storage locations: projects -> `zen_projects`; conversations -> `zen_conversations`; messages -> `zen_messages`; memory summary -> conversation memory fields; prompts -> `zen_prompt_library`; prompt workflows -> `zen_prompt_workflows`, `zen_prompt_workflow_steps`, `zen_prompt_workflow_runs`, and `zen_prompt_workflow_step_runs`; text model comparisons -> `zen_model_comparisons` and `zen_model_comparison_candidates`; custom assistants -> `zen_custom_assistants`; settings -> `zen_user_settings`; file metadata -> `zen_files`; file chunks/embeddings -> `zen_file_chunks`; generated image metadata -> `zen_generated_images`; image usage/history -> `zen_image_generation_events`; text usage -> `zen_usage_events`; plans/manual activation/admin audit -> `zen_subscriptions`, `zen_usage_limit_overrides`, `zen_plan_change_requests`, and `zen_admin_audit_logs`.
- Files and generated images use the neutral object storage layer in `lib/storage/object-store.ts`, with local development storage plus S3-compatible/R2 support. Private reads go through `/api/files/object`; raw files stay outside Neon.
- Usage enforcement remains in `lib/billing/enforce.ts`, estimation in `lib/billing/costs.ts`, and logging/counter increments in `lib/billing/log-usage.ts`.
- Package manager evidence is split: repo docs and scripts use `npm install` / `npm run ...`, but the only lockfile is `pnpm-lock.yaml` and `AI_CHECKLIST.md` notes `node_modules/.pnpm`. Treat npm scripts as the current documented workflow, but do not change dependencies or lockfiles until npm vs pnpm is explicitly standardized.

### Feature Readiness Risks

- Global search: sidebar search is currently client-side workspace filtering only; there is no dedicated global search API or indexed search surface across projects, conversations, prompts, files, and generated images. Any server search must stay user-scoped and avoid exposing private file object paths.
- Project home: projects and conversations are Neon-backed, but `projectId` is a text field on several tables rather than a foreign-keyed relationship to `zen_projects`; project surfaces must tolerate missing/deleted project ids and should reuse existing project/conversation repositories first.
- Artifacts: messages support attachments, generated-image attachments, sources, usage, and metadata, but there is no dedicated artifact/version table. Artifact work should first define a minimal Neon metadata model and preserve private object access controls.
- Playbooks: prompt workflows are implemented and tracked, but execution is intentionally client-queued through normal chat/image sends, not a durable background automation engine. Richer playbooks must not bypass billing, memory, web search, file context, or transport separation.
- Memory vault: conversation memory fields exist, but there is no cross-conversation memory vault table or user-facing consent/scoping model. This is privacy-sensitive and should follow explicit project/user scoping.
- Pulse research: Tavily-backed Pulse/webSearch is implemented and degrades without `TAVILY_API_KEY`, but it is source-snippet context injection, not a crawler, saved research archive, or long-running research workflow.
- Prism gallery: `/api/images/history` reads image usage events and `zen_generated_images` stores durable metadata, but a gallery should prefer private stored image URLs/metadata and avoid assuming all historical output URLs are durable or public.
- Onboarding: first-run setup now stores state in the user settings payload and creates starter prompts/projects through Neon repositories. There is still no dedicated onboarding table.
- Cross-cutting risks: conversation saves still delete/reinsert messages; local object storage is development-oriented and S3/R2 must be validated for production; the hardcoded admin fallback in `lib/db/repositories/profiles.ts` remains; OCR/image-only PDF RAG is not implemented; lint currently passes with existing warnings; there is no dedicated test script.

### Recommended Feature Build Order

1. Verification and hardening baseline: standardize package manager, clean lint warnings, keep typecheck/lint/build meaningful, validate Neon migrations and S3/R2 production storage.
2. Read-only global search v1 over already-Neon-backed projects, conversations/messages, prompts/workflows, custom assistants, file metadata, and generated-image metadata, with strict user scoping.
3. Project home using existing projects, conversations, prompts/workflows, files, usage, and dashboard data.
4. Prism gallery using `zen_generated_images`, `zen_image_generation_events`, and private object URLs.
5. Artifacts metadata model/UI layered over messages, files, generated images, and sources.
6. Playbooks v2 on top of prompt workflows, keeping execution through existing chat/image routes.
7. Pulse research improvements: clearer source UX, Tavily limit handling, optional saved research snapshots in Neon.
8. Memory vault after explicit consent, scoping, retention, and admin/privacy rules are designed.
9. Onboarding after the main workspace surfaces are stable, reusing auth/profile/settings/subscription state.

### Verification

- `npm run typecheck` passed after the audit entry.
- `npm run lint` passed after the audit entry with 14 existing warnings: `<img>` usage in chat image/message components, hook dependency cleanup in `components/chat/composer.tsx`, several unused variables/imports, and the existing toast action type warning.

## Completed Work

### 2026-06-03 - Playwright E2E Smoke Test Setup

- Added a small Playwright route/form smoke suite with `npm run test:e2e`, `playwright.config.ts`, and `tests/e2e/smoke.spec.ts`.
- Covered service-free unauthenticated flows: root auth gate, sign-in form, sign-up form, protected dashboard/pricing/admin redirects, and public assistant pages for Nova, Velora, Axiom, Forge, Pulse, and Prism.
- Documented authenticated E2E limitations in `tests/e2e/README.md`: workspace rendering, command palette, and global search need a future seeded Neon test database/session fixture rather than mocked production credentials or weakened auth.
- Updated `AI_CHECKLIST.md` with E2E commands, scope, and the Playwright Chromium install fallback.
- Preserved constraints: no real OpenRouter, Tavily, Neon data setup, S3/R2, GitHub, Supabase, Stripe, production credentials, auth bypass, or runtime behavior changes.
- Verification: `npx playwright install chromium` was required once locally; `npm run test:e2e` passed with 12 Chromium smoke tests; `npm run test` passed with 6 files and 29 tests; `npm run typecheck` passed; `npm run lint` passed with the existing 12 warnings; `npm run build` passed with the known Node `module.register()` deprecation warning.

### 2026-06-03 - Basic Automated Test Setup

- Added a lightweight Vitest unit-test foundation with `npm run test` and `npm run test:watch`, using `vitest.config.ts` with Node environment and the existing `@/` alias.
- Added pure unit coverage for assistant routing/config helpers, prompt precheck recommendations, pricing/billing display helpers, upgrade nudge helpers, file utility/status helpers, custom assistant validation, playbook variable/interpolation helpers, and search result normalization/sorting helpers.
- Extracted pure search result helper logic into `lib/search/search-result-utils.ts` and kept the Neon search repository behavior unchanged by reusing that helper from `lib/db/repositories/search.ts`.
- Updated `AI_CHECKLIST.md` with the new test commands and the unit-test boundary: no OpenRouter, Tavily, Neon, object storage, GitHub, Supabase, Stripe, browser automation, paid services, or real secrets required.
- Preserved existing uncommitted smoke-test documentation and did not change runtime routes, auth, billing, storage, AI gateways, payment behavior, or external service integrations.
- Verification: `npm run test` passed with 6 files and 29 tests; `npm run typecheck` passed; `npm run lint` passed with the existing 12 warnings; `npm run build` passed with the known Node `module.register()` deprecation warning.

### 2026-06-03 - Manual Product Smoke Test Checklist

- Added `docs/manual-product-smoke-test.md` as a documentation-only manual QA checklist covering auth, core workspace, projects, search, artifacts, AI Playbooks, assistants, files/RAG, Pulse, Prism, usage/plans, admin, GitHub read-only integration, and final regression checks.
- The checklist includes test run metadata, environment prerequisites, safe-test warnings, pass/fail/blocked fields, steps, expected results, related routes/APIs, and notes for each smoke test.
- Preserved constraints: no route/API/auth/billing/storage/runtime behavior changes, no Supabase runtime, no Stripe/payment automation, OpenRouter remains the AI gateway, Prism stays on `/api/images/generate`, and private files stay behind protected file routes.
- Verification: `git diff --check` passed; `npm run typecheck` passed; `npm run lint` passed with the existing 12 warnings; `npm run build` passed with the known Node `module.register()` deprecation warning.

### 2026-05-28 - GitHub Read-Only Integration V1

- Added read-only GitHub App integration scaffolding with Neon `zen_integration_accounts` and `zen_integration_items` tables, plus protected `/api/integrations/github/*` routes for connect callback, status, repo listing, safe file listing, selected import, explicit re-import, and local disconnect.
- Implemented server-only GitHub App JWT and installation-token helpers using Node crypto/fetch only; no OAuth package, webhook processor, write endpoint, Supabase, Stripe, external vector DB, or new AI gateway was added.
- Imports are foreground and user-selected. V1 offers README, `package.json`, and safe text/source files under per-file and total size limits, skips dependencies/build outputs/lockfiles/secrets-like paths/binaries, and stores imported content as private `zen_files` metadata plus `zen_file_chunks` through the existing RAG indexing path.
- Added a GitHub repo context workspace panel, command palette action, and Project Home GitHub section with connected account, imported repo/file counts, last import, re-import, disconnect, and Ask Files handoff.
- Historical note: at the time, GitHub App env placeholders were added to `.env.example`; current setup now documents these keys as `.env.local` placeholders instead.
- Verification: `npm run typecheck` passes; `npm run lint` passes with the existing 12 warnings; `npm run build` passes with the existing Node `module.register()` deprecation warning.
- Remaining risks: GitHub App installation must be configured externally with read-only Metadata/Contents permissions; v1 stores imported snapshots in Neon chunks/file metadata rather than object-store snapshots, so protected file download is not available for GitHub-imported external files; imports are capped foreground operations with no scheduled sync or webhook refresh.

### 2026-05-28 - Read-Only Integrations Architecture Plan

- Added a documentation-only `AI_DECISIONS.md` section titled “Read-Only Integrations Architecture Plan.”
- Planned future Google Drive, Notion, GitHub, and later Slack/Discord integrations as read-only, user-selected, Neon-backed sources that import selected content into the existing private `zen_files` and `zen_file_chunks` knowledge path.
- Documented future `zen_integration_accounts` and `zen_integration_items` concepts, encrypted server-only token storage, foreground import/refresh/revoke flows, Project Home/Ask Files/File Intelligence surfaces, and Google Drive as the recommended first integration.
- Preserved constraints: no OAuth implementation, no connector code, no OAuth packages, no schema migration, no runtime behavior change, no Supabase, no Stripe, no MCP runtime, no external vector DB, and no background-job system.
- Verification: not run because this was Markdown documentation only.

### 2026-05-28 - Private Custom Assistant Builder V2

- Added additive Neon metadata support for private custom text assistants through `zen_custom_assistants.metadata`, with structured tone, response style, suggested use cases, pinned state, and attached starter prompt ids.
- Added protected `POST /api/custom-assistants/test` for unsaved assistant drafts. The route validates the draft, rejects Prism/image modes through existing text-mode validation, runs through the existing OpenRouter text generation helpers, enforces plan/model limits, logs text usage, and returns scrubbed user-safe usage only.
- Upgraded the workspace custom assistant UI into a Private Assistants studio with assistant cards, pin/favorite, edit, duplicate, delete, structured builder fields, prompt-library attachment metadata, and a billed test panel.
- Preserved constraints: custom assistants remain private/user-owned and text-only; no public marketplace, no new AI gateway, no billing bypass, no raw cost exposure, no Supabase, and no Stripe.
- Verification: `npm run typecheck` passes; `npm run lint` passes with 12 existing warnings; `npm run build` passes with the known Node `module.register()` deprecation warning.
- Remaining risks: v2 starter prompts attach existing prompt-library records by id; it does not create a separate assistant-prompt join table or project-specific availability enforcement.

### 2026-05-28 - PDF Text Extraction V1

- Added `pdf-parse` as a server dependency through pnpm for in-process text extraction from text-based PDFs. Dependency justification: v2 is TypeScript/cross-platform, runs locally on private uploaded bytes, and exposes `PDFParse#getText()` for plain text extraction.
- Updated uploaded-file knowledge extraction so text/code files keep the existing path while PDFs are parsed server-side, normalized, chunked, embedded, stored in `zen_file_chunks`, and surfaced through the same File Intelligence status metadata.
- Image-only or empty PDFs are marked as skipped with the clear no-OCR reason: `No embedded text was found. OCR/image-only PDFs are not supported yet.`
- Password-protected or malformed PDFs are marked unsupported with safe user-facing reasons, while unexpected extraction/indexing failures continue to be recorded as failed metadata without blocking upload completion.
- Removed the old client-side PDF printable-string scraping from pending attachments so raw PDF bytes no longer inject noisy excerpts into chat context.
- Preserved constraints: no OCR, no external parsing service, no external vector DB, no Supabase, no storage changes, no new APIs, and embeddings remain server-only.
- Verification: `npm run typecheck` passes; `npm run lint` passes with 12 existing warnings; `npm run build` passes with the known Node `module.register()` deprecation warning.
- Remaining risks: PDF text extraction quality depends on embedded text quality and PDF structure; tables/layout reconstruction and scanned PDFs remain out of scope.

### 2026-05-28 - File Intelligence Cards V1

- Added protected `/api/files`, `/api/files/[id]/reindex`, and `/api/files/[id]` DELETE APIs for user-scoped file intelligence, safe re-indexing, and removal.
- Added file intelligence normalization over existing `zen_files.metadata.knowledgeBase` and chunk counts from `zen_file_chunks`, with safe statuses for indexed, skipped, unsupported, failed, and pending files.
- Added reusable File Intelligence Cards across chat attachments, Settings recent attachments, and Project Home uploaded files, including protected view/download links, status badges, safe reasons, Ask, Re-index, and Remove actions.
- Extended workspace state so “Ask about this file” prepares a draft with the existing file attachment and does not send automatically.
- Preserved constraints: no schema migration, no direct bucket URL exposure, no Supabase, no new storage provider, no OCR extraction, no billing changes, and no knowledge claims when files are not indexed.
- Verification: `npm run typecheck` passes; `npm run lint` passes with the existing 12 warnings; `npm run build` passes with the existing Node `module.register()` deprecation warning.
- Remaining risks: deleting a file intentionally preserves historical attachment labels while removing private object access refs; scanned/image-only PDF OCR indexing remains unsupported.

### 2026-05-28 - Pulse Research Room V1

- Added protected `GET /api/pulse/research-room` backed by a server-only Neon aggregate repository over owned conversations, message-attached web sources, projects, and Pulse research artifacts.
- Added shared Pulse Research Room types and workspace state support for opening the room from the command palette and Project Home.
- Added the Pulse Research Room workspace panel with recent Pulse conversations, recent source-backed message sources, derived search prompt history, saved source artifacts, project/query filtering, Tavily availability messaging, and polished empty/loading/error states.
- Added source actions for opening, copying citations, preparing a Pulse follow-up draft, and saving a source as a user-owned `pulse_report` research artifact without AI calls.
- Added research actions for summarizing sources, finding opposing views, creating research briefs, and comparing sources through editable prompts that send via the existing `/api/chat` Pulse path only after confirmation.
- Preserved constraints: no crawler, no new search provider, no source database or migration, no background jobs, no OpenRouter bypass, no billing bypass, no Tavily key exposure, no Supabase, and no Stripe.
- Verification: `npm run typecheck` passes; `npm run lint` passes with the existing 14 warnings; `npm run build` passes with the existing Node `module.register()` deprecation warning.
- Remaining risks: v1 saved sources are Pulse artifacts rather than a dedicated bookmark table; source/search history exists only when prior messages persisted web sources.

### 2026-05-26 - AI-Assisted Artifact Actions V1

- Added protected `/api/artifacts/[id]/actions` for owned saved artifacts. The route validates the requested action, builds a bounded artifact prompt, selects a text assistant mode by action, enforces usage limits, generates through the existing OpenRouter text helper, logs text usage, and returns scrubbed client-safe usage.
- Added shared artifact action types/config for Improve writing, Make shorter, Make more professional, Expand with more detail, Turn into checklist, Turn into email, Create summary, and Find weaknesses.
- Extended Artifact Studio with an action picker, loading/error states, generated preview, Copy/Dismiss/Apply controls, and draft-only apply behavior so users still save explicitly.
- Preserved constraints: no image route calls, no background jobs, no Stripe, no Supabase, no external storage, no artifact version table, no raw model cost exposure, and no billing bypass.
- Verification: `npm run typecheck` passed; `npm run lint` passed with the existing 14 warnings; `npm run build` passed with the existing Node `[DEP0205]` `module.register()` deprecation warning; unauthenticated `POST /api/artifacts/test-artifact/actions` returned `401` on the already-running dev server at `http://localhost:3001`.

### 2026-05-26 - Artifact Studio V1

- Added Neon migration and Drizzle schema support for `zen_artifacts`, with user/project/source metadata, source/type checks, indexes, and updated-at trigger.
- Added protected artifact CRUD APIs and a server-only artifact repository with user-scoped list/get/create/update/delete operations plus owned project, conversation, and source-message validation.
- Added Artifact Studio as an authenticated workspace dialog with list/search/filter, project assignment, markdown/plain-text editing, create/update/delete, copy, and `.md` export.
- Added assistant-message and model-comparison candidate save-to-artifact actions without OpenRouter calls or billing events.
- Extended Project Home and global/project search to include artifacts and command-palette artifact targets.
- Preserved constraints: no Supabase, no Stripe, no external artifact storage, no realtime collaboration, no background AI generation, and no billing/auth behavior changes.
- Verification: `npm run typecheck` passed; `npm run lint` passed with the existing 14 warnings; `npm run build` passed with the existing Node `[DEP0205]` `module.register()` deprecation warning; unauthenticated `GET /api/artifacts` returned `401`.

### 2026-05-26 - Project Search V1

- Extended `/api/search` with optional authenticated `projectId` scoping and response scope metadata while preserving global search behavior.
- Added project-scoped search filtering in the Neon search repository for conversations, messages, files, generated images linked through project conversations, project-scoped workflows, and project-scoped model comparisons.
- Updated the command palette with “Search everywhere” and “Search this project” scope controls, grouped search results, scoped loading/error/empty states, and project-default scope when a concrete project is active.
- Wired Project Home’s search quick action to open the command palette in project scope while leaving the local Project Home dashboard filter intact.
- Preserved constraints: no vector/semantic search, no external search provider, no schema/dependency/auth/billing/storage changes, no Supabase or Stripe.
- Verification: `npm run typecheck` passed; `npm run lint` passed with the existing 14 warnings; `npm run build` passed with the existing Node `[DEP0205]` `module.register()` deprecation warning; unauthenticated `GET /api/search?q=test&projectId=project-inbox` returned `401`.

### 2026-05-26 - Project Home V1

- Added protected `/api/projects/[id]/home` backed by a Neon aggregate repository for authenticated, user-scoped project summaries.
- Added the workspace Project Home view with overview counts, recent conversations, uploaded file metadata, generated image metadata, project-scoped workflow/playbook summaries, memory status, suggested next actions, local project-home filtering, and quick actions for chat, upload, workflows, Prism, and Pulse.
- Wired Project Home into the sidebar project selector and command palette while keeping plain project selection as a chat filter.
- Preserved constraints: no OpenRouter calls on page load, no billing/auth/storage-provider/schema/dependency changes, no Supabase or Stripe, and private file reads still go through `/api/files/object`.
- Verification: `npm run typecheck` passed; `npm run lint` passed with the existing 14 warnings; `npm run build` passed with the existing Node `[DEP0205]` `module.register()` deprecation warning; unauthenticated `GET /api/projects/project-inbox/home` returned `401`.
- Remaining risks: Project Home uses current project ID text fields rather than foreign-keyed project relationships; prompt library items remain global, so project playbooks are represented by project-scoped prompt workflows only.

### 2026-05-26 - First-Run Onboarding V1

- Added onboarding state to the existing Neon-backed user settings payload with normalized `not_started`, `completed`, and `skipped` states.
- Added protected `/api/onboarding` for skip/complete actions. Completion updates default assistant settings and creates optional deterministic starter projects plus deterministic user-owned prompt library items.
- Added starter pack config for Student, Founder, Developer, Content Creator, Small Business, Research, and Agency packs. V1 installs prompt library items only; it does not create prompt workflow records or run AI calls.
- Added the authenticated workspace onboarding dialog, automatic display for empty workspaces with no completed/skipped onboarding state, Settings reopen control, and an empty-state personalization action.
- Preserved constraints: no auth security changes, no Stripe/payment automation, no Supabase runtime, no OpenRouter calls during onboarding, no billing behavior changes, and no assistant/model-limit changes.
- Verification: `npm run typecheck` passed; `npm run lint` passed with the existing 14 warnings; `npm run build` passed with the existing Node `[DEP0205]` `module.register()` deprecation warning; local dev server responded at `http://localhost:3001`; unauthenticated `POST /api/onboarding` returned `401`.

### 2026-05-26 - Global Search V1 And Command Palette

- Added protected `/api/search` with authenticated, user-scoped Neon/Postgres search across projects, conversations, messages, prompt library items, prompt workflows, custom assistants, uploaded file metadata, generated image metadata, and model comparisons.
- Added normalized search result types and a server-only `neonSearchRepository` using existing Drizzle/Postgres query patterns and simple `ILIKE` matching. No external search provider, vector database, RAG/embedding changes, Supabase, Stripe, billing behavior, or auth behavior changes were added.
- Added an authenticated workspace command palette opened from the header or Cmd/Ctrl+K. It supports workspace search, new chat, new project, dashboard/pricing navigation, assistant switching, prompt workflow runs, prompt library/model comparison/custom assistant dialogs, Prism image history navigation, project opening, recent conversation opening, and message-result scroll anchors.
- Extended `lib/chat-context.tsx` with reusable local actions for opening conversations and requesting existing workspace tool dialogs, so the palette uses current workspace state instead of creating a parallel store.
- Verification: `npm run typecheck` passed; `npm run lint` passed with the existing 14 warnings; `npm run build` passed with the existing Node `[DEP0205]` `module.register()` deprecation warning.
- Remaining risks: search is intentionally simple `ILIKE` over current user-owned Neon rows and is not ranked/indexed full-text search yet; file results expose only metadata/navigation and still depend on the private object-storage access layer for raw file reads.

### 2026-05-26 - Project Context Export

- Created `ZENQUANTA_PROJECT_CONTEXT.md` as a self-contained current project export for a new AI assistant conversation.
- Documented inspected repo facts: fresh Neon runtime data/auth, neutral private storage, OpenRouter-only AI gateway, Tavily-backed Pulse/webSearch, uploaded-file RAG, prompt workflows, text model comparison, custom text assistants, manual plan requests, and admin controls.
- Preserved current constraints: no Stripe/payment automation, no Supabase runtime reintroduction, no Supabase data or storage migration, and manual admin-driven plan activation.
- Verified after the documentation-only edit: `npm run typecheck` passed, `npm run lint` passed with 14 existing warnings, and `npm run build` passed with Node `[DEP0205]` `module.register()` deprecation warnings.

### 2026-05-22 - Shared AI Memory Files

- Created the shared AI memory system for coding agents.
- Documented that the app is a current six-assistant Zenquanta AI platform, not the old four-mode version.
- Preserved current repo facts: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui-style components, Supabase, OpenRouter, text chat via `/api/chat`, Prism image generation via `/api/images/generate`, admin/user dashboards, manual plan requests, usage tracking, conversation memory, file uploads, prompt precheck, assistant recommendations, and public assistant pages.
- Noted that payment automation is not implemented and manual plan requests are the current upgrade path.
- Noted that Pulse has current-context branding, but real web search/retrieval is not confirmed.

### 2026-05-22 - Neon Direction And Manual Billing Scope

- Updated project direction to remove payment automation from the roadmap unless explicitly requested later.
- Kept manual plan requests and admin activation as the intended upgrade flow.
- Added phased Neon Postgres migration direction: migrate database persistence first while preserving Supabase Auth and Supabase Storage until separate decisions are made.
- Documented the pre-migration state: Supabase had not been removed and remained current for auth, Postgres data, storage, subscriptions, usage records, plan requests, and admin data at that point.

### 2026-05-22 - Neon Database Migration Implementation (Superseded)

- Historical attempt that added Neon database driver dependency and a storage-layer Neon helper.
- Historical attempt that added a Neon initial schema and moved app data stores from Supabase REST calls to Neon SQL.
- Superseded by the fresh Neon foundation direction: no Supabase database rows should be imported or preserved, and runtime routes remain Supabase-backed until later explicit milestones.

### 2026-05-22 - Neon Foundation Boundary Correction (Superseded)

- Corrected the milestone back to foundation-only.
- Restored runtime `lib/storage/*` persistence stores to Supabase REST.
- Moved the Neon foundation to `lib/db/client.ts` and `lib/db/schema.ts`.
- Kept the earlier Neon SQL schema migration and env documentation for later migration work.
- Confirmed Supabase remains current for runtime app persistence, Auth, and Storage.
- Superseded by the fresh Neon foundation baseline.

### 2026-05-22 - Neon Repository Layer

- Added parallel server-only Neon repositories under `lib/db/repositories/*`.
- Covered profiles, subscriptions, usage, image generation events, plan requests, admin audit logs, projects, conversations/messages, prompts, settings, and assistant recommendation events.
- Kept routes, auth, billing, UI, file storage, and `lib/storage/*` runtime wiring on Supabase.
- Documented that repositories are migration targets only until routes are explicitly swapped.

### 2026-05-22 - First Low-Risk Neon Route Slice (Superseded)

- Migrated `/api/prompts`, `/api/prompts/[id]`, `/api/settings`, and `/api/assistant-recommendations` from Supabase storage modules to Neon repositories.
- Kept Supabase Auth, refreshed auth cookie handling, request/response shapes, and route validation behavior unchanged.
- Deferred chat, image generation, attachments, conversations, projects, dashboard, plan requests, admin flows, billing helpers, auth routes, and import-local bootstrap.
- Superseded by the fresh Neon foundation direction; runtime routes were restored to Supabase-backed stores.

### 2026-05-22 - Project And Conversation Neon Route Slice (Superseded)

- Migrated project, conversation, message, and conversation memory persistence to Neon repositories.
- Wired project/conversation API routes, text chat saves, Prism conversation saves, dashboard recent conversations, and local import project/conversation/prompt/settings writes through Neon.
- Kept Supabase Auth, Supabase Storage attachment upload/signing, billing enforcement, usage logging, plan requests, admin flows, subscriptions, and profiles on existing Supabase-backed paths.
- Superseded by the fresh Neon foundation direction; runtime routes were restored to Supabase-backed stores.

### 2026-05-22 - Fresh Neon Foundation Direction

- Changed direction so Neon starts as a fresh database, not a Supabase data migration target.
- Restored uncommitted route-level Neon wiring so runtime routes stay on the existing Supabase-backed stores.
- Replaced the old Neon initial migration with a fresh baseline schema for Zenquanta product concepts.
- Documented that Supabase rows should not be imported, copied, backfilled, or preserved in Neon.

### 2026-05-22 - Fresh Neon Repository Completion

- Completed the server-only fresh Neon repository layer under `lib/db/repositories/*`.
- Added fresh Neon user/auth identity anchoring plus metadata repositories for files and generated images.
- Made user-owned repository writes create fresh `zen_users` references when needed.
- Kept runtime routes, auth, file uploads, billing behavior, UI, and Supabase-backed stores unchanged.

### 2026-05-22 - First Active Fresh Neon Route Slice

- Migrated `/api/settings`, `/api/prompts`, `/api/prompts/[id]`, and `/api/assistant-recommendations` to Neon repositories.
- Kept Supabase Auth and refreshed auth cookie behavior unchanged.
- Ensured each migrated route creates or refreshes a fresh Neon user/profile from the current session identity.
- Kept chat, image generation, attachments, conversations, projects, dashboard, plan requests, admin routes, billing helpers, auth routes, and import-local on Supabase-backed runtime paths.
- Did not import, copy, backfill, or preserve Supabase database rows.

### 2026-05-22 - Project And Conversation Fresh Neon Route Slice

- Migrated project CRUD routes, conversation CRUD routes, message persistence, and conversation memory fields to Neon repositories.
- Moved conversation persistence inside `/api/chat` and `/api/images/generate` to Neon while keeping assistant execution, billing enforcement, and usage logging behavior unchanged.
- Moved dashboard recent conversations and local browser import app-data writes to Neon.
- Kept Supabase Auth, Supabase Storage attachments, plan requests, billing/admin plan data, admin mutations, usage records, and image history on existing Supabase-backed paths.
- Switched admin conversation/recommendation read panels to Neon so old Supabase chats are not surfaced after the conversation migration.
- Did not import, copy, backfill, or preserve old Supabase conversations or messages.

### 2026-05-22 - Usage, Manual Plan, And Admin Neon Route Slice

- Migrated billing-adjacent runtime data to fresh Neon repositories.
- Moved subscriptions, usage overrides, text usage events, image generation events, plan requests, admin audit logs, image history, dashboard data, admin data, pricing plan request flows, and profile/role hydration to Neon.
- Kept Supabase Auth sessions and Supabase Storage attachments in place.
- Preserved manual plan requests and admin activation; no payment automation was added.
- Did not import, copy, backfill, or preserve Supabase usage, subscription, or plan request rows.

### 2026-05-22 - Fresh Neon Credentials Auth

- Replaced Supabase Auth with custom Neon-backed ID/password credentials auth.
- Added local auth credentials and session tables.
- Stored password hashes with per-user salts and used opaque HTTP-only session cookies.
- Kept Supabase only for private attachment Storage.
- Did not import, copy, backfill, or preserve Supabase Auth users, sessions, or passwords; existing users need to sign up again.

### 2026-05-22 - Neutral Private File Storage

- Replaced active Supabase Storage upload/signing paths with a neutral server-only object storage abstraction.
- Added local development storage and S3-compatible/R2 production storage support.
- Added authenticated private file reads through `/api/files/object`.
- Stored new upload metadata in `zen_files` and generated-image metadata in `zen_generated_images`.
- Persisted newly generated Prism images into the same storage layer before saving conversation messages.
- Did not import, copy, backfill, or preserve old Supabase Storage objects.

### 2026-05-22 - Supabase Runtime Removal

- Removed remaining Supabase runtime clients and old Supabase-backed storage/data modules.
- Kept `supabase/migrations/*` as historical reference only and documented that they are not part of active setup.
- Kept Neon Postgres, Neon credentials auth, neutral private file storage, OpenRouter, and manual plan/admin activation as the active platform stack.
- Did not import, copy, backfill, or preserve old Supabase rows, users, sessions, passwords, or storage objects.

### 2026-05-22 - Pulse Tavily Web Search

- Added real server-side Tavily search for Pulse and the existing `webSearch` setting.
- Added source metadata to streamed and persisted assistant messages.
- Kept OpenRouter as the only AI model gateway and kept web search provider keys server-only.
- Search degrades without source claims when `TAVILY_API_KEY` is not configured.

### 2026-05-22 - Uploaded File Knowledge V1

- Added first-version project knowledge/RAG for uploaded text and code-like files.
- Added server-side text extraction, chunking, OpenAI-compatible embeddings, and Neon pgvector chunk storage.
- Wired `/api/chat` to retrieve scoped file chunks when `fileContext` is enabled and inject only relevant excerpts.
- Kept raw files private in object storage and left scanned/image-only PDF OCR handling for later.

### 2026-05-22 - Reusable Prompt Workflows V1

- Added Neon-backed reusable prompt workflows as an extension of the existing prompt library.
- Added ordered workflow steps that target Nova, Velora, Axiom, Forge, Pulse, or Prism and support `{{variable}}` placeholders.
- Added workflow CRUD APIs and lightweight workflow run/step-run tracking.
- Wired the composer prompt popover with Prompts and Workflows tabs.
- Kept workflow execution simple: each step queues a normal chat or Prism image send, so existing chat/image routes, billing, memory, file context, and web search remain the execution path.
- Did not add payment automation, background jobs, or Supabase import/backfill logic.

### 2026-05-22 - Text Model Comparison V1

- Added a text-only comparison mode that sends one prompt to multiple available text assistants through OpenRouter.
- Added Neon tables, repository, and APIs for comparison records and generated candidates.
- Logged usage for every successful candidate and stored displayed usage/latency/model metadata for comparison.
- Added a composer comparison dialog with side-by-side candidate review and a "Save as best" action.
- Saving a candidate appends only the selected response to the conversation.
- Kept normal chat, Prism image generation, billing model, and manual plan upgrades unchanged.

### 2026-05-24 - Model Comparison V1 Polish

- Hardened text model comparison so foreign or missing conversation IDs return controlled `404` errors.
- Filtered requested comparison assistants to models available on the user's tier or admin override before generation.
- Added controlled failures for inaccessible target sets and all-candidate generation failure.
- Surfaced comparison API errors in the composer dialog instead of failing silently.
- Kept comparison text-only, OpenRouter-only, Neon-backed, and free of payment automation.

### 2026-05-23 - Admin Cost And Margin Controls

- Added filter-aware admin analytics over Neon usage, image, subscription, override, profile, and plan request data.
- Added admin dashboard controls for date range, plan, assistant, and user filtering.
- Added admin-only visibility for raw model cost, displayed usage, estimated plan margin, text/image cost split, risky users near limits, high raw-cost users, expensive models, and assistant usage.
- Kept manual plan requests, admin activation, user dashboard displayed-cost behavior, and payment automation scope unchanged.

### 2026-05-25 - Admin Cost And Margin Polish

- Polished existing Neon-backed admin analytics without changing billing or plan activation behavior.
- Added display-name support in admin profile matching/display, clearer selected-period context, and manual-plan revenue labels.
- Added margin-rate and raw-cost-per-active-user detail to plan margin analytics.
- Improved risky-user ordering and avoided unusual raw-cost flags when data is too sparse.
- Kept raw costs admin-only and did not add payment automation.

### 2026-05-25 - Custom Assistant Builder V1

- Added private Neon-backed custom text assistants layered over existing built-in text modes.
- Added authenticated custom assistant CRUD routes and composer UI for create/edit/select/delete.
- Wired selected custom assistants into `/api/chat` through base-mode model routing, existing usage limits, and bounded extra system instructions.
- Kept Nova, Velora, Axiom, Forge, Pulse, and Prism unchanged; image assistants, marketplace sharing, arbitrary raw model selection, Supabase, and payment automation remain out of scope.

### 2026-05-24 - Verification Tooling Hardening

- Added an ESLint flat config for the current Next.js/TypeScript app.
- Added `npm run typecheck` as `tsc --noEmit`.
- Removed Next's TypeScript build-error ignore setting so `npm run build` runs TypeScript validation.
- Verified `npm run typecheck`, `npm run build`, and `npm run lint` run successfully, with lint warnings still present as existing cleanup work.

### 2026-05-24 - Post-Neon Cutover Hardening

- Added Neon-backed sign-in attempt limiting and stronger local password/session handling.
- Tightened private object reads, attachment scope validation, and generated-image fetch safety.
- Added focused validation for manual plan requests, admin mutations, recommendation telemetry, and workflow run conversation scope.
- Made text/image usage counter updates atomic and dashboard displayed usage period-scoped.
- Kept Supabase runtime removed, avoided data imports/backfills, and kept manual plan requests/admin activation.

### 2026-05-24 - Pulse Web Search Verification

- Verified the current Pulse/webSearch path uses server-only Tavily retrieval, injects source context into `/api/chat`, streams source metadata, and persists sources on assistant messages.
- Added a total snippet budget to web search source normalization so retrieved snippets stay bounded before model injection.
- Expanded current/research prompt signals so Pulse is recommended for more source-backed, verification, and current-landscape prompts.
- Kept OpenRouter as the only model gateway and did not add Supabase or payment automation.

### 2026-05-24 - Uploaded File RAG V1 Gap-Fill

- Verified the existing uploaded-file RAG path uses neutral storage, Neon file metadata, pgvector chunks, server-only embeddings, and `/api/chat` retrieval when `fileContext` is enabled.
- Added stricter attachment metadata validation before uploads are linked to file metadata and knowledge chunks.
- Batched embedding requests for large text/code uploads and cleared stale chunks when extraction produces no usable chunks.
- Kept v1 focused on text/code-like files; no Supabase import, scanned PDF/OCR expansion, or payment automation was added.

### 2026-05-24 - Prompt Workflow Tracking Completion

- Added authenticated workflow run and step-run status updates around the existing client-side queued workflow execution path.
- Kept workflow execution simple: each step still goes through the normal chat or Prism image send path.
- Preserved prompt library behavior, workflow CRUD, Neon persistence, and normal usage logging as the billing source of truth.
- Did not add background jobs, Supabase runtime, or payment automation.

## Current Work

- Neon database foundation is complete at the code/schema level.
- Neon repositories exist as future route-by-route migration scaffolding and now cover the fresh schema, including user anchors, file metadata, and generated image metadata.
- Settings, prompt library, assistant recommendation telemetry, projects, conversations, messages, conversation memory, subscriptions/manual plans, usage overrides, text/image usage records, plan requests, dashboard data, image history, admin data, and profile/role hydration are now backed by fresh Neon repositories.
- Chat and image routes still use existing assistant execution paths, but their conversation, billing enforcement, and usage logging data now use Neon.
- Neutral private file storage is active for new uploads and generated images.
- Reusable prompt workflows are active in the composer prompt library popover.
- Text model comparison is active in the composer for text prompts.
- Admin cost and margin analytics are active on `/admin` and are backed by stored Neon usage data.
- Local verification now includes `npm run typecheck`, production build with TypeScript validation, and ESLint flat-config linting.

## Proposed Next Work

- Decide whether the repo should standardize on npm or pnpm.
- Clean up existing lint warnings when there is a dedicated cleanup milestone.
- Validate Tavily production limits and source display behavior for Pulse/webSearch.
- Validate embeddings provider cost/limits and pgvector query quality for uploaded-file knowledge.
- Apply and validate the fresh Neon foundation migration in a real Neon database.
- Plan remaining non-storage database route migrations, if any, as explicit bounded milestones.
- Validate S3-compatible/R2 configuration for production storage.
- Do not backfill existing Supabase Postgres data into Neon.
- Keep historical Supabase migrations as reference-only unless the team explicitly decides to remove or archive them elsewhere.

## Active Bugs / Issues

- `npm run lint` runs successfully but currently reports warnings.
- Package manager guidance is unclear because `pnpm-lock.yaml` exists while `README.md` says `npm install`.
- Generated image persistence should be reviewed.

## Architecture Concerns

- Text and image transports are intentionally separate and should remain separate.
- Neon is the source of truth for runtime app data and auth sessions; neutral object storage is the source for new private uploads and generated images.
- Neon Postgres is a fresh database foundation, not an imported copy of Supabase data.
- OpenRouter is the only AI model gateway.
- Tavily is the server-side web search provider for Pulse/webSearch source context.
- Uploaded-file knowledge uses server-only embeddings and Neon pgvector; raw files remain private.
- Prompt workflows run through the existing queued send path; they are not a durable background automation engine.
- Model comparison v1 is text-only; Prism/image comparison remains separate because image generation uses a different transport and wallet.
- Billing is currently manual/admin-driven, not payment-provider-driven.
- Server-only secrets must remain out of client components.

## Testing Status

- No dedicated test script is defined in `package.json`.
- Current scripts are `dev`, `build`, `start`, `lint`, and `typecheck`.
- `npm run typecheck` runs `tsc --noEmit`.
- `npm run lint` uses the root ESLint flat config.
- `npm run build` runs Next production build with TypeScript validation enabled.

## Known Risks

- Existing lint warnings remain and should be cleaned up in a focused follow-up.
- Package manager ambiguity.
- Pulse/webSearch requires `TAVILY_API_KEY` for live retrieval; without it the chat path continues without source claims.
- Uploaded-file knowledge requires an embeddings key and pgvector migration; unsupported files are skipped rather than blocking uploads.
- Payment automation is out of scope unless explicitly requested.
- Partial Neon migration can create split-system risk; future route migrations should be explicit and bounded.
- Supabase runtime clients and old Supabase-backed storage/data modules have been removed; only historical migrations remain.

## AI Handoff Summaries

### 2026-05-28 - Prism Studio V1

- Added Prism Studio as an authenticated workspace panel for generated-image gallery browsing, project/search/date/favorite filters, protected previews, prompt copy/reuse/remix, favorites, and prompt-to-Artifact saves.
- Added additive Neon metadata support for `zen_generated_images.project_id` and `is_favorite`, including backfill/index migration `20260528_zenquanta_prism_studio_metadata.sql`.
- Extended `/api/images/history` to return user-scoped durable generated-image metadata and added protected `PATCH /api/images/history/[id]` for favorite/project updates.
- Wired Prism Studio from the composer, command palette, Project Home, and generated-image search targets; reuse/remix prepares the Prism composer without sending.
- Added explicit creative action previews: four Prism variations still dispatch through `/api/images/generate`, while ad concept/caption/campaign prompts dispatch through normal Velora text chat.
- Preserved constraints: no image generation through `/api/chat`, no image credit bypass, no external image storage, no direct private object URLs, no Supabase, and no Stripe.
- Verification: `npm run typecheck` passes; `npm run lint` passes with the existing 14 warnings; `npm run build` passes with the existing Node `module.register()` deprecation warning; `git diff --check` passes.
- Remaining risks: production databases must apply the new Prism Studio migration; “Generate 4 more” intentionally queues four one-image Prism requests because the image route remains one image per request.

### 2026-05-28 - Model Duel V1 Polish

- Polished the existing text model comparison feature into user-facing Model Duel while preserving `/api/model-comparisons`, `/api/model-comparisons/[id]/choose`, Neon comparison tables, plan/model filtering, and billing enforcement.
- Upgraded the composer dialog with premium Model Duel language, prompt preview, selected-assistant count, text-only notices, explicit usage warning, Blind Mode, and 2-4 assistant selection across Nova, Velora, Axiom, Forge, and Pulse.
- Added clearer side-by-side candidate cards with hidden identity support, completion/failure states, latency, displayed usage, token/source counts, scoring labels, winner save, and Save as Artifact actions.
- Artifact saves now include Model Duel metadata plus assigned scoring labels; winner saves still use the existing choose endpoint and append the selected response to the conversation.
- Preserved constraints: no Prism/image comparison, no new API route, no migration, no new AI gateway, no billing bypass, no raw model cost exposure, no Supabase, and no Stripe.
- Verification: `npm run typecheck` passes; `npm run lint` passes with the existing 14 warnings; `npm run build` passes with the existing Node `module.register()` deprecation warning.
- Remaining risks: Blind Mode and scoring labels are local review-state only in v1; only Artifact saves preserve scoring labels in metadata.

### 2026-05-28 - Ask Files V1

- Added an authenticated Ask Files workspace panel that lets users scope questions to selected indexed files or all indexed files in a concrete project.
- Reused existing protected file intelligence data and the normal `sendMessage` pipeline; Ask Files submits through `/api/chat` with `fileContext` enabled, selected file attachments attached, Nova/general mode by default, and normal billing/usage enforcement preserved.
- Added honest empty/config states for missing embeddings, no indexed files, unsupported/skipped/pending/failed file states, and project-wide scope requiring a concrete project.
- Wired Ask Files from Command Palette, Project Home, File Intelligence Cards in chat attachments, and Settings recent attachments. Project Home also has an Ask Files quick action.
- Updated assistant message source display so file-backed RAG sources show returned snippets when chunk-level sources exist; if no snippets are returned, the UI only shows file/source labels.
- Preserved constraints: no external vector database, no OCR extraction, no private bucket URL exposure, no Supabase, no Stripe, and no AI calls until the user submits a question.
- Verification: `npm run typecheck` passes; `npm run lint` passes with 12 existing warnings; `npm run build` passes with the known Node `module.register()` deprecation warning; `git diff --check` passes.
- Remaining risks: Ask Files depends on existing embeddings/pgvector setup and indexed text/code-like or text-based PDF uploads; project-wide scope attaches all indexed project files in v1, so very large projects may need selection caps or pagination later.

### 2026-05-28 - Memory Vault V1

- Added a protected Memory Vault workspace panel for viewing and controlling existing Neon-backed conversation memory summaries.
- Added `/api/memory-vault` plus `/api/conversations/[id]/memory` PATCH/DELETE routes backed by a user-scoped Neon memory repository. Project memory is derived by grouping owned conversation summaries by project; no project memory table or vector store was added.
- Added global memory default control through existing settings, per-conversation memory enable/disable, clear summary, copy summary, open conversation, recent memory, project memory, and saved-preference explanation UI.
- Wired Memory Vault into workspace tools, Settings, Command Palette, and Project Home memory status while preserving existing memory injection behavior in `lib/ai/memory.ts`.
- Preserved constraints: no OpenRouter calls on vault load/clear, no hidden memory store, no migrations, no billing/auth/gateway/storage behavior changes, no Supabase, and no Stripe.
- Verification: `npm run typecheck` passes; `npm run lint` passes with the existing 14 warnings; `npm run build` passes with the existing Node `module.register()` deprecation warning; `git diff --check` passes.
- Remaining risks: V1 preferences are only visible lines parsed from conversation summaries because there is no separate editable global preference model yet.

### 2026-05-28 - Quality Check Actions V1

- Added message-level Quality actions for completed assistant responses, using local prompt templates and an editable preview before anything is sent.
- Added general, Axiom, Pulse, Forge, Velora, and Prism action groups, including shorter/detail/table/action-plan transforms, source verification prompts, code review/test prompts, tone/copy prompts, and visual prompt actions.
- Quality actions dispatch through the existing `sendMessage` pipeline: text actions use `/api/chat`, Prism visual actions use `/api/images/generate`, and selected custom assistants are bypassed so action targets stay explicit.
- Kept Save as Artifact available as the existing direct action and surfaced it near the Quality menu without changing artifact APIs.
- Preserved current project/conversation context and did not add API routes, migrations, gateways, billing changes, Supabase, Stripe, or automatic AI calls.
- Verification: `npm run typecheck` passes; `npm run lint` passes with the existing 14 warnings; `npm run build` passes with the existing Node `module.register()` deprecation warning; `git diff --check` passes.
- Remaining risks: quality prompts are template-based in v1 and will likely need tuning from real user examples.

### 2026-05-28 - Assistant Handoffs V1

- Added response-level assistant handoffs from completed assistant messages through a new “Send to” menu and editable preview dialog.
- Added local handoff target config and bounded prompt generation for Nova, Velora, Axiom, Forge, Pulse, and Prism.
- Handoff sends reuse the existing `sendMessage` pipeline: text targets route through `/api/chat`, Prism targets route through `/api/images/generate`, and normal billing/usage enforcement remains in place.
- Explicit handoffs bypass the currently selected custom assistant so “Send to Forge” uses built-in Forge rather than a custom assistant layer.
- Preserved current project/conversation context and did not add API routes, migrations, gateways, Supabase, Stripe, or automatic AI calls.
- Verification: `npm run typecheck` passes; `npm run lint` passes with the existing 14 warnings; `npm run build` passes with the existing Node `module.register()` deprecation warning.
- Remaining risks: handoff prompt quality is template-based in v1 and may need product tuning after real usage.

### 2026-05-28 - Smart Assistant Router UI V1

- Added a subtle inline composer recommendation chip powered by the existing local prompt classifier and assistant precheck hook.
- The chip appears only for high-confidence assistant mismatches while recommendations are enabled, shows the recommended assistant, reason, and a simple confidence label, and supports explicit Use/Ignore actions.
- Accepting a recommendation switches the assistant locally without sending; Prism recommendations switch the composer into image mode without calling `/api/images/generate` until the user sends.
- Kept the existing send-time recommendation dialog as a fallback for immediate paste-and-send flows and continued logging telemetry through `/api/assistant-recommendations` without OpenRouter calls.
- Updated Settings copy to describe the composer suggestion instead of a modal-only flow.
- Verification: `npm run typecheck` passes; `npm run lint` passes with the existing 14 warnings; `npm run build` passes with the existing Node `module.register()` deprecation warning.
- Remaining risks: shown telemetry is keyed to debounced draft snapshots, so very long paused editing sessions may still create more than one shown event for materially changed drafts.

### 2026-05-28 - AI Playbook Builder V1 Improvement

- Added additive Neon/Drizzle workflow metadata support with `zen_prompt_workflows.metadata` for category, expected output type, suggested assistant, and private visibility.
- Extended Prompt Workflow/AI Playbook shared types, API validation, and repository normalization for workflow metadata plus step metadata (`stepType`, `outputLabel`, `includePreviousOutput`) while preserving existing route/table names.
- Upgraded Playbook Studio with structured builder fields, step metadata controls, editable variable labels/defaults/required flags, expanded prompt preview before run, required-variable validation, and low/medium/high usage warnings without raw cost exposure.
- Updated foreground playbook execution so steps that opt in receive the previous completed step output while still dispatching through the normal text chat or Prism image path and recording step `messageId`s.
- Updated starter templates with structured metadata and output labels.
- Verification: `npm run typecheck` passes; `npm run lint` passes with the existing 14 warnings; `npm run build` passes with the existing Node `module.register()` deprecation warning.
- Remaining risks: the usage indicator is intentionally rough and not a billing quote; production Neon databases must apply `20260528_zenquanta_playbook_builder_metadata.sql`.

### 2026-05-28 - Usage Transparency V1

- Added a composer-level usage transparency hint that shows friendly low/medium/high expectations before chat sends or Prism image generation.
- The hint surfaces safe, qualitative badges for premium model routing, web search, file context, and image-credit usage without exposing raw model costs or changing billing calculations.
- Reuses the existing authenticated `/api/dashboard` displayed-usage summary to show the current plan and remaining displayed usage credits when available; plan limits still remain enforced by the existing chat/image routes on send.
- Added Fast, Balanced, Best quality, and Lowest usage controls as disabled/coming-soon UI affordances so no model routing or profile behavior changes silently.
- Prism drafts now show an image-credit reminder before generation, and Model Duel’s existing warning now more clearly states that each selected assistant can generate a separate usage-consuming response.
- Preserved constraints: no Stripe, no payment automation, no Supabase, no new billing route, no raw cost display, no plan-limit bypass, and no changes to `/api/chat` or `/api/images/generate`.
- Verification: `npm run typecheck` passes; `npm run lint` passes with the existing 12 warnings; `npm run build` passes with the existing Node `module.register()` deprecation warning; `git diff --check` passes.
- Remaining risks: usage level is intentionally a rough product hint, not a quote; the profile selector is UI-only until a later milestone safely maps it to existing response/model settings.

### 2026-05-28 - Manual Plan Request And Upgrade Nudge Polish

- Extended the safe `/api/dashboard` response with user-facing limit snapshots for daily messages, daily images, image credits, displayed credits, plus latest/pending plan request status. No raw costs, margin, secrets, or override internals are returned.
- Added reusable upgrade-nudge helpers for 80% near-limit detection, manual request status labels, safe admin-note display, and existing enforcement-error recognition.
- Composer usage transparency now shows dismissible manual upgrade nudges for near-limit usage or pending plan requests, linking to `/pricing` instead of creating payment automation.
- Chat errors and Model Duel errors that come from plan/model/usage enforcement now show a clear manual-plan CTA while preserving the existing blocking behavior.
- Model Duel and high-usage AI Playbooks now include manual request nudges for Free/Basic users without pending requests; no AI call, billing, or routing behavior changed.
- Pricing now shows clear no-request, pending, approved, activated, and rejected states; duplicate pending requests stay disabled, rejected admin notes are shown only as short plain text, and admin activation remains unchanged.
- Dashboard now shows the latest plan request status card with a link back to pricing.
- Verification: `npm run typecheck` passes; `npm run lint` passes with the existing 12 warnings; `npm run build` passes with the existing Node `module.register()` deprecation warning; `git diff --check` passes.
- Remaining risks: near-limit nudges are session-dismissed only in v1; persistent dismissal or finer per-limit thresholds can be added later if the prompts feel too frequent.

### 2026-05-28 - Admin Product Analytics V1

- Extended the admin overview data with Product Analytics for activation funnel, feature adoption, file indexing outcomes, and operational signals using existing Neon tables.
- Added activation counts for signed-up users, first text message, first non-default project, first file upload, first playbook run, first Prism image, and first Model Duel, with existing admin date/plan/assistant/user filters applied where relevant.
- Added feature adoption counts for projects, prompt saves, playbook runs, Model Duel runs, Prism generations, Pulse source-backed chats, file uploads/indexing status, and custom assistants.
- Added operational signals for failed Prism metadata rows, file indexing skipped/unsupported/failed, failed playbook runs, failed Model Duel candidates, users near limits, top raw-cost model, and an honest “Tavily unavailable not logged in v1” signal.
- Added safe failed Prism metadata logging after image request preparation so admin analytics can count generation failures without exposing private object URLs or changing image-credit enforcement.
- Updated the admin dashboard UI with Activation funnel, Feature adoption, File indexing outcomes, and Operational signals cards while preserving existing admin-only cost/margin sections.
- Preserved constraints: no third-party analytics, no Stripe, no Supabase, no payment automation, no new public routes, no raw cost exposure to normal-user APIs.
- Verification: `npm run typecheck` passes; `npm run lint` passes with the existing 12 warnings; `npm run build` passes with the existing Node `module.register()` deprecation warning; `git diff --check` passes.
- Remaining risks: analytics are computed at request time from current tables; Tavily unavailable cases remain unlogged until a future explicit telemetry slice.

### 2026-05-26 - AI Playbooks V1 Polish

- Polished Prompt Workflows into user-facing AI Playbooks while preserving the existing `/api/prompt-workflows*` routes, Neon tables, repository names, and foreground execution model.
- Added `components/chat/playbook-studio.tsx`, mounted it in the authenticated workspace shell, and wired it from the composer, command palette, Project Home quick actions, and project-scoped playbook links.
- Added starter AI Playbook templates in `lib/config/playbook-templates.ts`; templates install only after user action and create normal user-owned prompt workflow records.
- Added protected `GET /api/prompt-workflows/[id]/runs` plus repository run-history enrichment with step output messages when `messageId` exists.
- Updated the client playbook runner to execute each step through the normal text/Prism send path and record completed step `messageId` values for future run history/final output review.
- Added final-output review actions in Playbook Studio, including open conversation, copy/export, and Save as Artifact with `sourceType: workflow_run` and `artifactType: workflow_output`.
- Verification: `npm run typecheck` passes; `npm run lint` passes with the existing 14 warnings; `npm run build` passes with the existing Node `module.register()` deprecation warning.
- Remaining risks: older run records without step `messageId` show output unavailable; playbooks remain foreground/user-triggered and are not durable background automation.

### 2026-05-22

Shared memory files were created to give Codex, Claude Code, and future agents a consistent understanding of the repo. Future agents should begin by reading `AGENTS.md`, `AI_PROJECT.md`, `AI_TASK_LOG.md`, `AI_DECISIONS.md`, and `AI_CHECKLIST.md`.

## Future Feature Ideas

- Prism Studio polish for richer image metadata such as dimensions/title extraction.
- Workflow templates, sharing, duplication, and richer run history.
- Automated test suite for auth, billing, routing, recommendations, and chat streaming.
- Safer incremental conversation persistence.
- Auth and storage strategy decision after the database migration plan is clear.

## Open Questions

- Should local storage remain the default development adapter, or should all deployed environments require R2/S3?
- Should admin role management become database-only with no hardcoded fallback?
