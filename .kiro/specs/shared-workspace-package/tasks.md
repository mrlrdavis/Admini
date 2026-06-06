# Implementation Plan: Shared Workspace Package

## Overview

Extract workspace components, services, hooks, and types from `apps/mobile/src/workspace/` and `apps/mobile/src/services/` into a new shared monorepo package (`packages/workspace`). The package uses React Context for Supabase client injection and render props for navigation to remain platform-agnostic. Both mobile and desktop apps consume the shared package with platform-specific adapters.

## Tasks

- [x] 1. Set up package structure and configuration
  - [x] 1.1 Create `packages/workspace/package.json` with name `@admini/workspace`, peer dependencies (`react`, `@supabase/supabase-js`), dependency on `@admini/ui` and `@admini/shared`, dev dependencies (`@testing-library/react`, `fast-check`, `vitest`, `typescript`), and source entry point via `exports` field
    - Set `"type": "module"` and `"private": true`
    - Add `typecheck` and `test` scripts
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.2 Create `packages/workspace/tsconfig.json` extending `../../tsconfig.base.json` with `include: ["src"]`
    - _Requirements: 1.5_

  - [x] 1.3 Add `@admini/workspace` path alias to `tsconfig.base.json` (`"@admini/workspace": ["packages/workspace/src/index.ts"]`)
    - _Requirements: 1.4, 1.6_

  - [x] 1.4 Create `packages/workspace/src/index.ts` barrel file exporting all public modules (components, hooks, services, providers, types)
    - Follow the exact export structure defined in the design document
    - _Requirements: 1.4, 2.1, 2.2, 2.3_

- [x] 2. Implement types and provider layer
  - [x] 2.1 Create `packages/workspace/src/types.ts` with all shared type definitions
    - Define `WorkspaceTab`, `AdminiRole`, `OrgDetails`, `OrgDetailsForm`, `OrgMember`, `OrgInvitation`, `OrgFeatureFlag`, `ActivityEvent`, `DashboardTask`, `DashboardKPIs`, `TabItem`, `NavigationAdapterProps`, `AuthUser`, `WorkspaceShellProps`
    - _Requirements: 2.3_

  - [x] 2.2 Create `packages/workspace/src/services/getClient.ts` with `configureClient()`, `getClient()`, and `resetClient()` functions
    - `getClient()` must throw an error containing "not configured" when called without prior configuration
    - _Requirements: 3.2, 3.4_

  - [x] 2.3 Create `packages/workspace/src/providers/SupabaseClientProvider.tsx` implementing React Context for Supabase client injection
    - Export `SupabaseClientProvider` component and `useSupabaseClient` hook
    - Synchronously call `configureClient()` before first render cycle
    - Re-configure on client prop change; call `resetClient()` on unmount
    - Throw descriptive error in `useSupabaseClient()` when called outside provider
    - _Requirements: 3.2, 3.3, 3.4_

  - [ ]* 2.4 Write property test for Supabase client injection (Property 1)
    - **Property 1: Supabase client injection propagates to services**
    - **Validates: Requirements 3.2, 3.3**

  - [ ]* 2.5 Write property test for missing client error (Property 2)
    - **Property 2: Missing client produces descriptive error**
    - **Validates: Requirements 3.4, 10.4**

- [x] 3. Extract service layer
  - [x] 3.1 Create `packages/workspace/src/services/dashboardService.ts` by migrating from `apps/mobile/src/services/dashboardService.ts`
    - Replace `import { supabase } from './supabaseClient'` with `import { getClient } from './getClient'`
    - Keep all existing query logic, mapping functions (`mapTask`, `mapSyncEvent`), and `DashboardServiceError` class
    - Export `getTasks`, `getActivityEvents`, `getDashboardKPIs`, and `sortByUrgency` (extract sort comparator as named export)
    - _Requirements: 3.1, 3.5_

  - [x] 3.2 Create `packages/workspace/src/services/organizationService.ts` by migrating from `apps/mobile/src/services/organizationService.ts`
    - Replace direct supabase import with `getClient()` call
    - Export `getOrgDetails`, `updateOrgDetails`, `listOrgMembers`, `updateMemberRole`, `listFeatureFlags`, `toggleFeatureFlag`
    - _Requirements: 3.1, 3.5_

  - [x] 3.3 Create `packages/workspace/src/services/invitationService.ts` by migrating from `apps/mobile/src/services/invitationService.ts`
    - Replace direct supabase import with `getClient()` call
    - Export `listInvitations`, `createInvitation`, `revokeInvitation`
    - _Requirements: 3.1, 3.5_

  - [ ]* 3.4 Write unit tests for service functions (`packages/workspace/__tests__/services/dashboardService.test.ts`)
    - Mock `getClient()` to return a mock Supabase client
    - Verify correct data shape returned for `getTasks`, `getActivityEvents`, `getDashboardKPIs`
    - Verify error thrown when client not configured
    - _Requirements: 10.1, 10.3, 10.4_

  - [ ]* 3.5 Write property test for service output shape conformance (Property 7)
    - **Property 7: Service output shape conformance**
    - **Validates: Requirements 10.3**

  - [ ]* 3.6 Write property test for sort-by-urgency idempotence (Property 8)
    - **Property 8: Sort-by-urgency idempotence**
    - **Validates: Requirements 10.5**

