# Implementation Plan: User Workflow Testing

## Overview

Validate all core user workflows end-to-end across Desktop and Mobile apps, fix broken paths, and iterate to production-ready state. Implementation covers auth flows, onboarding, profile management, settings panels, integrations, role-based access, and mobile-specific polish.

## Tasks

- [x] 1. Profile Editing
  - [x] 1.1 Add updateProfile function to supabase.ts (updates profiles table + auth.users metadata)
    - _Requirements: REQ-5_
  - [x] 1.2 Replace drawer "managed through signup" text with actual input fields
    - _Requirements: REQ-5_
  - [x] 1.3 Pre-fill inputs with current values from profile data
    - _Requirements: REQ-5_
  - [x] 1.4 Save button calls updateProfile and refreshes UI
    - _Requirements: REQ-5_
  - [x] 1.5 Admin-only gate on school name editing
    - _Requirements: REQ-5, REQ-16_
  - [x] 1.6 Email notification checkbox for school name changes
    - _Requirements: REQ-5_

- [x] 2. Google OAuth Onboarding
  - [x] 2.1 Ensure first Google sign-in always shows onboarding wizard
    - _Requirements: REQ-3_
  - [x] 2.2 After wizard completion, update organization name from wizard's school name
    - _Requirements: REQ-3_
  - [x] 2.3 After wizard completion, update organization_memberships.role from wizard selection
    - _Requirements: REQ-3_
  - [x] 2.4 Add server-side onboarding-complete check (query profile metadata, not just IndexedDB)
    - _Requirements: REQ-3_
  - [x] 2.5 Pre-fill display name from Google metadata in wizard
    - _Requirements: REQ-3_

- [x] 3. Invitation Flow
  - [x] 3.1 Parse invitation token from URL params on app load
    - _Requirements: REQ-4_
  - [x] 3.2 Call accept_invitation when signed-in user has pending token
    - _Requirements: REQ-4_
  - [x] 3.3 Pre-fill school name in onboarding from the invitation's organization
    - _Requirements: REQ-4_
  - [x] 3.4 Skip school-name onboarding step for invited users
    - _Requirements: REQ-4_
  - [x] 3.5 Handle expired/invalid invitation tokens gracefully
    - _Requirements: REQ-4_

- [x] 4. Onboarding Server Persistence
  - [x] 4.1 Store onboarding_complete flag on profile (server, not just IndexedDB)
    - _Requirements: REQ-2_
  - [x] 4.2 Store role/focus/systems preferences on membership or profile metadata
    - _Requirements: REQ-2_
  - [x] 4.3 On sign-in, check server for onboarding state before showing wizard
    - _Requirements: REQ-2_
  - [x] 4.4 IndexedDB acts as cache only, server is source of truth
    - _Requirements: REQ-2_

- [x] 5. Multi-Device Consistency
  - [x] 5.1 Session check on focus/visibility change (re-validate token)
    - _Requirements: REQ-14_
  - [x] 5.2 Task list refresh on window focus
    - _Requirements: REQ-14_
  - [x] 5.3 Onboarding state check uses server, not just local storage
    - _Requirements: REQ-14_

- [x] 6. Role-Based Access Control
  - [x] 6.1 Query user's role from organization_memberships on profile load
    - _Requirements: REQ-16_
  - [x] 6.2 Disable/hide admin-only actions for non-admin users
    - _Requirements: REQ-16_
  - [x] 6.3 School name edit restricted to admin/principal roles
    - _Requirements: REQ-16_
  - [x] 6.4 Invitation management restricted to admin/principal
    - _Requirements: REQ-16_

- [x] 7. Error Handling
  - [x] 7.1 Wrap all Supabase calls with user-friendly error messages
    - _Requirements: REQ-15_
  - [x] 7.2 Add loading states to all async operations
    - _Requirements: REQ-15_
  - [x] 7.3 Handle token expiry gracefully (redirect to sign-in)
    - _Requirements: REQ-15_
  - [x] 7.4 Show inline validation on forms
    - _Requirements: REQ-15_

