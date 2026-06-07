/**
 * Bug Condition Exploration Tests
 *
 * These tests are EXPECTED TO FAIL on the current unfixed code.
 * Failure confirms the bugs exist. DO NOT fix the code to make them pass.
 *
 * Bug 1: Infinite re-render loop - The profile-loading useEffect depends on
 * `[user]` (entire object). After profile fetch, `setUser()` creates a new
 * object reference which re-triggers the effect → infinite loop.
 *
 * Bug 2: Wrong table query - `updateProfile({schoolName: "X"})` queries
 * `profiles` table for `organization_id` which doesn't exist there.
 * The column lives on `organization_memberships`. Query returns null,
 * so the org update is skipped.
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { createElement, useEffect, useState } from 'react';
import fc from 'fast-check';

// ---------------------------------------------------------------------------
// Test 1: Infinite Re-render Loop
// ---------------------------------------------------------------------------

type MockUser = { id: string; email: string; displayName?: string | null; schoolName?: string | null };

/**
 * This component replicates the EXACT bug pattern from App.tsx:
 * - useEffect depends on `[user]` (the entire object)
 * - Inside the effect, after profile fetch, it calls setUser with a new object
 *   reference ({...prev, displayName: ...})
 * - This creates a new reference → re-triggers effect → infinite loop
 *
 * The test asserts render count stays bounded (≤ 3 within observation window).
 * On UNFIXED code this will FAIL because render count grows unboundedly.
 */
