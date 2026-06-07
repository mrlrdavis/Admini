# Implementation Plan: Profile Loading and Organization Update Bugfix

## Overview

This task list follows the exploratory bugfix workflow to fix two interconnected bugs:
1. **Infinite re-render loop** in profile-loading useEffect (both desktop and mobile App.tsx)
2. **Wrong table query** for organization_id in updateProfile (desktop/mobile supabase.ts and IframeFallback.tsx)

The approach is: explore the bug with tests first, preserve existing behavior, implement the fix, then validate.

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Infinite Re-render Loop and Organization Update Failure
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate both bugs exist
  - **Scoped PBT Approach**: Scope properties to concrete failing cases:
    - Bug 1: Profile-loading useEffect with `[user]` dependency fires infinitely when `setUser` creates new object reference after profile fetch returns non-null `display_name` or valid organization name
    - Bug 2: `updateProfile({schoolName: "X"})` queries `profiles` table for `organization_id` which doesn't exist, returns null, skips org update
  - Test 1 (Infinite Loop): Mock `getOrCreateProfile` returning `{display_name: "Alice", organization_id: "org-1"}`, mount component, assert render count stays bounded (at most 3 renders within 1 second)
  - Test 2 (Org Update): Call `updateProfile({schoolName: "Springfield Elementary"})` with a user who has an `organization_memberships` record, assert `organizations.update` is called with the correct organization_id and new name
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (render count exceeds threshold / organizations.update never called)
  - Document counterexamples: render count grows unboundedly; `profiles.organization_id` returns null so org update is skipped
  - Mark task complete when tests are written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing Profile Loading and Update Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe on UNFIXED code for non-buggy inputs:
    - Users with null `display_name` - `setUser` is NOT called for displayName
    - Users with no `organization_memberships` - org name fetch is skipped without error
    - `updateProfile({displayName: "X"})` (no schoolName) - updates `profiles.display_name` and `auth.users.raw_user_meta_data` without touching `organization_memberships` or `organizations`
    - Profile fetch failure (network error) - falls back to default role and marks profile as loaded
  - Write property-based tests capturing observed behavior patterns:
    - Generate random user states with null displayName - verify setUser never called for displayName
    - Generate random users with no organization_memberships - verify org update skipped gracefully (no error thrown)
    - Generate random `updateProfile({displayName})` calls (without schoolName) - verify only profiles + auth metadata updated, no org queries made
    - Generate random auth metadata payloads - verify `raw_user_meta_data` continues to be persisted for both displayName and schoolName fields
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3. Fix for infinite re-render loop and organization update failure

  - [x] 3.1 Change useEffect dependency from `[user]` to `[user?.id]` in desktop App.tsx
    - In `apps/desktop/src/App.tsx`, locate the profile-loading useEffect
    - Change the dependency array from `[user]` to `[user?.id]`
    - This ensures the effect only re-runs on identity change (sign-in/sign-out), not on display field updates
    - _Bug_Condition: isBugCondition(input) where useEffectDependency == [user] AND setUser creates new object reference_
    - _Expected_Behavior: useEffect fires at most twice (initial + one stabilization) per identity change_
    - _Preservation: First-time sign-in population, sign-out reset to default role still work_
    - _Requirements: 2.3_

  - [x] 3.2 Add equality guard for displayName before setUser in desktop App.tsx
    - Before calling `setUser` for display name, compare `profile.display_name` against current `user.displayName`
    - If values are equal (strict equality), skip the `setUser` call entirely
    - If values differ, call `setUser` exactly once with the updated displayName
    - _Bug_Condition: setUser called unconditionally creating new reference each time_
    - _Expected_Behavior: setUser only called when profile.display_name !== user.displayName_
    - _Preservation: Users with null display_name still skip setUser (unchanged)_
    - _Requirements: 2.1_

  - [x] 3.3 Add equality guard for schoolName before setUser in desktop App.tsx
    - Before calling `setUser` for school name, compare fetched `orgDetails.name` against current `user.schoolName`
    - If values are equal, skip the `setUser` call
    - If fetched org name is null/undefined, skip the `setUser` call
    - If values differ, call `setUser` exactly once with the new schoolName
    - _Bug_Condition: setUser called unconditionally for schoolName creating new reference_
    - _Expected_Behavior: setUser only called when orgDetails.name !== user.schoolName AND orgDetails.name is not null_
    - _Preservation: Users with no org membership still skip org name fetch without error_
    - _Requirements: 2.2_

  - [x] 3.4 Apply same useEffect and equality guard fixes to mobile App.tsx
    - In `apps/mobile/src/App.tsx`, apply identical changes:
      - Change dependency array from `[user]` to `[user?.id]`
      - Add equality guard for displayName before setUser
      - Add equality guard for schoolName before setUser
    - _Bug_Condition: Same infinite loop bug exists in mobile App.tsx_
    - _Expected_Behavior: Mobile profile-loading effect stabilizes within bounded renders_
    - _Preservation: Mobile sign-out resets to default role (staff) correctly_
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.5 Fix organization_id query in desktop supabase.ts
    - In `apps/desktop/src/supabase.ts`, locate the `updateProfile` function
    - Replace `.from('profiles').select('organization_id').eq('id', user.id).single()` with `.from('organization_memberships').select('organization_id').eq('profile_id', user.id).order('joined_at', { ascending: true }).limit(1).single()`
    - If no rows returned (user has no membership), skip org update without error
    - When organization_id is found, update `organizations` table with new school name
    - _Bug_Condition: queryTarget == 'profiles' AND 'organization_id' NOT IN columns('profiles')_
    - _Expected_Behavior: Query organization_memberships, order by joined_at asc, limit 1, persist name to organizations_
    - _Preservation: Display-name-only updates still skip org queries entirely_
    - _Requirements: 2.4, 2.5_

  - [x] 3.6 Fix organization_id query in mobile supabase.ts
    - In `apps/mobile/src/supabase.ts`, apply the same organization_memberships query fix as desktop
    - Replace profiles query with `.from('organization_memberships').select('organization_id').eq('profile_id', user.id).order('joined_at', { ascending: true }).limit(1).single()`
    - Handle no-rows gracefully (skip org update without error)
    - _Bug_Condition: Same wrong table query in mobile supabase.ts_
    - _Expected_Behavior: Same as desktop - query correct table, persist org name_
    - _Preservation: Mobile display-name-only updates unaffected_
    - _Requirements: 2.4, 2.5_

  - [x] 3.7 Fix organization_id query in IframeFallback.tsx
    - In `packages/workspace/src/components/IframeFallback.tsx`, locate the `updateProfile` function
    - Replace `.from('profiles').select('organization_id').eq('id', userId)` with `.from('organization_memberships').select('organization_id').eq('profile_id', userId).order('joined_at', { ascending: true }).limit(1).single()`
    - Handle no-rows gracefully (skip org update without throwing)
    - _Bug_Condition: Same wrong table query in IframeFallback.tsx_
    - _Expected_Behavior: Same correct table lookup and org name persistence_
    - _Preservation: IframeFallback profile:update message bridge continues to work for display-name-only updates_
    - _Requirements: 2.4, 2.5_

  - [x] 3.8 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Infinite Re-render Loop Eliminated and Organization Update Persists
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms:
      - Profile-loading useEffect stabilizes within bounded renders (at most 3)
      - `updateProfile({schoolName})` queries `organization_memberships` and persists name to `organizations`
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms both bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.9 Verify preservation tests still pass
    - **Property 2: Preservation** - Existing Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all preservation tests still pass after fix:
      - Null displayName users: no setUser called
      - No-membership users: org update skipped gracefully
      - Display-name-only updates: only profiles + auth metadata touched
      - Auth metadata persistence: raw_user_meta_data still updated
      - Profile fetch failure: default role fallback still works

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full test suite to confirm no regressions
  - Verify exploration test (Property 1) passes on fixed code
  - Verify preservation tests (Property 2) pass on fixed code
  - Verify no other tests are broken by the changes
  - Ensure all tests pass, ask the user if questions arise

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2"] },
    { "id": 1, "tasks": ["3.1", "3.5"] },
    { "id": 2, "tasks": ["3.2", "3.6"] },
    { "id": 3, "tasks": ["3.3", "3.7"] },
    { "id": 4, "tasks": ["3.4"] },
    { "id": 5, "tasks": ["3.8", "3.9"] },
    { "id": 6, "tasks": ["4"] }
  ]
}
```

## Notes

- Tasks 1 and 2 are independent and can be worked on in parallel (wave 0)
- Tasks 3.1-3.4 (useEffect fixes) and 3.5-3.7 (org query fixes) address separate bugs and can be implemented in parallel
- The verification tasks (3.8, 3.9) must run after ALL implementation tasks are complete
- The exploration test (task 1) is expected to FAIL on unfixed code - this is correct behavior that confirms the bug exists
- The preservation tests (task 2) are expected to PASS on unfixed code - they capture existing correct behavior
- All changes span 5 files: apps/desktop/src/App.tsx, apps/mobile/src/App.tsx, apps/desktop/src/supabase.ts, apps/mobile/src/supabase.ts, packages/workspace/src/components/IframeFallback.tsx
