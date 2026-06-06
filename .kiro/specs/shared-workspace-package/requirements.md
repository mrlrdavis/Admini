# Requirements Document

## Introduction

This feature extracts workspace components, services, and hooks from `apps/mobile/src/workspace/` and `apps/mobile/src/services/` into a shared monorepo package (`packages/workspace`). Both the mobile app (`apps/mobile`) and the desktop app (`apps/desktop`) will import from this package, enabling native workspace rendering on desktop and eliminating the current full-iframe prototype approach. The desktop app gains a platform-appropriate navigation shell (sidebar) while sharing the same tab content components and data services as mobile.

## Glossary

- **Workspace_Package**: The new `@admini/workspace` package located at `packages/workspace` that exports shared workspace components, services, hooks, and types.
- **WorkspaceShell**: The top-level container component that manages tab state, role-gated navigation, and the hybrid native/iframe rendering strategy.
- **Tab_Content_Component**: A React component rendering the content for a specific workspace tab (DashboardTab, AdminTab, CaptureTab, TasksTab, PulseTab).
- **Navigation_Adapter**: A platform-specific navigation component injected into WorkspaceShell — bottom TabBar on mobile, sidebar on desktop.
- **Service_Layer**: The set of data-fetching modules (dashboardService, organizationService, invitationService) that communicate with the Supabase backend.
- **Supabase_Client_Provider**: A mechanism for apps to inject their configured Supabase client instance into the Workspace_Package service layer, avoiding hard-coded client coupling.
- **IframeFallback**: A component that renders unconverted tabs inside a persistent iframe with a postMessage bridge.
- **Desktop_App**: The `@admini/desktop` application at `apps/desktop`.
- **Mobile_App**: The `@admini/mobile` application at `apps/mobile`.

## Requirements

### Requirement 1: Package Structure and Build Configuration

**User Story:** As a developer, I want a dedicated shared workspace package in the monorepo, so that both apps can import workspace functionality from a single source of truth.

#### Acceptance Criteria

1. THE Workspace_Package SHALL be located at `packages/workspace` with package name `@admini/workspace`.
2. THE Workspace_Package SHALL declare `react` and `@supabase/supabase-js` as peer dependencies.
3. THE Workspace_Package SHALL declare `@admini/ui` as a dependency for shared UI primitives.
4. THE Workspace_Package SHALL export all public modules via a TypeScript source entry point (`src/index.ts`).
5. THE Workspace_Package SHALL pass TypeScript type-checking with the monorepo's shared tsconfig base.
6. WHEN the monorepo `npm run typecheck` command is executed, THE Workspace_Package SHALL produce zero type errors.

### Requirement 2: Component Extraction and Re-Export

**User Story:** As a developer, I want all workspace tab components and the shell extracted into the shared package, so that both apps render the same native UI without code duplication.

#### Acceptance Criteria

1. THE Workspace_Package SHALL export WorkspaceShell, DashboardTab, AdminTab, CaptureTab, TasksTab, PulseTab, and IframeFallback components.
2. THE Workspace_Package SHALL export the `useOrgData` hook.
3. THE Workspace_Package SHALL export all workspace type definitions (WorkspaceTab, AdminiRole, OrgDetails, OrgDetailsForm, OrgMember, OrgInvitation, OrgFeatureFlag, ActivityEvent).
4. WHEN a Tab_Content_Component is imported from the Workspace_Package, THE Tab_Content_Component SHALL render identically to its current implementation in the Mobile_App.
5. THE Mobile_App SHALL import workspace components from `@admini/workspace` instead of local paths after extraction.

### Requirement 3: Service Layer Extraction

**User Story:** As a developer, I want the service layer extracted into the shared package with a pluggable Supabase client, so that both apps share data-fetching logic without duplicating backend calls.

#### Acceptance Criteria

1. THE Workspace_Package SHALL export dashboardService, organizationService, and invitationService modules.
2. THE Workspace_Package SHALL provide a Supabase_Client_Provider mechanism that allows consuming apps to inject their configured Supabase client instance.
3. WHEN a consuming app provides a Supabase client via the Supabase_Client_Provider, THE Service_Layer SHALL use that client for all data operations.
4. IF the Service_Layer encounters a failure while using the provided Supabase client, THEN the Service_Layer SHALL fail gracefully without throwing unhandled errors.
5. IF a service function is called before a Supabase client has been provided, THEN THE Service_Layer SHALL throw a descriptive error indicating configuration is required.
6. THE Service_Layer SHALL not import directly from `apps/mobile` or `apps/desktop` modules.

### Requirement 4: Platform-Adaptive Navigation

**User Story:** As a developer, I want WorkspaceShell to accept a pluggable navigation adapter, so that mobile uses a bottom tab bar and desktop uses a sidebar without forking the shell logic.

#### Acceptance Criteria

1. THE WorkspaceShell SHALL accept a `navigation` render prop or slot that receives the current active tab, available tabs, and a tab-change callback.
2. WHEN the Mobile_App renders WorkspaceShell, THE Mobile_App SHALL pass a bottom TabBar as the navigation adapter.
3. WHEN the Desktop_App renders WorkspaceShell, THE Desktop_App SHALL pass a sidebar navigation component as the navigation adapter.
4. THE WorkspaceShell SHALL manage tab state, role-gated tab visibility, and active-tab rendering regardless of which Navigation_Adapter is provided.
5. WHILE a user's role is not `admin`, THE WorkspaceShell SHALL exclude the Admin tab from the tabs passed to the Navigation_Adapter.

