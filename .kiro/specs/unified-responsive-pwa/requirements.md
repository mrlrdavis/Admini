# Requirements Document

## Introduction

This feature merges the two separate AdminI applications (`@admini/desktop` and `@admini/mobile`) into a single unified responsive Progressive Web App served at the root path `/`. The unified app adapts its layout between desktop (sidebar navigation) and mobile (bottom tab bar) based on viewport size using CSS media queries and the existing `LayoutShell` component. The result is one build target, one PWA manifest, one service worker, one OAuth redirect URL, and a simplified deployment pipeline - while preserving all existing functionality from both apps.

## Glossary

- **Unified_App**: The single Vite+React application that replaces both `@admini/desktop` and `@admini/mobile`, served at the root path `/`
- **LayoutShell**: The existing responsive layout component from `@admini/ui` that switches between sidebar (desktop) and bottom bar (mobile) layouts based on viewport width
- **Breakpoint**: The viewport width threshold (768px) at which the Unified_App transitions between desktop layout and mobile layout
- **Desktop_Layout**: The layout mode featuring a persistent sidebar navigation, used when viewport width exceeds the Breakpoint
- **Mobile_Layout**: The layout mode featuring a bottom tab bar navigation, used when viewport width is at or below the Breakpoint
- **PWA_Manifest**: The single `manifest.webmanifest` file describing the installable web application metadata (name, icons, start URL, scope)
- **Service_Worker**: The single Workbox-generated service worker that handles precaching and offline fallback for the Unified_App
- **Legacy_App**: Either of the previously separate applications (`@admini/desktop` at `/desktop/` or `@admini/mobile` at `/mobile/`)
- **OAuth_Redirect**: The single callback URL registered with Supabase/Google for authentication flows
- **WorkspaceShell**: The existing shared component from `@admini/workspace` that provides the authenticated workspace experience including tab-based navigation

## Requirements

### Requirement 1: Single Application Entry Point

**User Story:** As a user, I want to access AdminI from a single URL at the root path, so that I do not need separate bookmarks or URLs for desktop and mobile experiences.

#### Acceptance Criteria

1. THE Unified_App SHALL be served at the root path `/`
2. WHEN a user navigates to `/`, THE Unified_App SHALL render the responsive application
3. THE Unified_App SHALL use a single Vite configuration with `base: '/'`
4. THE Unified_App SHALL reside in a single workspace directory (`apps/web/` or equivalent) replacing the separate `apps/desktop/` and `apps/mobile/` directories

### Requirement 2: Responsive Layout Adaptation

**User Story:** As a user, I want the app to automatically adapt its navigation and layout based on my screen size, so that I get the best experience whether I am on a desktop or mobile device.

#### Acceptance Criteria

1. WHEN the viewport width exceeds 768px, THE Unified_App SHALL render the Desktop_Layout with sidebar navigation
2. WHEN the viewport width is at or below 768px, THE Unified_App SHALL render the Mobile_Layout with a bottom tab bar
3. THE Unified_App SHALL use the existing LayoutShell component from `@admini/ui` to manage layout transitions
4. WHEN the viewport is resized across the Breakpoint, THE Unified_App SHALL transition between Desktop_Layout and Mobile_Layout without a page reload
5. THE Unified_App SHALL preserve all navigation tabs and views available in both Legacy_Apps (Dashboard, Capture, Tasks, Pulse, Admin, More/Settings)

### Requirement 3: Unified PWA Configuration

**User Story:** As a user, I want a single install experience for AdminI regardless of my device, so that I have one app icon and one consistent experience.

#### Acceptance Criteria

1. THE Unified_App SHALL produce a single PWA_Manifest with `start_url: '/'` and `scope: '/'`
2. THE Unified_App SHALL generate a single Service_Worker using VitePWA `generateSW` strategy
3. THE Service_Worker SHALL precache all static assets using Workbox `globPatterns`
4. THE Service_Worker SHALL use `/offline.html` as the `navigateFallback` for navigation requests
5. THE Unified_App SHALL reuse the existing `@admini/pwa` package (PWAProvider, useInstallPrompt, InstallButton, OfflineFallback) without modification to the package source
6. THE PWA_Manifest SHALL include icons in 192x192 and 512x512 sizes with `purpose: 'any maskable'`

### Requirement 4: Simplified Build and Deploy Pipeline

**User Story:** As a developer, I want a single build target and deployment configuration, so that the CI/CD pipeline is simpler and faster.

#### Acceptance Criteria

1. THE build system SHALL produce a single output directory for the Unified_App
2. THE Netlify configuration SHALL serve the Unified_App at `/` with a SPA fallback redirect
3. THE Netlify configuration SHALL include `Cache-Control: no-cache` headers for `/sw.js`
4. THE Netlify configuration SHALL include `Content-Type: application/manifest+json` headers for `/manifest.webmanifest`
5. THE root `package.json` SHALL provide a single `build:app` script replacing the previous `build:apps` script that built two separate applications

### Requirement 5: Single OAuth Redirect URL

**User Story:** As a user, I want authentication to work seamlessly from one URL, so that Google OAuth redirects return me to the correct location.

