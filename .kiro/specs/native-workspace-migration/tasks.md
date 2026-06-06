# Implementation Plan: Native Workspace Migration

## Overview

Migrate the Admini mobile workspace from a full-screen iframe prototype to native React components. The Dashboard tab converts first; unconverted tabs remain in a hidden/shown iframe. A new Admin-only Organization Management tab is introduced. Reusable primitives go into `packages/ui`; workspace views live in `apps/mobile/src/workspace/`.

A service layer abstraction (Dashboard, Organization, Invitation services) in `apps/mobile/src/services/` encapsulates all Supabase queries - components and hooks consume services, never Supabase directly. An audit log table records admin actions for accountability. A feature flag table controls per-organization feature enablement.

## Tasks

- [x] 0. Service layer and database foundations (Phase 0)
  - [x] 0.1 Create dashboardService
    - Create `apps/mobile/src/services/dashboardService.ts`
    - Export async functions: `getTasks()`, `getActivityEvents()`, `getDashboardKPIs()`
    - Encapsulate Supabase queries for: fetching tasks (open, completed, overdue), fetching activity events, computing KPI metrics, pulse countdown data
    - Handle error wrapping (catch Supabase errors, return typed Result or throw typed errors)
    - Components/hooks never call Supabase directly for dashboard data - they call this service
    - Can be mocked in tests via module mocking
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 0.2 Create organizationService
    - Create `apps/mobile/src/services/organizationService.ts`
    - Export async functions: `getOrgDetails(orgId)`, `updateOrgDetails(orgId, form)`, `listOrgMembers(orgId)`, `updateMemberRole(orgId, profileId, role)`, `listFeatureFlags(orgId)`, `toggleFeatureFlag(orgId, flagId, enabled)`
    - Encapsulate Supabase queries for: org CRUD (get/update school details), member listing, role updates, feature flag listing/toggling
    - Handle error wrapping consistently
    - Can be mocked in tests
    - _Requirements: 6.1, 6.2, 6.6, 6.7, 6.8, 6.9, 8.1, 8.3, 8.4_

  - [x] 0.3 Create invitationService
    - Create `apps/mobile/src/services/invitationService.ts`
    - Export async functions: `listInvitations(orgId)`, `createInvitation(orgId, email, role)`, `revokeInvitation(invitationId)`
    - Encapsulate Supabase queries for: listing invitations, creating invitations, revoking invitations
    - Handle error wrapping consistently
    - Can be mocked in tests
    - _Requirements: 6.4, 6.5, 8.2_

  - [x] 0.4 Create Supabase migration for audit_logs table
    - Create `supabase/migrations/YYYYMMDD_audit_logs.sql`
    - Table `public.audit_logs`: `id uuid PK default gen_random_uuid()`, `organization_id uuid NOT NULL FK -> organizations ON DELETE CASCADE`, `actor_id uuid NOT NULL FK -> profiles ON DELETE SET NULL`, `action text NOT NULL`, `entity_type text`, `entity_id uuid`, `metadata jsonb`, `created_at timestamptz NOT NULL default now()`
    - Add index on `(organization_id, created_at DESC)` for efficient lookups
    - Enable RLS: org members can read their org's logs; system/authenticated admin can insert
    - _Requirements: 8.1 (accountability)_

  - [x] 0.5 Create Supabase migration for organization_feature_flags table
    - Create `supabase/migrations/YYYYMMDD_org_feature_flags.sql`
    - Table `public.organization_feature_flags`: `id uuid PK default gen_random_uuid()`, `organization_id uuid NOT NULL FK -> organizations ON DELETE CASCADE`, `flag_key text NOT NULL`, `enabled boolean NOT NULL default true`, `updated_by uuid FK -> profiles ON DELETE SET NULL`, `created_at timestamptz NOT NULL default now()`, `updated_at timestamptz NOT NULL default now()`, `UNIQUE (organization_id, flag_key)`
    - Add index on `(organization_id)`
    - Add trigger `set_updated_at` before update
    - Enable RLS: members can read; admins can manage (insert/update/delete)
    - Grant select, insert, update, delete to authenticated
    - _Requirements: 6.8, 6.9, 8.4_

