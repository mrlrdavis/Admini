# Tasks: User Workflow Testing & Iterations

## Task 1: Profile Editing (REQ-5)
- [ ] Add updateProfile function to supabase.ts (updates profiles table + auth.users metadata)
- [ ] Replace drawer "managed through signup" text with actual input fields
- [ ] Pre-fill inputs with current values from profile data
- [ ] Save button calls updateProfile and refreshes UI
- [ ] Admin-only gate on school name editing
- [ ] Email notification checkbox for school name changes

## Task 2: Google OAuth Onboarding (REQ-3)
- [ ] Ensure first Google sign-in always shows onboarding wizard
- [ ] After wizard completion, update organization name from wizard's school name
- [ ] After wizard completion, update organization_memberships.role from wizard selection
- [ ] Add server-side onboarding-complete check (query profile metadata, not just IndexedDB)
- [ ] Pre-fill display name from Google metadata in wizard

## Task 3: Invitation Flow (REQ-4)
- [ ] Parse invitation token from URL params on app load
- [ ] Call accept_invitation when signed-in user has pending token
- [ ] Pre-fill school name in onboarding from the invitation's organization
- [ ] Skip school-name onboarding step for invited users
- [ ] Handle expired/invalid invitation tokens gracefully

## Task 4: Onboarding Server Persistence (REQ-2)
- [ ] Store onboarding_complete flag on profile (server, not just IndexedDB)
- [ ] Store role/focus/systems preferences on membership or profile metadata
- [ ] On sign-in, check server for onboarding state before showing wizard
- [ ] IndexedDB acts as cache only, server is source of truth

## Task 5: Multi-Device Consistency (REQ-14)
- [ ] Session check on focus/visibility change (re-validate token)
- [ ] Task list refresh on window focus
- [ ] Onboarding state check uses server, not just local storage

## Task 6: Role-Based Access Control (REQ-16)
- [ ] Query user's role from organization_memberships on profile load
- [ ] Disable/hide admin-only actions for non-admin users
- [ ] School name edit restricted to admin/principal roles
- [ ] Invitation management restricted to admin/principal

## Task 7: Error Handling (REQ-15)
- [ ] Wrap all Supabase calls with user-friendly error messages
- [ ] Add loading states to all async operations
- [ ] Handle token expiry gracefully (redirect to sign-in)
- [ ] Show inline validation on forms

## Task 8: Validate Auth Flow (REQ-1)
- [x] Verify .env.local has correct Supabase credentials
- [x] Verify signInWithOAuth sends correct redirectTo URL
- [ ] Test email/password sign-up end-to-end
- [x] Test Google OAuth (configured)
- [x] Test sign-out returns to auth screen
- [ ] Test Delete Account returns to auth screen

## Task 9: Validate Workspace Features (REQ-6)
- [ ] Test task creation via Supabase
- [ ] Test task listing
- [ ] Test task status cycling
- [ ] Verify navigation between prototype views
- [ ] Verify empty states render correctly

## Task 10: Production Readiness
- [ ] All TypeScript passes (verified)
- [ ] No JS syntax errors in prototypes (verified)
- [ ] Netlify build works (npm run build:apps)
- [ ] OAuth works with production URLs
- [ ] Data retention policies enforced