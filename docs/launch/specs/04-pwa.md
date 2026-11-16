# Spec 04: Installable Web App (PWA)

Lane C. Days 5 to 6. Small.

## Goal

People can install Zenquanta from the browser. On phones and computers it opens in its own window with its own icon. This is chat only. Coding on local folders needs `zq` now and the desktop app in v1.1.

## Build

- `app/manifest.ts` (Next.js metadata route):
  - `name: 'Zenquanta AI'`, `short_name: 'Zenquanta'`
  - `start_url: '/'`, `scope: '/'`, `display: 'standalone'`
  - `background_color` and `theme_color` from the dark app canvas in `app/globals.css`
  - icons at 192 and 512 px, plus a 512 px maskable icon, made from `public/icon.svg`
- `app/layout.tsx` metadata: `appleWebApp` (capable, title, black-translucent status bar) and `themeColor`. `public/apple-icon.png` already exists.
- Install button in the account menu:
  - Chrome, Edge and Android: listen for `beforeinstallprompt`, keep the event and show "Install app". Hide it after install or when `display-mode: standalone` matches.
  - iPhone and iPad Safari: show "Add to Home Screen" with the Share icon hint instead.
- Standalone polish: safe-area padding (`env(safe-area-inset-*)`) on the header and composer, and no pull-to-refresh bounce.

## Not now

- No service worker and no offline mode at launch. Caching risks stale app code right when we ship daily fixes.
- If Chrome's installability check in DevTools (Application, Manifest) asks for a service worker, add a minimal one that passes requests through and caches nothing.
- No push notifications.

## Checks

- Chrome DevTools Application panel shows the manifest is installable with no errors.
- Install on macOS Chrome, Windows Edge, Android Chrome and iPhone Safari. Sign in, chat and upload a file in the installed window.
- Signing out and back in works inside the installed window.

## Done when

Installs work on all four, and the button only shows where install is possible.