- [x] 1. Checkpoint - Verify service layer and migrations
  - Ensure all tests pass, ask the user if questions arise.

- [x] 2. Create shared UI primitives in packages/ui
  - [x] 2.1 Implement LayoutShell component
    - Create `packages/ui/src/LayoutShell.tsx` with `LayoutShellProps` interface (children, bottomBar)
    - Full-viewport flex container: `height: 100dvh; display: flex; flex-direction: column; overflow: hidden`
    - Content area grows to fill available space; bottomBar slot is fixed at bottom
    - _Requirements: 7.2, 7.4, 7.5_

  - [x] 2.2 Implement TabBar component
    - Create `packages/ui/src/TabBar.tsx` with `TabItem` and `TabBarProps` interfaces
    - Render `<nav role="tablist">` with tab items from declarative config array
    - Active item gets `aria-selected="true"` and `.tab-item--active` CSS class
    - Fixed position at bottom with safe-area inset padding for mobile
    - _Requirements: 7.1, 7.4, 7.5, 2.1, 2.5_

  - [x] 2.3 Implement KPICard component
    - Create `packages/ui/src/KPICard.tsx` with `KPICardProps` interface (label, value, trend?)
    - Render label text and string representation of value; optional trend indicator (up/down/neutral)
    - _Requirements: 7.3, 7.4, 7.5_

  - [x] 2.4 Export new components from packages/ui barrel
    - Update `packages/ui/src/index.ts` to re-export LayoutShell, TabBar, KPICard
    - Add corresponding CSS styles to `packages/ui/src/styles.css`
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 3. Create workspace types and data layer
  - [x] 3.1 Create workspace type definitions
    - Create `apps/mobile/src/workspace/types.ts` with all interfaces: `AdminiRole`, `OrgDetails`, `OrgDetailsForm`, `OrgMember`, `OrgInvitation`, `OrgFeatureFlag`, `ActivityEvent`, `WorkspaceTab`
    - _Requirements: 6.1, 6.4, 6.6, 6.8_

  - [x] 3.2 Extend supabase.ts with organization queries (thin wrappers calling services)
    - Update `apps/mobile/src/supabase.ts` to delegate to `organizationService`, `invitationService`, and `dashboardService`
    - Maintain backward-compatible exports: `getOrgDetails`, `updateOrgDetails`, `listOrgMembers`, `updateMemberRole`, `listInvitations`, `createInvitation`, `listFeatureFlags`, `toggleFeatureFlag`
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 3.3 Create useOrgData hook
    - Create `apps/mobile/src/workspace/useOrgData.ts` that fetches org details, members, invitations, and feature flags via the service layer
    - Returns loading/error states and data for each section
    - Provides mutation functions that update local state optimistically or on success
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 3.4 Create Supabase migration for org_details_columns
    - Create `supabase/migrations/YYYYMMDD_org_details_columns.sql` adding `address`, `contact_email`, `contact_phone` columns to `organizations` table
    - _Requirements: 6.1, 8.1_

- [x] 4. Checkpoint - Verify primitives and data layer
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement IframeFallback component
  - [x] 5.1 Create IframeFallback component
    - Create `apps/mobile/src/workspace/IframeFallback.tsx` with `IframeFallbackProps` interface
    - Render a single `<iframe>` that is never unmounted; toggle `display: block/none` via `visible` prop
    - On mount and when `visible` transitions to `true`, send `userPayload` via `postMessage`
    - Listen for incoming messages: `request-signout`, `reset-user-data`, `tasks:list`, `tasks:create`, `tasks:update-status`
    - Extract and refactor existing postMessage logic from the `ProtectedWorkspace` component
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 6. Implement WorkspaceShell with tab state management
  - [x] 6.1 Create WorkspaceShell component
    - Create `apps/mobile/src/workspace/WorkspaceShell.tsx` with `WorkspaceShellProps` interface
    - Manage `activeTab` state via `useState<WorkspaceTab>('dashboard')`
    - Build tab config array with `useMemo`, conditionally including Admin tab for admin role
    - Role guard: `useEffect` that redirects non-admin from admin tab to dashboard
    - Use `LayoutShell` as the outer container and `TabBar` in the bottomBar slot
    - Conditionally render native tabs; always mount `IframeFallback` with visibility toggle
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.2, 2.3, 2.4, 2.6, 5.1, 5.2, 5.3_