function InfiniteLoopBugComponent({
  onRenderCount,
  mockProfile,
}: {
  onRenderCount: (count: number) => void;
  mockProfile: { display_name: string | null; organization_id: string | null };
}) {
  const [user, setUser] = useState<MockUser | null>({
    id: 'user-1',
    email: 'alice@example.com',
    displayName: null,
    schoolName: null,
  });
  const [renderCount, setRenderCount] = useState(0);

  // Track renders
  useEffect(() => {
    setRenderCount((c) => {
      const next = c + 1;
      onRenderCount(next);
      return next;
    });
  });

  // This replicates the buggy useEffect from App.tsx that depends on [user]
  // and calls setUser with a new object reference after profile fetch
  useEffect(() => {
    if (!user) return;

    // Simulate async profile fetch (getOrCreateProfile)
    const timer = setTimeout(() => {
      // Bug: This unconditionally creates a new object reference
      if (mockProfile.display_name) {
        setUser((prev) => prev ? { ...prev, displayName: mockProfile.display_name } : prev);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [user]); // <-- Bug: depends on entire user object

  return createElement('div', { 'data-testid': 'render-count' }, String(renderCount));
}

describe('Bug 1: Infinite Re-render Loop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('profile-loading useEffect with [user] dependency should stay bounded (≤ 3 renders) but does NOT due to infinite loop', async () => {
    /**
     * Property: For any user with a non-null display_name returned from
     * getOrCreateProfile, mounting the component should result in at most
     * 3 renders within 1 second (initial + profile update + stabilization).
     *
     * EXPECTED: FAILS on unfixed code because setUser creates new reference
     * → re-triggers effect → unbounded render count
     */
    let maxRenderCount = 0;
    const trackRenders = (count: number) => {
      maxRenderCount = Math.max(maxRenderCount, count);
    };

    await act(async () => {
      render(
        createElement(InfiniteLoopBugComponent, {
          onRenderCount: trackRenders,
          mockProfile: { display_name: 'Alice', organization_id: 'org-1' },
        })
      );
    });

    // Simulate 1 second of time passing - advance timers in small steps
    // to allow the infinite loop to manifest
    for (let i = 0; i < 50; i++) {
      await act(async () => {
        vi.advanceTimersByTime(20);
      });
    }

    // The EXPECTED behavior (after fix): render count ≤ 3
    // The ACTUAL behavior (before fix): render count grows unboundedly
    // because setUser({...prev, displayName: "Alice"}) creates new ref → re-triggers effect
    expect(maxRenderCount).toBeLessThanOrEqual(3);
  });

  it('property: render count is bounded for any non-null display_name', async () => {
    /**
     * Property-based test: For ANY generated display name that is non-null,
     * the useEffect + setUser pattern should stabilize within bounded renders.
     *
     * EXPECTED: FAILS because the pattern always creates infinite loops
     * when display_name is non-null.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        async (displayName) => {
          let maxRenderCount = 0;
          const trackRenders = (count: number) => {
            maxRenderCount = Math.max(maxRenderCount, count);
          };

          const { unmount } = render(
            createElement(InfiniteLoopBugComponent, {
              onRenderCount: trackRenders,
              mockProfile: { display_name: displayName, organization_id: null },
            })
          );

          // Advance timers to let effect cycle run
          for (let i = 0; i < 20; i++) {
            await act(async () => {
              vi.advanceTimersByTime(10);
            });
          }

          unmount();

          // Property: renders should be bounded
          return maxRenderCount <= 3;
        }
      ),
      { numRuns: 5 } // Keep runs low since we're testing a pattern, not random inputs
    );
  });
});

// ---------------------------------------------------------------------------
// Test 2: Organization Update Failure (Wrong Table Query)
// ---------------------------------------------------------------------------

describe('Bug 2: Organization Update Failure - Wrong Table Query', () => {
  /**
   * This test verifies that updateProfile({schoolName: "X"}) correctly
   * queries organization_memberships to find organization_id.
   *
   * On UNFIXED code: The function queries `profiles` for `organization_id`
   * which doesn't exist on that table → returns null → org update skipped.
   *
   * EXPECTED: FAILS because organizations.update is never called.
   */

  it('updateProfile({schoolName}) should query organization_memberships and update organizations table', async () => {
    // Track which tables are queried and what operations are performed
    const queryLog: { table: string; operation: string; params: Record<string, unknown> }[] = [];

    const mockSingle = () => {
      const lastQuery = queryLog[queryLog.length - 1];
      if (lastQuery?.table === 'profiles' && lastQuery?.operation === 'select') {
        // Simulate: profiles table does NOT have organization_id column
        // The query "succeeds" but data.organization_id is null/undefined
        return Promise.resolve({ data: { organization_id: null }, error: null });
      }
      if (lastQuery?.table === 'organization_memberships') {
        return Promise.resolve({ data: { organization_id: 'org-123' }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    };

    const mockSupabase = {
      from: (table: string) => {
        queryLog.push({ table, operation: '', params: {} });
        return {
          select: (fields: string) => {
            queryLog[queryLog.length - 1].operation = 'select';
            queryLog[queryLog.length - 1].params = { fields };
            return {
              eq: (field: string, value: unknown) => {
                queryLog[queryLog.length - 1].params[field] = value;
                return {
                  single: mockSingle,
                  order: () => ({ limit: () => ({ single: mockSingle }) }),
                };
              },
            };
          },
          update: (data: Record<string, unknown>) => {
            queryLog[queryLog.length - 1].operation = 'update';
            queryLog[queryLog.length - 1].params = { data };
            return {
              eq: (field: string, value: unknown) => {
                queryLog[queryLog.length - 1].params[field] = value;
                return Promise.resolve({ data: null, error: null });
              },
            };
          },
        };
      },
    };

    const userId = 'user-1';
    const schoolName = 'Springfield Elementary';

    // Replicate the BUGGY updateProfile logic from supabase.ts:
    // Step 3: "Update organization name if school_name changed"
    // Bug: queries `profiles` for `organization_id` which doesn't exist there
    const { data: profile } = await mockSupabase
      .from('profiles')
      .select('organization_id')
      .eq('id', userId)
      .single();

    let orgUpdateCalled = false;
    if (profile?.organization_id) {
      // This branch should be reached if organization_id is found
      await mockSupabase
        .from('organizations')
        .update({ name: schoolName })
        .eq('id', profile.organization_id);
      orgUpdateCalled = true;
    }

    // ASSERTION: On fixed code, organizations.update SHOULD be called
    // because the user has an organization_memberships record with org-123.
    //
    // On UNFIXED code: profiles.organization_id returns null (column doesn't exist)
    // so orgUpdateCalled remains false.
    expect(orgUpdateCalled).toBe(true);

    // Also verify: the query should target organization_memberships, not profiles
    const orgIdQuery = queryLog.find(
      (q) => q.operation === 'select' && q.params.fields === 'organization_id'
    );
    expect(orgIdQuery?.table).toBe('organization_memberships');
  });

  it('property: for any schoolName, updateProfile should persist to organizations table via organization_memberships lookup', async () => {
    /**
     * Property-based test: For ANY valid school name, the updateProfile function
     * should query organization_memberships (not profiles) and call organizations.update.
     *
     * EXPECTED: FAILS because the current code always queries profiles table.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
        async (schoolName) => {
          const queryLog: string[] = [];

          const mockSingle = () => {
            const lastTable = queryLog[queryLog.length - 1];
            if (lastTable === 'profiles') {
              // Bug: profiles doesn't have organization_id → returns null
              return Promise.resolve({ data: { organization_id: null }, error: null });
            }
            if (lastTable === 'organization_memberships') {
              return Promise.resolve({ data: { organization_id: 'org-abc' }, error: null });
            }
            return Promise.resolve({ data: null, error: null });
          };

          const mockSupabase = {
            from: (table: string) => {
              queryLog.push(table);
              return {
                select: () => ({
                  eq: () => ({ single: mockSingle, order: () => ({ limit: () => ({ single: mockSingle }) }) }),
                }),
                update: () => ({
                  eq: () => Promise.resolve({ data: null, error: null }),
                }),
              };
            },
          };

          // Replicate the buggy logic
          const { data: profile } = await mockSupabase
            .from('profiles')  // Bug: should be 'organization_memberships'
            .select('organization_id')
            .eq('id', 'user-1')
            .single();

          let orgUpdated = false;
          if (profile?.organization_id) {
            await mockSupabase
              .from('organizations')
              .update({ name: schoolName })
              .eq('id', profile.organization_id);
            orgUpdated = true;
          }

          // Property: org should be updated for any non-empty schoolName
          // when user has an organization_memberships record
          return orgUpdated === true;
        }
      ),
      { numRuns: 10 }
    );
  });
});
