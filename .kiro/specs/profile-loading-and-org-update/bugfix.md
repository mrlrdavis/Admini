# Bugfix Requirements Document

## Introduction

This document addresses two related bugs in the profile loading and organization update flow that affect both the desktop and mobile apps:

1. **Infinite re-render loop**: The profile-loading `useEffect` in `App.tsx` depends on the entire `user` object. After fetching the profile, it calls `setUser()` with updated fields, creating a new object reference that re-triggers the same effect indefinitely, causing an infinite loop of profile fetches and re-renders.

2. **Organization ID queried from wrong table**: When updating the school/organization name via `updateProfile`, the code queries the `profiles` table for `organization_id`, but that column does not exist on `profiles` - it lives on `organization_memberships`. This causes the organization name update to silently fail (returns null) so the name is never persisted.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a signed-in user has a non-null `profile.display_name` THEN the system calls `setUser()` with a new object reference inside the profile-loading `useEffect`, which re-triggers the same effect (dependency on `[user]`), causing an infinite loop of profile fetches and state updates

1.2 WHEN a signed-in user has a non-null `profile.organization_id` and the organization has a name THEN the system calls `setUser()` with a new object reference for `schoolName`, further compounding the infinite re-render loop

1.3 WHEN a user updates their school name via `updateProfile` THEN the system queries `profiles` table for `organization_id` which does not exist on that table, resulting in a null value or query error

1.4 WHEN the `organization_id` lookup returns null (due to querying the wrong table) THEN the system skips the organization name update, so the school name is never persisted to the `organizations` table

### Expected Behavior (Correct)

2.1 WHEN a signed-in user has a non-null `profile.display_name` THEN the system SHALL only call `setUser()` if the display name differs from the current `user.displayName` value, preventing unnecessary object reference changes

2.2 WHEN a signed-in user has a non-null organization name THEN the system SHALL only call `setUser()` if the school name differs from the current `user.schoolName` value, preventing unnecessary object reference changes

2.3 WHEN the user identity changes (i.e., `user.id` changes) THEN the system SHALL re-fetch the profile; changes to other user object fields SHALL NOT re-trigger the profile fetch

2.4 WHEN a user updates their school name via `updateProfile` THEN the system SHALL query the `organization_memberships` table (filtered by `profile_id`) to retrieve the user's `organization_id`

2.5 WHEN the `organization_id` is successfully retrieved from `organization_memberships` THEN the system SHALL update the `organizations` table with the new school name

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user signs in for the first time THEN the system SHALL CONTINUE TO fetch the profile and populate display name and school name from server data

3.2 WHEN a user has no display name set (null) THEN the system SHALL CONTINUE TO leave the user state unchanged (no `setUser` call for display name)

3.3 WHEN a user has no organization membership THEN the system SHALL CONTINUE TO skip the organization name fetch without error

3.4 WHEN a user updates only their display name (without changing school name) THEN the system SHALL CONTINUE TO update only the `profiles` table and auth metadata without touching `organization_memberships` or `organizations`

3.5 WHEN a user updates their display name via `updateProfile` THEN the system SHALL CONTINUE TO update both the `profiles` table `display_name` column and `auth.users.raw_user_meta_data`

3.6 WHEN the profile fetch fails (e.g., network error) THEN the system SHALL CONTINUE TO fall back to default role and mark profile as loaded