- [x] 8. Validate Auth Flow
  - [x] 8.1 Verify .env.local has correct Supabase credentials
    - _Requirements: REQ-1_
  - [x] 8.2 Verify signInWithOAuth sends correct redirectTo URL
    - _Requirements: REQ-1_
  - [x] 8.3 Test email/password sign-up end-to-end
    - _Requirements: REQ-1_
  - [x] 8.4 Test Google OAuth (configured)
    - _Requirements: REQ-1_
  - [x] 8.5 Test sign-out returns to auth screen
    - _Requirements: REQ-1_
  - [x] 8.6 Test Delete Account returns to auth screen
    - _Requirements: REQ-1_

- [x] 9. Validate Workspace Features
  - [x] 9.1 Test task creation via Supabase
    - _Requirements: REQ-6_
  - [x] 9.2 Test task listing
    - _Requirements: REQ-6_
  - [x] 9.3 Test task status cycling
    - _Requirements: REQ-6_
  - [x] 9.4 Verify navigation between prototype views
    - _Requirements: REQ-6_
  - [x] 9.5 Verify empty states render correctly
    - _Requirements: REQ-6_

- [x] 10. Production Readiness
  - [x] 10.1 All TypeScript passes (verified)
    - _Requirements: REQ-17_
  - [x] 10.2 No JS syntax errors in prototypes (verified)
    - _Requirements: REQ-17_
  - [x] 10.3 Netlify build works (npm run build:apps)
    - _Requirements: REQ-17_
  - [x] 10.4 OAuth works with production URLs
    - _Requirements: REQ-1_
  - [x] 10.5 Data retention policies enforced
    - _Requirements: REQ-17_

- [ ] 11. Settings - Profile Management
  - [x] 11.1 Wire Profile button in MoreTab to open a profile editing view/drawer
    - _Requirements: REQ-5, REQ-16_
  - [x] 11.2 Create ProfileSettings component with editable fields: display name, email (read-only), school name (admin-only)
    - _Requirements: REQ-5, REQ-16_
  - [x] 11.3 Pre-fill fields from current user profile data (Supabase profiles table)
    - _Requirements: REQ-5_
  - [x] 11.4 Implement save/cancel with loading state and inline validation
    - _Requirements: REQ-5, REQ-15_
  - [x] 11.5 Admin/principal role check gates school name editing (non-admins see read-only)
    - _Requirements: REQ-16_
  - [-] 11.6 Show success toast or inline confirmation on save
    - _Requirements: REQ-5_
  - [ ] 11.7 Handle profile update errors with user-friendly messages
    - _Requirements: REQ-15_

- [ ] 12. Settings - Notifications Preferences
  - [ ] 12.1 Wire Notifications button in MoreTab to open notification settings view
    - _Requirements: REQ-11_
  - [ ] 12.2 Create NotificationSettings component with toggle switches (email notifications, push notifications, activity digest)
    - _Requirements: REQ-11_
  - [ ] 12.3 Store notification preferences in Supabase profile metadata (JSON column)
    - _Requirements: REQ-11_
  - [ ] 12.4 Load existing preferences on mount, save on toggle change
    - _Requirements: REQ-11_
  - [ ] 12.5 Debounce saves to avoid excessive writes
    - _Requirements: REQ-11_
  - [ ] 12.6 Handle save failures gracefully with retry option
    - _Requirements: REQ-15_

- [ ] 13. Settings - App Preferences
  - [ ] 13.1 Wire Preferences button in MoreTab to open app preferences view
    - _Requirements: REQ-11_
  - [ ] 13.2 Create AppPreferences component with: theme toggle (light/dark/system), default tab selection, compact mode toggle
    - _Requirements: REQ-11_
  - [ ] 13.3 Store preferences in IndexedDB (local-only, not server-synced)
    - _Requirements: REQ-11_
  - [ ] 13.4 Apply theme preference via data-theme attribute on document root
    - _Requirements: REQ-11_
  - [ ] 13.5 Apply compact mode via root CSS class that reduces spacing tokens
    - _Requirements: REQ-11_