- [x] 7. Implement DashboardTab native view
  - [x] 7.1 Create DashboardTab component
    - Create `apps/mobile/src/workspace/DashboardTab.tsx` with `DashboardTabProps` interface
    - Implement greeting section: `getTimeGreeting() + ', ' + userName`
    - Implement KPI cards section using `KPICard` component (open tasks, completed this week, overdue)
    - Implement priority queue: filter open tasks, sort by urgency (urgent > high > normal > low), ties by dueAt ascending
    - Implement activity feed: sort events by `createdAt` descending
    - Implement pulse countdown section
    - Handle loading state, error state with inline error banner + retry button
    - Fetch data via `dashboardService` (not directly from Supabase)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 8. Implement AdminTab view
  - [x] 8.1 Create AdminTab component
    - Create `apps/mobile/src/workspace/AdminTab.tsx` with `AdminTabProps` interface
    - Implement school details section: editable form with name, address, contact email, contact phone; submit persists via `organizationService`
    - Implement member list section: display members with name, email, role; role change dropdown
    - Implement invitation section: email input + role selector; submit creates invitation via `invitationService`; list pending invitations
    - Implement Feature Flags section: render toggles for each feature flag; toggle persists via `organizationService.toggleFeatureFlag()`
    - Use `useOrgData` hook for all data fetching and mutations
    - Handle loading indicators on write operations, disable submit while in-flight
    - Handle error states: preserve form data on failure, show error message, show "Insufficient permissions" for 403
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 8.5, 8.6_

- [x] 9. Checkpoint - Verify native tabs render correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Wire WorkspaceShell into App.tsx
  - [x] 10.1 Replace ProtectedWorkspace with WorkspaceShell in App.tsx
    - Modify `apps/mobile/src/App.tsx` to render `WorkspaceShell` instead of `ProtectedWorkspace` for authenticated, onboarded users
    - Pass required props: user, userRole (from profile), userName, schoolName, prototypePath, onSignOut, onResetUserData
    - Fetch user profile with `getOrCreateProfile()` to obtain role and organization_id
    - Keep `ProtectedWorkspace` for the onboarding-in-progress state (iframe background behind modal)
    - Update styles as needed in `apps/mobile/src/styles.css`
    - _Requirements: 1.1, 1.2, 1.3, 2.4_

