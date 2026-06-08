# Implementation Plan: Unified Responsive PWA

## Overview

This plan implements the unified responsive PWA by creating a new `apps/web/` application that consolidates both `@admini/desktop` and `@admini/mobile` into a single Vite+React app served at `/`. Tasks are ordered to establish infrastructure first, then core components, then deployment configuration, and finally legacy migration support.

## Tasks

- [x] 1. Set up project structure and Vite configuration
  - [x] 1.1 Create the `apps/web/` directory with `package.json`, `tsconfig.json`, and `index.html`
    - Create `apps/web/package.json` with name `@admini/web`, dependencies on React, Vite, VitePWA, Sentry, and workspace package references
    - Create `apps/web/tsconfig.json` extending the base tsconfig with appropriate include/exclude paths
    - Create `apps/web/index.html` with root div mount point, viewport meta, and script entry referencing `src/main.tsx`
    - _Requirements: 1.1, 1.3, 1.4, 11.1_

  - [x] 1.2 Create `apps/web/vite.config.ts` with VitePWA plugin and path aliases
    - Configure `base: '/'` and `envDir` pointing to workspace root
    - Add `@vitejs/plugin-react` and `vite-plugin-pwa` with `generateSW` strategy, `registerType: 'prompt'`, workbox `globPatterns`, `navigateFallback: '/offline.html'`, and `navigateFallbackDenylist: [/^\/api\//]`
    - Add PWA manifest inline: name 'AdminI', display 'standalone', start_url '/', scope '/', icons 192 and 512 with 'any maskable'
    - Add resolve aliases for all shared packages: `@admini/ui`, `@admini/shared`, `@admini/privacy`, `@admini/api-client`, `@admini/workspace`, `@admini/pwa`, `@admini/integrations`, and `@admini/ui/styles.css`
    - _Requirements: 1.3, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 8.1, 8.2, 8.3, 8.4, 11.2, 11.3_

  - [x] 1.3 Update root `package.json` with `dev` and `build:app` scripts
    - Add `"dev": "npm run dev -w @admini/web"` script
    - Add `"build:app": "npm run build -w @admini/web"` script
    - Keep existing scripts intact for backward compatibility during transition
    - _Requirements: 4.1, 4.5, 11.1, 11.2_

- [x] 2. Implement core application components
  - [x] 2.1 Create `apps/web/src/supabase.ts` - Supabase client singleton
    - Initialize a single `createClient` instance using `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` env vars
    - Export the client instance for use across the app
    - _Requirements: 5.1, 5.3_

  - [x] 2.2 Create `apps/web/src/main.tsx` - Application entry point
    - Initialize Sentry with DSN, environment, release tag, and `beforeSend` hook using `scrubSentryText` from `@admini/privacy`
    - Wrap the render tree in `PWAProvider` from `@admini/pwa`
    - Render `<App />` and `<ReloadPrompt />` inside the provider
    - _Requirements: 6.6, 6.7, 1.2_

  - [x] 2.3 Create `apps/web/src/components/NavigationRenderer.tsx`
    - Accept `NavigationAdapterProps` from `@admini/workspace` plus `layoutMode` from `@admini/ui`
    - Render `DesktopSidebar` when `layoutMode === 'desktop'`
    - Render `TabBar` from `@admini/ui` when `layoutMode === 'mobile'`
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

  - [x] 2.4 Create `apps/web/src/components/DesktopSidebar.tsx`
    - Implement the desktop sidebar navigation component accepting `NavigationAdapterProps`
    - Render navigation tabs vertically (Dashboard, Capture, Tasks, Pulse, Admin, Settings)
    - Match the existing desktop app sidebar UI and behavior
    - _Requirements: 2.1, 2.5, 6.2_

  - [x] 2.5 Create `apps/web/src/AuthScreen.tsx` - Responsive auth screens
    - Implement home, sign-in, and sign-up views in a single module
    - Use CSS media queries: `min-width: 769px` for split-panel grid layout with `AuthStoryPanel`; `max-width: 768px` for stacked column layout hiding the story panel
    - Include Google OAuth button, email/password forms, and sign-up flow
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 2.6 Create `apps/web/src/UnifiedWorkspace.tsx`
    - Wrap `WorkspaceShell` from `@admini/workspace` inside `SupabaseClientProvider`
    - Pass `renderNavigation` prop that delegates to `NavigationRenderer` with `layoutMode` from `LayoutShell`
    - Include `InstallButton` from `@admini/pwa`
    - _Requirements: 2.3, 2.4, 6.2, 6.3, 6.4, 8.1, 8.2, 8.3_

  - [x] 2.7 Create `apps/web/src/App.tsx` - Session and routing orchestration
    - Implement session initialization: `getCurrentUser`, auth state listener (`onAuthStateChange`), visibility change re-validation
    - Handle invitation tokens: parse from URL search params, persist in sessionStorage, call `acceptInvitation` on auth
    - Orchestrate onboarding wizard (display name, school, role, focus, systems)
    - Load user profile and detect role from organization_memberships
    - Render `AuthScreen` when unauthenticated, onboarding wizard when incomplete, `UnifiedWorkspace` when ready
    - Configure OAuth redirect URL to root origin
    - _Requirements: 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 6.5, 10.5_

  - [x] 2.8 Create `apps/web/src/ReloadPrompt.tsx` - SW update prompt
    - Use `useRegisterSW` from `virtual:pwa-register/react`
    - Show a banner when `needRefresh` is true with Reload and Dismiss buttons
    - Call `updateServiceWorker()` on Reload
    - _Requirements: 6.6, 3.2_

