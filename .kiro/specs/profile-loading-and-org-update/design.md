# Profile Loading and Organization Update Bugfix Design

## Overview

This design addresses two interconnected bugs in the profile-loading and organization-update flow:

1. **Infinite re-render loop**: The profile-loading `useEffect` in both `apps/desktop/src/App.tsx` and `apps/mobile/src/App.tsx` uses `[user]` as its dependency array. Inside the effect, `setUser()` is called with a new object reference (spreading `prev` with updated `displayName` or `schoolName`), which changes the `user` state, re-triggering the same effect infinitely.

2. **Wrong table for organization_id lookup**: The `updateProfile` function in `apps/desktop/src/supabase.ts`, `apps/mobile/src/supabase.ts`, and `packages/workspace/src/components/IframeFallback.tsx` queries `profiles.organization_id` to find the user's organization. However, the `profiles` table does not contain an `organization_id` column — that data lives on `organization_memberships`. The query either errors or returns null, silently skipping the organization name update.

The fix is minimal and targeted: stabilize the useEffect dependency to `user?.id`, add equality guards before calling `setUser`, and switch the organization_id lookup to the `organization_memberships` table.

## Glossary

- **Bug_Condition (C)**: Two conditions that trigger the bugs: (1) the profile-loading useEffect fires and calls `setUser` with a new object reference when values haven't changed, and (2) `updateProfile` queries `profiles` for `organization_id` which doesn't exist on that table
- **Property (P)**: (1) The useEffect should only re-fire when user identity (`user.id`) changes, not when display fields are updated. (2) The organization_id lookup should query `organization_memberships` and successfully persist the school name.
- **Preservation**: All existing behaviors for first-time sign-in, display-name-only updates, auth metadata updates, mouse/keyboard interactions, and users without organization memberships must remain unchanged.
- **profile-loading useEffect**: The `useEffect` hook in `App.tsx` (both desktop and mobile) that calls `getOrCreateProfile()` and populates local state with server data.
- **updateProfile**: The async function in `supabase.ts` (desktop, mobile) and `IframeFallback.tsx` that persists display name and school name changes to the database.
- **organization_memberships**: The Supabase table that stores the relationship between users (profiles) and organizations, including `profile_id`, `organization_id`, `role`, and `joined_at`.

## Bug Details

### Bug Condition

The bug manifests in two scenarios:

**Bug 1 (Infinite Loop):** When a signed-in user has a non-null `profile.display_name` or `profile.organization_id` with a valid organization name, the profile-loading useEffect calls `setUser(prev => ({...prev, displayName: ...}))`. This creates a new object reference for `user`, which re-triggers the effect (dependency: `[user]`), creating an infinite fetch-and-update cycle.

**Bug 2 (Wrong Table):** When `updateProfile` is called with a `schoolName` value, it queries `profiles` table for `organization_id`. Since `profiles` does not have that column (it lives on `organization_memberships`), the query returns null or errors, and the organization name update is skipped.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { user: AuthUser, profile: DbProfile, action: 'effect-rerun' | 'org-update' }
  OUTPUT: boolean

  IF input.action == 'effect-rerun' THEN
    RETURN input.user IS NOT NULL
           AND (input.profile.display_name IS NOT NULL OR input.profile.organization_id IS NOT NULL)
           AND useEffectDependency == [user]  // entire object reference
           AND setUser creates new object reference
  END IF

  IF input.action == 'org-update' THEN
    RETURN input.schoolName IS NOT NULL
           AND queryTarget == 'profiles'  // wrong table
           AND 'organization_id' NOT IN columns('profiles')
  END IF

  RETURN FALSE
