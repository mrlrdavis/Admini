# Requirements Document

## Introduction

This feature adds Progressive Web App (PWA) capabilities to the AdminI monorepo. Both the desktop app (`@admini/desktop`, served at `/desktop/`) and mobile app (`@admini/mobile`, served at `/mobile/`) will gain installability, offline support, push notifications, and an app-like standalone experience. The implementation leverages `vite-plugin-pwa` with Workbox for service worker generation and caching strategies, and integrates with the existing Netlify deployment pipeline.

## Glossary

- **Desktop_App**: The `@admini/desktop` Vite + React application served at the `/desktop/` base path on port 5173
- **Mobile_App**: The `@admini/mobile` Vite + React application served at the `/mobile/` base path on port 5174
- **Service_Worker**: A script that runs in the background, enabling offline caching, push notifications, and background sync
- **Web_App_Manifest**: A JSON file that provides metadata (name, icons, display mode, scope) enabling browser install prompts
- **Install_Prompt**: The browser-native UI or custom in-app UI that allows users to add the application to their home screen or desktop
- **Push_Notification_Service**: The server-side and client-side infrastructure for sending and receiving push notifications via the Web Push API
- **Cache_Strategy**: A Workbox caching policy (e.g., CacheFirst, NetworkFirst, StaleWhileRevalidate) applied to specific resource types
- **Precache**: Static assets bundled at build time and cached immediately upon service worker installation
- **Runtime_Cache**: Resources cached on-demand during runtime based on URL pattern matching
- **Offline_Fallback_Page**: A pre-cached HTML page displayed when the user is offline and navigates to an uncached route
- **PWA_Package**: A shared workspace package (`@admini/pwa`) containing common PWA utilities, hooks, and notification logic

## Requirements

### Requirement 1: Web App Manifest Generation

**User Story:** As a user, I want each AdminI application to have a valid web app manifest, so that my browser can offer to install it on my home screen or desktop.

#### Acceptance Criteria

1. WHEN the Desktop_App is built, THE Build_System SHALL generate a `manifest.webmanifest` file with `name` set to "AdminI Desktop", `short_name` set to "AdminI", `start_url` set to `/desktop/`, `scope` set to `/desktop/`, and `display` set to `standalone`
2. WHEN the Mobile_App is built, THE Build_System SHALL generate a `manifest.webmanifest` file with `name` set to "AdminI Mobile", `short_name` set to "AdminI", `start_url` set to `/mobile/`, `scope` set to `/mobile/`, and `display` set to `standalone`
3. THE Web_App_Manifest SHALL include icons at sizes 192x192 and 512x512 in PNG format with `purpose` set to `any maskable`
4. THE Web_App_Manifest SHALL include a `theme_color` and `background_color` property matching the application's brand palette
5. WHEN the application HTML is served, THE Build_System SHALL inject a `<link rel="manifest">` tag referencing the generated manifest file

### Requirement 2: Service Worker Registration and Lifecycle

**User Story:** As a user, I want a service worker to be automatically registered when I visit AdminI, so that offline and caching features are enabled without manual intervention.

#### Acceptance Criteria

1. WHEN the Desktop_App loads in a browser that supports service workers, THE Desktop_App SHALL register a service worker scoped to `/desktop/`
2. WHEN the Mobile_App loads in a browser that supports service workers, THE Mobile_App SHALL register a service worker scoped to `/mobile/`
3. WHEN a new service worker version is available, THE Service_Worker SHALL notify the user that an update is available
4. WHEN the user accepts the update prompt, THE Service_Worker SHALL activate the new version and reload the page
5. IF service worker registration fails, THEN THE Application SHALL log the error and continue operating without offline capabilities

### Requirement 3: Offline Caching Strategy

**User Story:** As a user, I want the application to work offline after my first visit, so that I can access previously loaded content without an internet connection.

#### Acceptance Criteria

1. WHEN the Service_Worker is installed, THE Service_Worker SHALL precache all static assets produced by the Vite build (JavaScript bundles, CSS files, and the offline fallback page)
2. WHILE the user is online, THE Service_Worker SHALL apply a NetworkFirst cache strategy to API requests, falling back to cached responses when the network is unavailable
3. WHILE the user is online, THE Service_Worker SHALL apply a CacheFirst cache strategy to static assets (fonts, images) with a maximum cache age of 30 days
4. WHEN the user navigates to an uncached route while offline, THE Service_Worker SHALL serve the Offline_Fallback_Page
5. WHEN the application detects a transition from offline to online, THE Application SHALL re-fetch stale data and update the UI

### Requirement 4: Home Screen Installation