- [x] 3. Checkpoint - Core application builds
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Create static assets and offline support
  - [x] 4.1 Create `apps/web/public/offline.html` - Offline fallback page
    - Static HTML with `lang="en"` attribute, viewport meta
    - Include `<main role="main" aria-label="Offline notice">` with heading, description, and retry button
    - Retry button with `aria-label="Retry loading the page"` and `onclick="window.location.reload()"`
    - _Requirements: 9.1, 9.2, 9.4, 9.5_

  - [x] 4.2 Create `apps/web/public/icons/` directory with PWA icon placeholders
    - Add `icon-192x192.png` and `icon-512x512.png` (copy from existing desktop or mobile app icons)
    - _Requirements: 3.6_

- [x] 5. Configure Netlify deployment and legacy redirects
  - [x] 5.1 Update `netlify.toml` with unified app build configuration
    - Set `[build] command = "npm run build:app"` and `publish = "dist/netlify"`
    - Add 301 redirects: `/desktop` to `/`, `/desktop/*` to `/:splat`, `/mobile` to `/`, `/mobile/*` to `/:splat`
    - Add SPA fallback: `/*` to `/index.html` with status 200 (must be last)
    - Add security headers: `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`
    - Add `Cache-Control: no-cache` for `/sw.js`
    - Add `Content-Type: application/manifest+json` for `/manifest.webmanifest`
    - _Requirements: 4.2, 4.3, 4.4, 7.1, 7.2_

  - [x] 5.2 Create `apps/web/public/desktop/index.html` - Legacy desktop SW cleanup
    - Static HTML that unregisters service workers scoped to `/desktop/`
    - Redirect to `/` via `window.location.replace('/')`
    - Include `<noscript>` fallback with meta refresh redirect
    - _Requirements: 7.3, 7.4_

  - [x] 5.3 Create `apps/web/public/mobile/index.html` - Legacy mobile SW cleanup
    - Static HTML that unregisters service workers scoped to `/mobile/`
    - Redirect to `/` via `window.location.replace('/')`
    - Include `<noscript>` fallback with meta refresh redirect
    - _Requirements: 7.3, 7.4_

- [x] 6. Checkpoint - Full build and deployment verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Write tests
  - [x]* 7.1 Write unit tests for `NavigationRenderer`
    - Test renders `DesktopSidebar` when `layoutMode` is `'desktop'`
    - Test renders `TabBar` when `layoutMode` is `'mobile'`
    - Test that tab change callbacks propagate correctly
    - **Validates: Requirements 2.1, 2.2, 2.3**

  - [x]* 7.2 Write unit tests for `AuthScreen` responsive layout
    - Test split-panel layout class present at desktop viewport (800px)
    - Test stacked layout class present at mobile viewport (375px)
    - Test layout transitions on resize without unmounting
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4**

  - [x]* 7.3 Write unit tests for legacy SW cleanup scripts
    - Mock `navigator.serviceWorker.getRegistrations()`
    - Verify `unregister()` is called for registrations scoped to `/desktop/` or `/mobile/`
    - Verify redirect to `/` is triggered
    - **Validates: Requirements 7.4**

  - [x]* 7.4 Write integration test for build output validation
    - Run `npm run build:app` and verify `dist/netlify/` contains `index.html`, `sw.js`, and `manifest.webmanifest`
    - Verify no second output directory is produced
    - Verify manifest fields match expected values (start_url, scope, icons)
    - **Validates: Requirements 4.1, 3.1, 3.6**

- [x] 8. Final checkpoint - All tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- The design explicitly states no shared packages are modified - all imports consume existing packages as-is
- TypeScript is the implementation language (matching existing codebase)
- Unit tests use Vitest + @testing-library/react (already in use in the monorepo)
- Property-based testing is not applicable per the design assessment (no pure functions with rich input spaces)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5"] },
    { "id": 3, "tasks": ["2.6", "2.7", "2.8"] },
    { "id": 4, "tasks": ["4.1", "4.2", "5.1"] },
    { "id": 5, "tasks": ["5.2", "5.3"] },
    { "id": 6, "tasks": ["7.1", "7.2", "7.3", "7.4"] }
  ]
}
```