- [x] 11. Checkpoint - Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Property-based tests
  - [ ]* 12.1 Write property test: Admin tab visibility is role-gated
    - **Property 1: Admin tab visibility is role-gated**
    - For any user object, the Admin tab item appears in TabBar output iff `user.role === 'admin'`
    - **Validates: Requirements 2.3, 5.1, 5.2**

  - [ ]* 12.2 Write property test: Tab selection renders corresponding content
    - **Property 2: Tab selection renders corresponding content**
    - For any valid tab ID and user state, setting activeTab renders that tab's content and no other
    - **Validates: Requirements 2.4**

  - [ ]* 12.3 Write property test: Non-admin forced redirect from admin tab
    - **Property 3: Non-admin forced redirect from admin tab**
    - For any non-admin user, setting activeTab to 'admin' resets to 'dashboard'
    - **Validates: Requirements 5.3**

  - [ ]* 12.4 Write property test: Time-based greeting includes user name
    - **Property 4: Time-based greeting includes user name**
    - For any display name and hour (0-23), greeting contains time-appropriate prefix and the name
    - **Validates: Requirements 3.1**

  - [ ]* 12.5 Write property test: Priority queue sorted by urgency
    - **Property 5: Priority queue sorted by urgency**
    - For any list of open tasks, priority queue is in descending urgency order with ties broken by dueAt ascending
    - **Validates: Requirements 3.3**

  - [ ]* 12.6 Write property test: Activity feed in reverse chronological order
    - **Property 6: Activity feed in reverse chronological order**
    - For any list of activity events, feed is sorted by createdAt descending
    - **Validates: Requirements 3.4**

  - [ ]* 12.7 Write property test: Iframe visibility invariant
    - **Property 7: Iframe visibility invariant**
    - For any sequence of tab switches, iframe is visible iff activeTab is unconverted; iframe never removed from DOM
    - **Validates: Requirements 4.1, 4.4, 4.5**

  - [ ]* 12.8 Write property test: postMessage dispatch correctness
    - **Property 8: postMessage dispatch correctness**
    - For any incoming postMessage with known type, the corresponding handler is invoked exactly once
    - **Validates: Requirements 4.3**

  - [ ]* 12.9 Write property test: Error state preserves form data
    - **Property 9: Error state preserves form data**
    - For any Admin form, if write returns error, form fields retain pre-submission values and error is non-empty
    - **Validates: Requirements 6.3**

  - [ ]* 12.10 Write property test: Member list completeness
    - **Property 10: Member list completeness**
    - For any array of members, AdminTab renders exactly one entry per member with name, email, and role
    - **Validates: Requirements 6.6**

  - [ ]* 12.11 Write property test: Feature flag toggles completeness
    - **Property 11: Feature flag toggles completeness**
    - For any array of feature flags, AdminTab renders exactly one toggle per flag reflecting enabled state
    - **Validates: Requirements 6.8**

  - [ ]* 12.12 Write property test: KPICard renders all provided data
    - **Property 12: KPICard renders all provided data**
    - For any label, value, and optional trend, KPICard output contains label text and string value
    - **Validates: Requirements 7.3**

  - [ ]* 12.13 Write property test: Loading state disables submission
    - **Property 13: Loading state disables submission**
    - For any in-flight write operation, submit button is disabled and loading indicator is present
    - **Validates: Requirements 8.5**

- [x] 13. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- No new runtime dependencies needed - existing React 18, Supabase JS ^2.45, and Vite 5 stack is sufficient
- The iframe is never destroyed during tab switches to preserve internal prototype state
- The `ProtectedWorkspace` component is kept for the onboarding background but replaced post-onboarding
- **Service layer pattern**: All Supabase queries are encapsulated in service modules located in `apps/mobile/src/services/` (`dashboardService`, `organizationService`, `invitationService`). Each service is a TypeScript module exporting async functions. Components and hooks consume services, never Supabase directly. Services handle error wrapping and can be mocked in tests.
- **Audit logs**: The `audit_logs` table records admin actions (who did what, when) for accountability
- **Feature flags**: The `organization_feature_flags` table controls per-org feature enablement (replaces the previously-designed `organization_permissions` table). All references to "permissions" have been updated to "feature flags" throughout.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["0.1", "0.2", "0.3", "0.4", "0.5"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "3.1", "3.4"] },
    { "id": 2, "tasks": ["2.4", "3.2"] },
    { "id": 3, "tasks": ["3.3", "5.1"] },
    { "id": 4, "tasks": ["6.1"] },
    { "id": 5, "tasks": ["7.1", "8.1"] },
    { "id": 6, "tasks": ["10.1"] },
    { "id": 7, "tasks": ["12.1", "12.2", "12.3", "12.4", "12.5", "12.6", "12.7", "12.8", "12.9", "12.10", "12.11", "12.12", "12.13"] }
  ]
}
```