**User Story:** As a user, I want to install AdminI to my device's home screen, so that I can launch it like a native application.

#### Acceptance Criteria

1. WHEN the browser's installability criteria are met (valid manifest, registered service worker, served over HTTPS), THE Application SHALL capture the `beforeinstallprompt` event
2. WHEN the user clicks the in-app install button, THE Application SHALL trigger the captured install prompt
3. WHEN the user completes installation, THE Application SHALL hide the in-app install button
4. WHILE the application is running in standalone display mode, THE Application SHALL hide the in-app install button
5. THE Install_Button SHALL be accessible with an ARIA label of "Install application"

### Requirement 5: Push Notifications

**User Story:** As a user, I want to receive push notifications from AdminI, so that I am informed of important updates even when the app is not in the foreground.

#### Acceptance Criteria

1. WHEN the user opts in to notifications, THE Application SHALL request notification permission from the browser
2. WHEN notification permission is granted, THE Application SHALL subscribe to the Push_Notification_Service and store the subscription endpoint
3. WHEN a push event is received by the Service_Worker, THE Service_Worker SHALL display a notification with a title, body, and icon
4. WHEN the user clicks a displayed notification, THE Service_Worker SHALL focus the existing application window or open a new one at the notification's target URL
5. IF the user denies notification permission, THEN THE Application SHALL respect the denial and not request permission again during the same session
6. IF the push subscription expires or becomes invalid, THEN THE Application SHALL re-subscribe on the next user visit

### Requirement 6: Full-Screen Standalone Experience

**User Story:** As a user, I want AdminI to launch in full-screen standalone mode when installed, so that it feels like a native application without browser chrome.

#### Acceptance Criteria

1. WHEN the application is launched from the home screen, THE Application SHALL render in standalone display mode without browser address bar or navigation controls
2. THE Web_App_Manifest SHALL set `display` to `standalone` for both Desktop_App and Mobile_App
3. WHILE running in standalone mode, THE Mobile_App SHALL account for device safe areas using `viewport-fit=cover` and CSS `env(safe-area-inset-*)` values
4. WHILE running in standalone mode, THE Application SHALL provide in-app navigation controls (back, forward, refresh) since browser controls are hidden

### Requirement 7: App-Like Navigation

**User Story:** As a user, I want smooth, app-like navigation within AdminI when installed as a PWA, so that page transitions feel instant and native.

#### Acceptance Criteria

1. THE Application SHALL use client-side routing for all internal navigation to avoid full page reloads
2. WHILE running in standalone mode, THE Application SHALL handle navigation gestures (swipe back on mobile) without breaking the routing state
3. WHEN an internal link is activated, THE Application SHALL update the URL and render the target view without a white flash or loading spinner for cached content
4. IF the user navigates to an external URL while in standalone mode, THEN THE Application SHALL open the link in the system browser rather than within the standalone window

### Requirement 8: Shared PWA Package

**User Story:** As a developer, I want PWA utilities consolidated in a shared package, so that both the desktop and mobile apps reuse the same logic for service worker management, install prompts, and notification handling.

#### Acceptance Criteria

1. THE PWA_Package SHALL export a `useInstallPrompt` React hook that manages the `beforeinstallprompt` event lifecycle
2. THE PWA_Package SHALL export a `useServiceWorker` React hook that handles registration, update detection, and update activation
3. THE PWA_Package SHALL export a `usePushNotifications` React hook that handles permission requests, subscription management, and push event handling
4. THE PWA_Package SHALL export an `OfflineFallback` React component for rendering the offline page
5. THE PWA_Package SHALL be importable as `@admini/pwa` from both Desktop_App and Mobile_App via workspace resolution

### Requirement 9: Build and Deployment Integration

**User Story:** As a developer, I want PWA assets to be generated during the existing build pipeline and deployed correctly on Netlify, so that no manual steps are required.

#### Acceptance Criteria

1. WHEN `npm run build:apps` is executed, THE Build_System SHALL generate service worker files and manifests for both Desktop_App and Mobile_App
2. THE Build_System SHALL output service worker files into the correct dist directories (`dist/netlify/desktop/` and `dist/netlify/mobile/`)
3. WHEN deployed to Netlify, THE Netlify_Configuration SHALL serve service worker files with a `Cache-Control: no-cache` header to ensure timely updates
4. WHEN deployed to Netlify, THE Netlify_Configuration SHALL serve manifest files with appropriate MIME type `application/manifest+json`
5. THE Build_System SHALL use `vite-plugin-pwa` configured in each app's `vite.config.ts` to generate all PWA assets
