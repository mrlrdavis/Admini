# User Workflow Testing & App Iterations

## Overview
Validate all core user workflows end-to-end across both Desktop and Mobile apps, identify broken paths, and iterate to production-ready state. Includes critical edge cases for multi-device, invited users, OAuth-first users, and role-based access.

## Requirements

### REQ-1: Authentication Flow
- [ ] Email/password sign-up creates account and shows onboarding
- [ ] Email/password sign-in returns to workspace
- [ ] Google OAuth redirects and returns to app
- [ ] Sign out from workspace returns to auth front door
- [ ] Delete Account clears data and returns to auth front door
- [ ] Password reset sends email and allows re-entry
- [ ] Auth errors display clear, actionable messages (not raw Supabase errors)
- [ ] Session persists across page refresh (no re-login required)
- [ ] Expired session redirects gracefully to sign-in (no white screen)

### REQ-2: Onboarding Wizard
- [ ] Options are NOT pre-selected on load
- [ ] Options highlight on hover
- [ ] Selecting role advances to focus step
- [ ] Selecting focus advances to systems step
- [ ] Systems can be multi-selected (or skipped entirely)
- [ ] "Take me to AdminI" completes onboarding and shows workspace
- [ ] Onboarding data persists (refresh doesn't re-show wizard)
- [ ] Onboarding selections persist to server (not just IndexedDB)
- [ ] Role selection updates organization_memberships.role in Supabase
- [ ] School name from wizard updates the organization name server-side

### REQ-3: Google OAuth + Onboarding Edge Cases
- [ ] First Google sign-in triggers onboarding wizard (even though handle_new_user already created profile)
- [ ] Onboarding after Google sign-in updates the auto-created organization with user's chosen school name
- [ ] Google user signing in on a NEW device sees onboarding only if not previously completed server-side
- [ ] Google user signing in on same device after clearing browser data re-checks server state
- [ ] Google user's display name from Google metadata populates the "What should I call you?" default

### REQ-4: Invitation Flow Edge Cases
- [ ] Invited user accepting invitation has school name pre-filled from inviting organization
- [ ] Invited user's onboarding skips the "school name" step (already known)
- [ ] Invited user inherits the role specified in the invitation (not the wizard selection)
- [ ] Invited user sees the existing organization's integrations (not a blank slate)
- [ ] Invitation link works even if user doesn't have an account yet (sign-up + accept in one flow)
- [ ] Expired invitation shows clear error message, not a broken state
- [ ] User already in an org who accepts invite to another org can switch between them

### REQ-5: Profile Editing in Settings
- [ ] Edit button on Display Name opens input with current value pre-filled
- [ ] Edit button on School Name opens input (admin-only with notice)
- [ ] Saving display name updates profiles.display_name AND auth.users.raw_user_meta_data
- [ ] Saving school name updates organizations.name for all org members
- [ ] Non-admin users cannot edit school name (button disabled or hidden)
- [ ] Edit button on Role shows current role (read-only for non-admins, editable for admins)
- [ ] Email field shows current email (not editable in MVP, or with email verification flow)
- [ ] Changes reflect immediately in the UI without page refresh
- [ ] Changes sync across platforms (edit on desktop, see on mobile after refresh)

### REQ-6: Dashboard / Workspace
- [ ] User name and school display correctly from profile data (not just onboarding cache)
- [ ] Task creation works via Supabase
- [ ] Task list loads from Supabase
- [ ] Task status updates (open -> in_progress -> completed)
- [ ] Navigation between views works (dashboard, capture, tasks, etc.)
- [ ] Empty states show helpful guidance (not broken UI)
- [ ] Loading states display while data fetches (no flash of empty content)

### REQ-7: Capture (Desktop)
- [ ] Voice mode UI renders and shows transcription area
- [ ] Tap mode word board renders with categories
- [ ] Tap capture builds sentence from selected words
- [ ] Captures save to task list
- [ ] PII redaction works on captured text before storage

### REQ-8: Capture (Mobile)
- [ ] Voice mode mic button renders
- [ ] Tap mode word board renders
- [ ] Quick captures panel works
- [ ] Board edit mode (pencil icon) allows add/remove words
- [ ] Captures sync to same Supabase org (visible on desktop too)

### REQ-9: Observations (Desktop)
- [ ] Upload Roster option available (CSV or manual entry)
- [ ] Grade/Subject/Teacher selection works after roster loaded
- [ ] Observation timer starts and runs
- [ ] Stamped notes with tags appear in timeline
- [ ] End observation shows AI summary
- [ ] Roster data does NOT require integration connection

### REQ-10: Integrations
- [ ] Integration cards show "Available" status for all systems
- [ ] Toggle opens connection setup modal (OAuth/API Key/Manual)
- [ ] Cancel button in modal exits without change
- [ ] No references to "first time setup" anywhere
- [ ] Connected status persists across sessions

### REQ-11: Settings
- [ ] Profile shows name, school, email, role from server data
- [ ] Edit buttons open edit drawers with input fields
- [ ] School name edit shows admin-only notice and email notification option
- [ ] Sign out works from settings
- [ ] Delete Account prompts confirmation then signs out
- [ ] Theme toggle works and persists

### REQ-12: Help & Support
- [ ] All help topics display content (not just navigate away)
- [ ] "Customizing Your Board" shows board editing instructions
- [ ] "Getting Started" explains all major features
- [ ] "Contact Support" shows email info

### REQ-13: Cross-Platform Consistency
- [ ] Mobile auth flow mirrors desktop
- [ ] Mobile onboarding has same steps
- [ ] Mobile workspace shows same data from same Supabase org
- [ ] Sign out works on both platforms
- [ ] Profile edits on one platform reflect on the other

### REQ-14: Multi-Device / Multi-Session Edge Cases
- [ ] User signed in on two devices simultaneously doesn't corrupt data
- [ ] Task created on device A appears on device B after refresh
- [ ] Sign out on device A does NOT sign out device B
- [ ] Onboarding completed on device A is recognized on device B (server check)
- [ ] IndexedDB cleared on one device doesn't break the other

### REQ-15: Error States & Recovery
- [ ] Network offline during task creation shows error and retries on reconnect
- [ ] Supabase down shows graceful error state (not white screen)
- [ ] RLS policy violation shows user-friendly message (not raw Postgres error)
- [ ] Token refresh failure redirects to sign-in cleanly
- [ ] Form validation errors are inline and specific (not generic alerts)

### REQ-16: Role-Based Access Control
- [ ] Admin can edit school name, invite users, manage integrations
- [ ] Principal can invite users but not delete the organization
- [ ] Non-admin clicking "Edit" on school name sees "Admin only" message
- [ ] Role changes propagate to RLS (e.g., promoted user gains new permissions without re-login)

### REQ-17: Data Integrity & Retention
- [ ] Captures expire after 90 days (expires_at field)
- [ ] Tasks expire after 1 year
- [ ] Deleted user's profile cascades properly (doesn't break org)
- [ ] Organization with zero members doesn't leave orphan data
- [ ] Concurrent task updates don't overwrite each other (optimistic locking or last-write-wins with timestamps)