- [x] 4. Extract hooks
  - [x] 4.1 Create `packages/workspace/src/hooks/useOrgData.ts` by migrating from `apps/mobile/src/workspace/useOrgData.ts`
    - Update service imports to use relative paths within the package
    - _Requirements: 2.2_

- [x] 5. Checkpoint - Verify foundational layer
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Extract components
  - [x] 6.1 Create `packages/workspace/src/components/IframeFallback.tsx` by migrating from `apps/mobile/src/workspace/IframeFallback.tsx`
    - Maintain postMessage bridge for user data, sign-out, reset, and task CRUD operations
    - Accept `visible` prop controlling display:none for hidden-but-mounted behavior
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 6.2 Create `packages/workspace/src/components/DashboardTab.tsx` by migrating from `apps/mobile/src/workspace/DashboardTab.tsx`
    - Update service imports to use the package's internal service layer
    - Export `sortByUrgency` comparator function for testing
    - _Requirements: 2.1, 2.4, 7.1_

  - [x] 6.3 Create `packages/workspace/src/components/AdminTab.tsx` by migrating from `apps/mobile/src/workspace/AdminTab.tsx`
    - Update hook/service imports to use package-internal paths
    - _Requirements: 2.1, 2.4_

  - [x] 6.4 Create `packages/workspace/src/components/CaptureTab.tsx` by migrating from `apps/mobile/src/workspace/CaptureTab.tsx`
    - Provide voice-mode and tap-mode capture interfaces with word-board categories
    - _Requirements: 7.1, 7.3_

  - [x] 6.5 Create `packages/workspace/src/components/TasksTab.tsx` by migrating from `apps/mobile/src/workspace/TasksTab.tsx`
    - Fetch tasks from the service layer, display with filter pills (All, Today, This Week, Delegated) and priority indicators
    - _Requirements: 7.1, 7.4_

  - [x] 6.6 Create `packages/workspace/src/components/PulseTab.tsx` by migrating from `apps/mobile/src/workspace/PulseTab.tsx`
    - Display daily pulse check-in timeline, stats, day structure, and notifications toggle
    - _Requirements: 7.1, 7.5_

  - [x] 6.7 Create `packages/workspace/src/components/MoreTab.tsx` as a new component
    - Surface settings, integrations access, and account actions (sign out)
    - Accept `onSignOut` callback prop
    - _Requirements: 7.1, 7.6_

  - [x] 6.8 Create `packages/workspace/src/components/WorkspaceShell.tsx` implementing the platform-agnostic shell
    - Accept `renderNavigation` render prop with `NavigationAdapterProps`
    - Manage tab state, role-gated tab visibility (exclude Admin for non-admin roles)
    - Route to native Tab_Content_Components for all tabs in NATIVE_TABS set
    - Fall back to IframeFallback for unconverted tabs
    - Always mount IframeFallback (hidden when native tab active)
    - _Requirements: 4.1, 4.4, 4.5, 6.2, 6.4, 7.2_

  - [ ]* 6.9 Write component tests for WorkspaceShell tab-state management and role-gating (`packages/workspace/__tests__/components/WorkspaceShell.test.tsx`)
    - Verify tab list changes based on role
    - Verify admin tab exclusion for non-admin roles
    - Verify active tab routing to correct component
    - _Requirements: 10.2_

  - [ ]* 6.10 Write property test for native tab routing (Property 3)
    - **Property 3: Native tabs route to native components**
    - **Validates: Requirements 5.3, 7.2**

  - [ ]* 6.11 Write property test for non-native tab routing (Property 4)
    - **Property 4: Non-native tabs route to IframeFallback**
    - **Validates: Requirements 6.2**

  - [ ]* 6.12 Write property test for role-gated tab filtering (Property 5)
    - **Property 5: Role-gated tab filtering**
    - **Validates: Requirements 4.4, 4.5**

  - [ ]* 6.13 Write property test for IframeFallback persistence (Property 6)
    - **Property 6: IframeFallback remains mounted when hidden**
    - **Validates: Requirements 6.4**

