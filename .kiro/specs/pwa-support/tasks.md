# Implementation Plan: PWA Support

## Overview

Add minimal Progressive Web App capabilities to the AdminI monorepo using `vite-plugin-pwa` in `generateSW` mode. Create a UI-only shared package `@admini/pwa` with an install prompt hook, PWA context provider, and offline fallback component. Configure both apps for installability and offline support.

## Tasks

- [x] 1. Create `@admini/pwa` package scaffolding
  - [x] 1.1 Initialize package structure
    - Create `packages/pwa/package.json` with name `@admini/pwa`, entry point `src/index.ts`, peer deps on `react` and `react-dom`
    - Create `packages/pwa/tsconfig.json` extending workspace base config
    - Create `packages/pwa/src/index.ts` barrel export
    - Create `packages/pwa/src/types.ts` with `InstallPromptState` and `PWAContextValue` type definitions
    - _Requirements: 8.5_

  - [x] 1.2 Install dependencies
    - Add `vite-plugin-pwa` as a dev dependency to `@admini/desktop` and `@admini/mobile`
    - Add `@admini/pwa` as a workspace dependency to both apps
    - _Requirements: 9.5_

- [x] 2. Implement `@admini/pwa` exports
  - [x] 2.1 Implement `PWAProvider` context
    - Create `packages/pwa/src/context/PWAProvider.tsx`
    - Track `isOnline` via `navigator.onLine` + `online`/`offline` event listeners
    - Detect `isStandalone` via `window.matchMedia('(display-mode: standalone)')`
    - Export `PWAProvider` component and `usePWAContext` hook
    - NO service worker logic, NO update tracking, NO API calls
    - _Requirements: 3.5, 6.1_

  - [x] 2.2 Implement `useInstallPrompt` hook
    - Create `packages/pwa/src/hooks/useInstallPrompt.ts`
    - Listen for `beforeinstallprompt` event, store deferred prompt
    - Expose `isInstallable`, `isStandalone`, `promptInstall()`
    - Return `isInstallable: false` when standalone or after prompt used
    - Clean up listeners on unmount
    - NO service worker interaction, NO update logic
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 2.3 Implement `OfflineFallback` component
    - Create `packages/pwa/src/components/OfflineFallback.tsx`
    - Render minimal offline screen with `appName` prop
    - Include retry button: `window.location.reload()`
    - Basic ARIA attributes for accessibility
    - NO network event listeners, NO SW interaction
    - _Requirements: 3.4, 8.4_

  - [x] 2.4 Export all from barrel
    - Update `packages/pwa/src/index.ts` to export `useInstallPrompt`, `PWAProvider`, `usePWAContext`, `OfflineFallback`
    - _Requirements: 8.1, 8.5_

- [x] 3. Configure VitePWA in both apps
  - [x] 3.1 Add VitePWA to desktop app
    - Add to `apps/desktop/vite.config.ts`: `VitePWA({ strategies: 'generateSW', registerType: 'prompt', workbox: { globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'], navigateFallback: '/desktop/offline.html', navigateFallbackDenylist: [/^\/desktop\/api\//] }, manifest: { name: 'AdminI Desktop', short_name: 'AdminI', display: 'standalone', start_url: '/desktop/', scope: '/desktop/', theme_color: '#1a1a2e', background_color: '#f7f8fa', icons: [...] } })`
    - NO additional Workbox config beyond above
    - NO `injectManifest`, NO `importScripts`, NO runtime caching overrides
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 2.1, 3.1, 9.5_

  - [x] 3.2 Add VitePWA to mobile app
    - Same config as desktop but with `/mobile/` base paths and name "AdminI Mobile"
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 2.2, 3.1, 9.5_

  - [x] 3.3 Add PWA icon placeholders
    - Create `apps/desktop/public/icons/icon-192x192.png` (placeholder)
    - Create `apps/desktop/public/icons/icon-512x512.png` (placeholder)
    - Create `apps/mobile/public/icons/icon-192x192.png` (placeholder)
    - Create `apps/mobile/public/icons/icon-512x512.png` (placeholder)
    - _Requirements: 1.3_

  - [x] 3.4 Create static offline fallback pages
    - Create `apps/desktop/public/offline.html` - static HTML, retry button, no JS framework
    - Create `apps/mobile/public/offline.html` - static HTML, retry button, no JS framework
    - offline.html must be placed in /public so it is copied to build output unchanged
    - must be accessible at runtime via:
      /desktop/offline.html
      /mobile/offline.html
    - _Requirements: 3.4_