- [ ] 14. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 15. Settings - Integrations Access
  - [ ] 15.1 Wire Connected Apps button in MoreTab to show connected integrations list
    - _Requirements: REQ-10_
  - [ ] 15.2 Wire Add Integration button to open integration catalog (reuse IntegrationsPanel from desktop)
    - _Requirements: REQ-10_
  - [ ] 15.3 Extract IntegrationsPanel from apps/desktop/src/App.tsx into shared component or render inline
    - _Requirements: REQ-10, REQ-13_
  - [ ] 15.4 Show connection status badges (connected/disconnected) on each integration
    - _Requirements: REQ-10_
  - [ ] 15.5 Implement disconnect flow (remove from IndexedDB, show confirmation)
    - _Requirements: REQ-10_

- [ ] 16. Settings - Account Management
  - [ ] 16.1 Add Delete Account button to Account section in MoreTab
    - _Requirements: REQ-1_
  - [ ] 16.2 Implement delete account flow: confirmation modal, call Supabase edge function, sign out, redirect to auth
    - _Requirements: REQ-1_
  - [ ] 16.3 Add Change Password button (only shown for email/password users, not OAuth)
    - _Requirements: REQ-1_
  - [ ] 16.4 Implement change password flow: current password, new password, confirm, call Supabase auth.updateUser
    - _Requirements: REQ-1_
  - [ ] 16.5 Add Export Data button with placeholder or basic JSON export of user tasks and profile
    - _Requirements: REQ-17_
  - [ ] 16.6 Handle all errors with user-friendly messages and loading states
    - _Requirements: REQ-15_

- [ ] 17. Settings - Navigation and State Management
  - [ ] 17.1 Add navigation state to MoreTab (which settings sub-view is active)
    - _Requirements: REQ-11_
  - [ ] 17.2 Implement back navigation from each settings sub-view to MoreTab menu
    - _Requirements: REQ-11_
  - [ ] 17.3 Add route-like state management (stack-based) so back button works naturally
    - _Requirements: REQ-11_
  - [ ] 17.4 Animate transitions between MoreTab menu and sub-views (slide-in from right)
    - _Requirements: REQ-11_
  - [ ] 17.5 Ensure settings views are accessible (focus management, aria-labels)
    - _Requirements: REQ-11_
  - [ ] 17.6 Persist last-visited settings section for quick return
    - _Requirements: REQ-11_

- [ ] 18. Settings - Mobile-Specific Fixes
  - [ ] 18.1 Ensure all settings views fit within mobile viewport without horizontal scroll
    - _Requirements: REQ-13_
  - [ ] 18.2 Add safe-area padding to settings views (bottom for tab bar, top for notch)
    - _Requirements: REQ-13_
  - [ ] 18.3 Test toggle switches are large enough for touch (44x44px minimum)
    - _Requirements: REQ-13_
  - [ ] 18.4 Ensure keyboard does not obscure active input fields in profile/password forms
    - _Requirements: REQ-13_
  - [ ] 18.5 Add pull-to-refresh on integrations list to refresh connection status
    - _Requirements: REQ-10, REQ-13_

- [ ] 19. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks 1-10 are complete and verified as production-ready
- Tasks marked with `[-]` are partially complete (in progress)
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- This project uses TypeScript with React, Vite, and Supabase
- Both Desktop and Mobile apps share the same Supabase backend

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["11.6", "11.7"] },
    { "id": 1, "tasks": ["12.1", "13.1", "17.1"] },
    { "id": 2, "tasks": ["12.2", "12.3", "13.2", "13.3", "17.2", "17.3"] },
    { "id": 3, "tasks": ["12.4", "12.5", "13.4", "13.5", "17.4", "17.5"] },
    { "id": 4, "tasks": ["12.6", "15.1", "16.1", "17.6"] },
    { "id": 5, "tasks": ["15.2", "15.3", "16.2", "16.3"] },
    { "id": 6, "tasks": ["15.4", "15.5", "16.4", "16.5"] },
    { "id": 7, "tasks": ["16.6", "18.1", "18.2"] },
    { "id": 8, "tasks": ["18.3", "18.4", "18.5"] }
  ]
}
```