END FUNCTION
```

### Examples

- **Infinite loop**: User signs in → `getOrCreateProfile()` returns `{display_name: "Alice"}` → `setUser({...prev, displayName: "Alice"})` → new user reference → effect re-fires → fetches profile again → `setUser` again → infinite loop
- **School name not saved**: User clicks "Save" on school name "Springfield Elementary" → `updateProfile({schoolName: "Springfield Elementary"})` → queries `profiles.organization_id` → returns null → skips `organizations.update()` → school name silently lost
- **Combined**: On first load with display name + org, the infinite loop fires the profile fetch hundreds of times per second, also repeatedly failing to look up org correctly
- **Edge case (correct behavior)**: User with no display name set → `profile.display_name` is null → `setUser` is not called → no re-trigger (this path is already safe)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- First-time sign-in profile population must still work (when values genuinely differ from current state)
- Users with no display name (null) must not trigger any `setUser` call for display name
- Users with no organization membership must skip org name fetch without error
- Display-name-only updates via `updateProfile` must still update `profiles.display_name` and auth metadata without touching organizations
- Auth metadata updates (`raw_user_meta_data`) must continue to be persisted for both display name and school name
- Profile fetch failures must still fall back to default role and mark profile as loaded

**Scope:**
All inputs that do NOT trigger the bug conditions should be completely unaffected by this fix. This includes:
- Sign-in/sign-out flows
- Onboarding wizard completion
- Task CRUD operations
- Integration catalog browsing
- Session re-validation on visibility change
- Invitation acceptance flow

## Hypothesized Root Cause

Based on the code analysis, the confirmed root causes are:

1. **Unstable useEffect Dependency (Infinite Loop)**:
   - The profile-loading `useEffect` in both `App.tsx` files uses `[user]` as the dependency array
   - Inside the effect, `setUser((prev) => prev ? { ...prev, displayName: profile.display_name } : prev)` creates a new object reference
   - React's shallow comparison sees the new reference as a change, re-running the effect
   - This creates: fetch → setUser → new ref → re-fetch → setUser → new ref → ∞
   - The same happens for `schoolName` when `orgDetails?.name` is fetched

2. **Wrong Table Query (Organization Update)**:
   - In `updateProfile()` (desktop and mobile `supabase.ts`) and `IframeFallback.tsx`, the code does:
     ```ts
     .from('profiles').select('organization_id').eq('id', user.id).single()
     ```
   - The `profiles` table schema does not include `organization_id` — that column exists on `organization_memberships`
   - The `ensure_user_profile` RPC joins the tables to return `organization_id`, but direct queries on `profiles` don't have it
   - Result: query returns null for `organization_id`, so the subsequent `organizations.update()` is skipped

3. **No Equality Guard Before setUser**:
   - Even with the dependency fix (`[user?.id]`), there's no guard preventing `setUser` from being called when the fetched value already matches local state
   - Without a guard, the first time the effect runs it will call `setUser`, which won't re-trigger the effect (since `id` hasn't changed), but creates an unnecessary re-render

## Correctness Properties

Property 1: Bug Condition - Infinite Re-render Loop Eliminated

_For any_ signed-in user where `getOrCreateProfile()` returns a profile with non-null `display_name` or a valid `organization_id` with a non-null organization name, the profile-loading useEffect SHALL execute at most twice (initial run + one stabilization if values differ), and SHALL NOT create an infinite cycle of state updates and effect re-executions.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Bug Condition - Organization Name Update Persists

_For any_ call to `updateProfile({ schoolName })` where the user has at least one record in `organization_memberships`, the function SHALL query `organization_memberships` (filtered by `profile_id`, ordered by `joined_at` ascending, limit 1) to retrieve the `organization_id`, and SHALL successfully update the `organizations` table with the new name.

**Validates: Requirements 2.4, 2.5**

Property 3: Preservation - Non-Identity State Changes Do Not Re-trigger Profile Fetch

_For any_ `setUser` call that updates only non-identity fields (displayName, schoolName) while `user.id` remains unchanged, the profile-loading useEffect SHALL NOT re-execute, preserving existing behavior for all other state updates and interactions.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

Property 4: Preservation - Display Name and Auth Metadata Updates Unchanged

_For any_ call to `updateProfile({ displayName })` (without schoolName), the function SHALL continue to update both `profiles.display_name` and `auth.users.raw_user_meta_data` without querying `organization_memberships` or `organizations`, preserving the existing display-name-only update path.

**Validates: Requirements 3.4, 3.5**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `apps/desktop/src/App.tsx`

**Function**: Profile-loading `useEffect` (line ~163)

**Specific Changes**:
1. **Change dependency array from `[user]` to `[user?.id]`**: This ensures the effect only re-runs when user identity changes (sign-in/sign-out), not when display fields are updated.
2. **Add equality guard for displayName**: Before calling `setUser` for display name, compare `profile.display_name` against the current `user.displayName`. Skip if equal.
3. **Add equality guard for schoolName**: Before calling `setUser` for school name, compare `orgDetails.name` against the current `user.schoolName`. Skip if equal.

---

**File**: `apps/mobile/src/App.tsx`

**Function**: Profile-loading `useEffect` (mirrors desktop)

**Specific Changes**:
1. **Change dependency array from `[user]` to `[user?.id]`**: Same as desktop.
2. **Add equality guard for displayName**: Same comparison logic as desktop.
3. **Add equality guard for schoolName**: Same comparison logic as desktop.

---

**File**: `apps/desktop/src/supabase.ts`

**Function**: `updateProfile` (line ~260)

**Specific Changes**:
1. **Replace profiles query with organization_memberships query**: Change `.from('profiles').select('organization_id')` to `.from('organization_memberships').select('organization_id')`.
2. **Filter by profile_id instead of id**: Use `.eq('profile_id', user.id)` since that's the foreign key on `organization_memberships`.
3. **Order by joined_at ascending and limit to 1**: Use `.order('joined_at', { ascending: true }).limit(1).single()` to select the user's primary (oldest) membership.
4. **Handle no-rows gracefully**: If the query returns no data (user has no membership), skip the organization update without error.

---

**File**: `apps/mobile/src/supabase.ts`

**Function**: `updateProfile` (line ~260)

**Specific Changes**:
1. **Same organization_memberships fix as desktop**: Replace profiles query with organization_memberships query, filter by `profile_id`, order by `joined_at`, limit 1.

---

**File**: `packages/workspace/src/components/IframeFallback.tsx`

**Function**: `updateProfile` (local function, line ~97)

**Specific Changes**:
1. **Replace profiles query with organization_memberships query**: Change `.from('profiles').select('organization_id')` to `.from('organization_memberships').select('organization_id')`.
2. **Filter by profile_id**: Use `.eq('profile_id', userId)` instead of `.eq('id', userId)`.
3. **Order by joined_at ascending and limit to 1**: Consistent with the other two locations.
4. **Handle no-rows gracefully**: If no membership exists, skip org update without throwing.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bugs on unfixed code, then verify the fixes work correctly and preserve existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate both bugs BEFORE implementing the fix. Confirm the root cause analysis.

**Test Plan**: Write tests that simulate the profile-loading effect with mock Supabase responses and observe the re-render count. For the org update bug, write tests that call `updateProfile({schoolName: "X"})` and verify whether the organizations table is updated.

**Test Cases**:
1. **Infinite Loop Test**: Mock `getOrCreateProfile` to return `{display_name: "Alice", organization_id: "org-1"}`, mount the App component, observe that the effect fires continuously (will fail on unfixed code — render count exceeds threshold)
2. **Organization Update Test**: Call `updateProfile({schoolName: "New School"})` with a user who has an `organization_memberships` record, assert that `organizations.update` is called (will fail on unfixed code — query returns null)
3. **Stability Test**: After profile load, count re-renders over 1 second. Expect bounded count. (will fail on unfixed code — unbounded renders)
4. **SchoolName Persistence Test**: After `updateProfile({schoolName: "X"})`, query `organizations` table to verify name was updated (will fail on unfixed code — name unchanged)

**Expected Counterexamples**:
- Render count grows unboundedly (infinite loop confirmed)
- `organizations.update` is never called because `profiles.organization_id` returns null
- Possible cause confirmed: wrong dependency array + wrong table query

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) AND input.action == 'effect-rerun' DO
  renderCount := mountAppAndCountRenders(input.user, input.profile, duration=1s)
  ASSERT renderCount <= 3  // initial + one stabilization + final
END FOR

FOR ALL input WHERE isBugCondition(input) AND input.action == 'org-update' DO
  result := updateProfile_fixed({schoolName: input.schoolName})
  ASSERT result.success == true
  ASSERT organizations.get(input.orgId).name == input.schoolName
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT updateProfile_original(input) = updateProfile_fixed(input)
END FOR

FOR ALL user WHERE user.displayName == null DO
  ASSERT setUser is NOT called for displayName (same as original)
END FOR

FOR ALL user WHERE user has no organization_memberships DO
  ASSERT org update is skipped without error (same as original)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many combinations of user state (null/non-null display names, with/without memberships)
- It catches edge cases like empty strings vs null, multiple memberships, concurrent updates
- It provides strong guarantees that the display-name-only update path remains untouched

**Test Plan**: Observe behavior on UNFIXED code first for non-buggy inputs (null display names, display-name-only updates, no-membership users), then write property-based tests capturing that behavior.

**Test Cases**:
1. **Null Display Name Preservation**: Verify that users with null display_name do not trigger setUser, same behavior before and after fix
2. **Display-Name-Only Update Preservation**: Verify `updateProfile({displayName: "X"})` still updates profiles + auth metadata without touching org tables
3. **No-Membership User Preservation**: Verify users without organization_memberships records skip org update gracefully in both old and new code
4. **Auth Metadata Preservation**: Verify both display_name and school_name continue to be written to `auth.users.raw_user_meta_data`

### Unit Tests

- Test that profile-loading useEffect with `[user?.id]` dependency only fires on identity change
- Test equality guard logic: `setUser` not called when `profile.display_name === user.displayName`
- Test equality guard logic: `setUser` not called when `orgDetails.name === user.schoolName`
- Test `updateProfile` queries `organization_memberships` not `profiles` for `organization_id`
- Test `updateProfile` handles no membership rows gracefully (returns success, no org update)
- Test `updateProfile` with valid membership persists school name to `organizations` table

### Property-Based Tests

- Generate random user states (with/without displayName, with/without schoolName, with/without memberships) and verify the profile-loading effect stabilizes within bounded renders
- Generate random `UpdateProfileInput` combinations and verify preservation of the display-name-only path (no org queries when schoolName is undefined)
- Generate random membership configurations (0, 1, or multiple memberships) and verify the oldest membership is selected and updated correctly

### Integration Tests

- Test full sign-in flow → profile load → verify no infinite loop and correct field population
- Test school name update end-to-end: UI action → `updateProfile` → verify `organizations` table updated
- Test that the IframeFallback `profile:update` message bridge correctly persists school name via the fixed query
- Test sign-out → sign-in with different user → verify profile-loading effect fires exactly once for new identity