#### Acceptance Criteria

1. THE Unified_App SHALL configure Supabase OAuth redirect to the root origin (e.g., `https://pdadmini.netlify.app/`)
2. WHEN Google OAuth completes, THE Unified_App SHALL handle the auth callback at the root path
3. THE Unified_App SHALL maintain a single Supabase client instance shared across all views

### Requirement 6: Feature Parity with Legacy Apps

**User Story:** As a user, I want all existing features from both the desktop and mobile apps available in the unified app, so that no functionality is lost.

#### Acceptance Criteria

1. THE Unified_App SHALL include the full onboarding wizard flow (display name, school name, role selection, focus area, systems)
2. THE Unified_App SHALL include workspace navigation tabs: Dashboard, Capture, Tasks, Pulse, Admin, and More/Settings
3. THE Unified_App SHALL include profile settings, notification settings, app preferences, and connected integrations
4. THE Unified_App SHALL include the integration catalog browser
5. THE Unified_App SHALL support invitation token acceptance from URL parameters
6. THE Unified_App SHALL include the ReloadPrompt component for service worker update handling
7. THE Unified_App SHALL include Sentry error reporting with privacy scrubbing via `@admini/privacy`

### Requirement 7: Legacy Path Deprecation and Redirects

**User Story:** As a user who previously bookmarked or installed the desktop or mobile app, I want to be redirected to the new unified app, so that my existing links continue to work.

#### Acceptance Criteria

1. WHEN a user navigates to `/desktop/` or any `/desktop/*` path, THE Netlify configuration SHALL redirect to the equivalent root path with a 301 status
2. WHEN a user navigates to `/mobile/` or any `/mobile/*` path, THE Netlify configuration SHALL redirect to the equivalent root path with a 301 status
3. THE Unified_App SHALL include a meta tag or notice mechanism informing users with previously installed Legacy_Apps to reinstall the unified PWA; IF the notice mechanism fails to load, THEN THE Unified_App SHALL continue to function normally without blocking
4. IF a user has an existing Legacy_App service worker registered at `/desktop/` or `/mobile/` scope, THEN THE legacy service worker SHALL be unregistered by a cleanup script served at those paths

### Requirement 8: Shared Package Preservation

**User Story:** As a developer, I want existing shared packages to remain unchanged, so that the migration does not introduce regressions in stable code.

#### Acceptance Criteria

1. THE Unified_App SHALL import from `@admini/pwa` without requiring source changes to the `packages/pwa/` directory
2. THE Unified_App SHALL import from `@admini/workspace` without requiring source changes to the `packages/workspace/` directory
3. THE Unified_App SHALL import from `@admini/ui` (including LayoutShell and TabBar) without requiring source changes to the `packages/ui/` directory
4. THE Unified_App SHALL import from `@admini/shared`, `@admini/api-client`, `@admini/privacy`, and `@admini/integrations` without requiring source changes to those packages

### Requirement 9: Offline Experience

**User Story:** As a user, I want the app to show a friendly offline page when I lose connectivity, so that I understand what happened and can retry.

#### Acceptance Criteria

1. THE Unified_App SHALL include a static `offline.html` fallback page in the `public/` directory
2. WHEN the user navigates to a page while offline and the page is not cached, THE Service_Worker SHALL serve the `offline.html` fallback
3. IF the Service_Worker fails to load or crashes, THEN THE Unified_App SHALL detect offline status via the Navigator.onLine API and display an inline offline indicator to the user
4. THE `offline.html` page SHALL include a retry button that reloads the page
5. THE `offline.html` page SHALL be accessible (lang attribute, button labeling, ARIA attributes)

### Requirement 10: Responsive Auth Screens

**User Story:** As a user, I want the sign-in and sign-up screens to look appropriate on both desktop and mobile, so that the authentication experience is polished on any device.

#### Acceptance Criteria

1. THE Unified_App SHALL render authentication screens (home, sign-in, sign-up) that adapt to both desktop and mobile viewports
2. WHEN on a desktop viewport, THE auth screens SHALL use a split-panel layout with a story panel alongside the form; THE split-panel layout SHALL be enforced on desktop viewports and SHALL NOT fall back to the mobile stacked layout
3. WHEN on a mobile viewport, THE auth screens SHALL use a stacked layout optimized for touch interaction
4. WHEN the viewport is resized across the Breakpoint while on an auth screen, THE auth screen layout SHALL immediately switch to the appropriate layout (split-panel or stacked) without a page reload
5. THE Unified_App SHALL unify the auth logic from both Legacy_Apps into a single implementation

### Requirement 11: Development Experience

**User Story:** As a developer, I want a single dev server command to work on the unified app, so that local development is straightforward.

#### Acceptance Criteria

1. THE root `package.json` SHALL provide a `dev` script that starts the Unified_App development server
2. THE Vite development server SHALL serve the Unified_App at `localhost` on the root path `/`
3. THE Vite configuration SHALL include path aliases for all shared packages (`@admini/ui`, `@admini/shared`, `@admini/workspace`, `@admini/pwa`, `@admini/api-client`, `@admini/privacy`, `@admini/integrations`)
