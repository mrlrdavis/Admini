# Bugfix Requirements Document

## Introduction

Multiple interrelated bugs prevent users from editing their profile information after initial signup, cause Google OAuth users to potentially skip the onboarding wizard, and fail to pre-fill organization data for invited users. These defects reduce the usability of the Settings panel and compromise the first-run experience for OAuth and invited users.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user clicks an "Edit" button next to profile fields (display name, school name) in Settings THEN the system opens a drawer that only states data is "managed through signup and setup" and provides no input fields to change the values

1.2 WHEN a user signs in for the first time via Google OAuth AND the `handle_new_user` trigger has already created a profile row THEN the system reads `onboarding_complete_{userId}` from IndexedDB as undefined (falsy) but `ensure_user_profile()` already created an organization using default metadata, making the onboarding wizard's school-name and role selections disconnected from the already-created org

1.3 WHEN a user signs in for the first time via Google OAuth on a different device or cleared browser THEN the system has no IndexedDB record of `onboarding_complete_{userId}` yet the profile and org already exist server-side, causing the onboarding wizard to show but its selections (role, focus, systems) are never persisted to the server

1.4 WHEN an invited user accepts an invitation and signs up THEN the system does not pre-fill the school name field in the onboarding wizard from the inviting organization's name

1.5 WHEN a user updates their display name or school name via a future edit mechanism THEN the system has no function to propagate changes back to Supabase `auth.users.raw_user_meta_data` or to the `profiles` table

1.6 WHEN a user completes the onboarding wizard and the role selection is "School leader" THEN the system stores the answer only in IndexedDB and does not update the `organization_memberships.role` to reflect the chosen role

### Expected Behavior (Correct)

2.1 WHEN a user clicks an "Edit" button next to profile fields in Settings THEN the system SHALL open a drawer containing editable input fields pre-populated with current values and a Save button that persists changes to the `profiles` table and `auth.users.raw_user_meta_data`

2.2 WHEN a user signs in for the first time via Google OAuth AND the `handle_new_user` trigger has already created a profile row THEN the system SHALL still present the onboarding wizard and SHALL use the wizard selections to update the server-side organization name, membership role, and integration preferences

2.3 WHEN a user signs in via Google OAuth on a new device where IndexedDB has no `onboarding_complete_{userId}` record THEN the system SHALL check the server for existing onboarding state (e.g., whether role/focus metadata exists on the profile or membership) and skip the wizard only if onboarding was previously completed

2.4 WHEN an invited user accepts an invitation and begins the onboarding wizard THEN the system SHALL pre-fill the school name field with the organization name from the invitation's associated organization

2.5 WHEN a user updates their display name or school name via the Settings edit drawer THEN the system SHALL update both the `profiles` table (`display_name`) and `auth.users.raw_user_meta_data` so that changes are reflected across sessions and devices

2.6 WHEN a user completes the onboarding wizard and selects a role THEN the system SHALL update the `organization_memberships.role` column for the user's current membership to match the selected role mapping

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user signs up with email/password and provides display name and school name during signup THEN the system SHALL CONTINUE TO store those values in `auth.users.raw_user_meta_data` and create the profile row via the `handle_new_user` trigger

3.2 WHEN a user who has already completed onboarding signs in again THEN the system SHALL CONTINUE TO skip the onboarding wizard and proceed directly to the workspace

3.3 WHEN a user without an invitation signs up and goes through onboarding THEN the system SHALL CONTINUE TO create a new organization using the school name from `user_metadata` via `ensure_user_profile()`

3.4 WHEN an admin invites another user via `create_invitation()` THEN the system SHALL CONTINUE TO generate a token, store the invitation, and allow acceptance via `accept_invitation(token)`

3.5 WHEN `accept_invitation` is called with a valid token THEN the system SHALL CONTINUE TO create an `organization_memberships` row linking the user to the inviting organization with the specified role

3.6 WHEN the Settings panel displays profile information (name, school, email, role) THEN the system SHALL CONTINUE TO render those values from the current user profile data

3.7 WHEN a user clicks "Delete Account" in Settings THEN the system SHALL CONTINUE TO clear local IndexedDB state, sign out, and return the user to the auth screen