### Requirement 5: Desktop App Integration

**User Story:** As a user of the desktop app, I want to see native workspace tabs instead of a full-screen iframe, so that I get the same rich experience as the mobile app.

#### Acceptance Criteria

1. WHEN the Desktop_App loads after authentication, THE Desktop_App SHALL render WorkspaceShell from the Workspace_Package with native tab content.
2. THE Desktop_App SHALL provide its own sidebar Navigation_Adapter with tab icons and labels matching the design language (sage/limestone palette, Tomorrow display font).
3. WHEN the Desktop_App renders a tab that has a native Tab_Content_Component, THE Desktop_App SHALL display the native component instead of an iframe.
4. THE Desktop_App SHALL remove the current full-screen iframe prototype rendering after WorkspaceShell integration is complete.
5. THE Desktop_App SHALL pass its existing Supabase client instance to the Supabase_Client_Provider during initialization.

### Requirement 6: IframeFallback Retention

**User Story:** As a developer, I want IframeFallback available as a shared component, so that both apps can gradually convert remaining tabs without breaking unconverted features.

#### Acceptance Criteria

1. THE Workspace_Package SHALL export the IframeFallback component.
2. WHEN a tab has not been converted to a native Tab_Content_Component, THE WorkspaceShell SHALL render IframeFallback for that tab.
3. THE IframeFallback SHALL maintain the postMessage bridge for user data, sign-out, reset, and task CRUD operations.
4. WHILE the IframeFallback is rendered for a non-active tab, THE IframeFallback SHALL remain mounted but hidden (display:none) to preserve iframe state.

### Requirement 7: All Native Tab Conversions

**User Story:** As a user, I want all tabs (Capture, Tasks, Pulse, More) rendered as native React components, so that the workspace provides a fast, consistent experience without iframe overhead.

#### Acceptance Criteria

1. THE Workspace_Package SHALL include native Tab_Content_Components for Capture, Dashboard, Tasks, Pulse, and More tabs.
2. WHEN a native Tab_Content_Component exists for a tab, THE WorkspaceShell SHALL render the native component rather than IframeFallback.
3. WHILE the workspace is in a transition period, THE WorkspaceShell SHALL support mixed rendering where some tabs use native Tab_Content_Components and others use IframeFallback simultaneously.
4. THE WorkspaceShell SHALL NOT fall back to IframeFallback for a tab when a native Tab_Content_Component exists for that tab, regardless of component errors.
5. THE CaptureTab SHALL provide voice-mode and tap-mode capture interfaces with word-board categories.
6. THE TasksTab SHALL fetch tasks from the Service_Layer and display them with filter pills (All, Today, This Week, Delegated) and priority indicators.
7. THE PulseTab SHALL display daily pulse check-in timeline, stats, day structure, and a notifications toggle.
8. THE Workspace_Package SHALL include a MoreTab component that surfaces settings, integrations access, and account actions.

### Requirement 8: Mobile App Migration

**User Story:** As a developer, I want the mobile app updated to consume the shared package, so that workspace code lives in one place and the mobile app remains functionally identical.

#### Acceptance Criteria

1. WHEN the extraction is complete, THE Mobile_App SHALL import WorkspaceShell, all Tab_Content_Components, useOrgData, and types from `@admini/workspace`.
2. THE Mobile_App SHALL remove the local `src/workspace/` directory after migration.
3. THE Mobile_App SHALL remove the local `src/services/dashboardService.ts`, `src/services/organizationService.ts`, and `src/services/invitationService.ts` after migration.
4. WHEN the Mobile_App renders after migration, THE Mobile_App SHALL produce the same visual output and behavior as before migration.
5. THE Mobile_App SHALL continue to provide its Supabase client via the Supabase_Client_Provider.

### Requirement 9: Shared Design Tokens and Styling

**User Story:** As a designer, I want both apps to render workspace components with the same design language, so that the brand experience is consistent across platforms.

#### Acceptance Criteria

1. THE Workspace_Package SHALL include CSS files or CSS module exports for all Tab_Content_Components.
2. THE Workspace_Package SHALL use design tokens consistent with the established design language (sage/limestone colors, rounded cards, horizontal-scroll KPI cards).
3. WHEN a Tab_Content_Component is rendered on mobile or desktop, THE Tab_Content_Component SHALL apply the same core visual styling (colors, typography, border radii, card structures) regardless of platform, WHILE responsive adjustments to spacing and font sizes for different screen dimensions SHALL be permitted.
4. THE Workspace_Package SHALL not hard-code platform-specific layout styles (fixed heights, viewport-unit widths) in shared Tab_Content_Component styles.

### Requirement 10: Testing and Quality Assurance

**User Story:** As a developer, I want the shared package to have tests, so that I can refactor with confidence and catch regressions before they reach either app.

#### Acceptance Criteria

1. THE Workspace_Package SHALL include unit tests for all exported service functions.
2. THE Workspace_Package SHALL include component tests for WorkspaceShell tab-state management and role-gating logic.
3. WHEN a service function receives valid inputs, THE service function SHALL return correctly shaped data matching the exported type definitions.
4. IF a service function is called without a configured Supabase client and the function throws an error, THEN the error message SHALL contain "not configured".
5. FOR ALL DashboardTask inputs, sorting by urgency then parsing and re-sorting SHALL produce the same ordering (round-trip property for sort stability).