- [x] 7. Extract styles
  - [x] 7.1 Create `packages/workspace/src/styles/` directory with CSS files for each component
    - Create `index.css`, `dashboard.css`, `admin.css`, `capture.css`, `tasks.css`, `pulse.css`, `more.css`, `iframe-fallback.css`
    - Use design tokens consistent with sage/limestone palette, rounded cards, horizontal-scroll KPI cards
    - Remove platform-specific layout styles (fixed heights, viewport-unit widths) from shared styles
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 8. Checkpoint - Verify shared package
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Integrate desktop app
  - [x] 9.1 Create `apps/desktop/src/components/DesktopSidebar.tsx` implementing the sidebar Navigation_Adapter
    - Accept `NavigationAdapterProps` from `@admini/workspace`
    - Use sage/limestone palette and Tomorrow display font
    - Include tab icons, labels, aria attributes for accessibility
    - _Requirements: 5.2, 4.3_

  - [x] 9.2 Create `apps/desktop/src/Workspace.tsx` rendering `SupabaseClientProvider` and `WorkspaceShell`
    - Wrap with `SupabaseClientProvider` passing the desktop Supabase client
    - Pass `DesktopSidebar` via `renderNavigation` prop
    - _Requirements: 5.1, 5.3, 5.5_


  - [x] 9.3 Update `apps/desktop/src/App.tsx` to use the new `Workspace.tsx` component
    - Replace `ProtectedWorkspace` iframe-based rendering with `WorkspaceShell` integration
    - Remove the full-screen iframe prototype rendering
    - _Requirements: 5.4_

  - [x] 9.4 Add `@admini/workspace` as a dependency in `apps/desktop/package.json`
    - _Requirements: 5.1_

- [x] 10. Migrate mobile app
  - [x] 10.1 Update `apps/mobile` to add `@admini/workspace` as a dependency in `package.json`
    - _Requirements: 8.1_

  - [x] 10.2 Update `apps/mobile/src/App.tsx` (or equivalent entry point) to wrap workspace in `SupabaseClientProvider` and render `WorkspaceShell` with `TabBar` as navigation adapter via `renderNavigation`
    - Import `WorkspaceShell`, `SupabaseClientProvider` from `@admini/workspace`
    - Pass local `supabase` client to provider
    - Pass `TabBar` from `@admini/ui` as the `renderNavigation` adapter
    - _Requirements: 8.1, 8.4, 8.5, 4.2_

  - [x] 10.3 Remove local workspace directory (`apps/mobile/src/workspace/`) after confirming imports resolve from `@admini/workspace`
    - _Requirements: 8.2_

  - [x] 10.4 Remove local service files (`apps/mobile/src/services/dashboardService.ts`, `organizationService.ts`, `invitationService.ts`) after confirming imports resolve from `@admini/workspace`
    - _Requirements: 8.3_

- [x] 11. Final verification
  - [x] 11.1 Run `npm run typecheck` across the full monorepo and fix any type errors
    - Verify zero type errors in `packages/workspace`, `apps/mobile`, and `apps/desktop`
    - _Requirements: 1.5, 1.6_

  - [ ]* 11.2 Run full test suite (`npm test -w @admini/workspace`) and verify all tests pass
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The package follows the existing monorepo pattern: no build step, consumers handle TypeScript via the `exports` field pointing to source `.ts` files
- IframeFallback is retained to support gradual migration of any remaining unconverted features

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3"] },
    { "id": 3, "tasks": ["2.4", "2.5", "3.1", "3.2", "3.3", "4.1"] },
    { "id": 4, "tasks": ["3.4", "3.5", "3.6", "6.1", "6.2", "6.3", "6.4", "6.5", "6.6", "6.7"] },
    { "id": 5, "tasks": ["6.8", "7.1"] },
    { "id": 6, "tasks": ["6.9", "6.10", "6.11", "6.12", "6.13"] },
    { "id": 7, "tasks": ["9.1", "9.4", "10.1"] },
    { "id": 8, "tasks": ["9.2", "10.2"] },
    { "id": 9, "tasks": ["9.3", "10.3", "10.4"] },
    { "id": 10, "tasks": ["11.1", "11.2"] }
  ]
}
```