- [x] 4. Integrate into app code
  - [x] 4.1 Wire PWAProvider into app roots
    - Wrap desktop app root with `PWAProvider`
    - Wrap mobile app root with `PWAProvider`
    - _Requirements: 3.5, 6.1_

  - [x] 4.2 Add install button UI (STRICT)
    - Use `useInstallPrompt` only
    - Render install button ONLY when ALL conditions are true:
      - `isInstallable === true`
      - `beforeinstallprompt` event has been received (implied by isInstallable)
    - After `promptInstall()` is called: immediately hide button for remainder of session
    - NEVER derive installability from `isStandalone` directly in UI logic — `useInstallPrompt` handles that internally
    - Button must have `aria-label="Install application"`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 4.3 Add update-available reload button
    - Use vite-plugin-pwa's built-in `useRegisterSW` from `virtual:pwa-register/react`
      - This is the ONLY allowed PWA runtime API
      - Do NOT use navigator.serviceWorker directly
      - Do NOT listen to serviceWorker events manually
    - Show "Update available" banner when `needRefresh` is true
    - Button calls `updateServiceWorker(true)` (plugin default behavior)
    - NO custom skipWaiting, NO postMessage, NO state machines
    - _Requirements: 2.3, 2.4_

- [x] 5. Update Netlify configuration
  - [x] 5.1 Add headers to `netlify.toml`
    - `Cache-Control: no-cache` for `/desktop/sw.js` and `/mobile/sw.js`
    - `Content-Type: application/manifest+json` for manifest files
    - _Requirements: 9.3, 9.4_

- [x] 6. Build verification
  - [x] 6.1 Verify build output
    - Run `npm run build:apps`
    - Confirm `dist/netlify/desktop/sw.js` exists
    - Confirm `dist/netlify/desktop/manifest.webmanifest` exists
    - Confirm `dist/netlify/desktop/offline.html` exists
    - Confirm `dist/netlify/mobile/sw.js` exists
    - Confirm `dist/netlify/mobile/manifest.webmanifest` exists
    - Confirm `dist/netlify/mobile/offline.html` exists
    - _Requirements: 9.1, 9.2_

- [x] 7. Write minimal tests
  - [x] 7.1 Unit test `useInstallPrompt`
    - Test: event capture sets `isInstallable` to true
    - Test: `promptInstall()` triggers deferred prompt
    - Test: standalone detection returns `isStandalone: true`
    - Test: cleanup removes event listeners
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 7.2 Unit test `PWAProvider`
    - Test: `isOnline` tracks `online`/`offline` events
    - Test: `isStandalone` detects display mode
    - _Requirements: 3.5, 6.1_

  - [x] 7.3 Render test `OfflineFallback`
    - Test: renders app name
    - Test: retry button triggers `window.location.reload()`
    - _Requirements: 3.4, 8.4_

## Notes

- This is Phase 1 (MVP) only - NO push notifications, NO custom SW, NO backend work
- All service worker logic is handled by Workbox's `generateSW` - do not write any SW code
- Update handling uses ONLY vite-plugin-pwa's built-in `useRegisterSW` hook - no custom orchestration
- Icon placeholders should be replaced with branded assets before production

### Install Prompt State Rule

- `beforeinstallprompt` event MUST be handled only inside `useInstallPrompt`
- The event MUST be stored as a single deferred reference
- `promptInstall()` MUST consume and clear the stored event
- After consumption: `isInstallable` MUST permanently become `false` for that session
- No other module may store or listen to `beforeinstallprompt`

### Browser API Boundary Rule

The following are the ONLY allowed browser APIs for Phase 1 PWA code:

- `window.matchMedia`
- `navigator.onLine`
- `window.addEventListener` (online/offline only)
- `window.location.reload`
- `beforeinstallprompt` event

Anything outside this list is disallowed for Phase 1 PWA code.

### Offline Responsibility Split

- `PWAProvider` = runtime online/offline state (in-app UI only)
- `offline.html` = network fallback page (browser-level fallback via Workbox)
- These MUST NOT overlap in behavior
- `OfflineFallback` React component is UI-only and does NOT replace `offline.html`

### Build Integrity Rule

- If any PWA asset is missing after build (`sw.js`, `manifest.webmanifest`, `offline.html`):
  - Build is considered FAILED
  - Any missing PWA file is a hard stop failure
  - No partial deployment is allowed
  - No fallback behavior is acceptable at runtime
  - Fix must be in Vite config or file placement, not code logic

### Hard Constraint

- Under no circumstances may any of the following be created in Phase 1:
  - `service-worker.ts`
  - Custom Workbox configuration files
  - `injectManifest` usage
  - Any file in `src/sw/` or similar directories
- Only `VitePWA({ strategies: 'generateSW' })` is allowed to produce service worker output

### VitePWA Determinism Rule

- Config must be identical across environments
- No conditional logic (`if (env)`, `mode` checks, etc.)
- No spread operators merging configs
- No shared config imports
- Each app's VitePWA config is a self-contained literal object
## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1", "2.2", "2.3"] },
    { "id": 3, "tasks": ["2.4", "3.3", "3.4"] },
    { "id": 4, "tasks": ["3.1", "3.2"] },
    { "id": 5, "tasks": ["4.1", "4.2", "4.3", "5.1"] },
    { "id": 6, "tasks": ["6.1"] },
    { "id": 7, "tasks": ["7.1", "7.2", "7.3"] }
  ]
}
```
