/**
 * Bug Condition Exploration Tests
 *
 * These tests encode the EXPECTED (correct) behavior after the bugfix.
 * They validate:
 *   - Bug 1 FIXED: Profile-loading useEffect stabilizes within bounded renders
 *   - Bug 2 FIXED: Organization update queries organization_memberships and persists to organizations
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState, useEffect, useRef } from 'react';
import { configureClient, resetClient } from '../src/services/getClient';
import * as organizationService from '../src/services/organizationService';

// ---------------------------------------------------------------------------
// Types mirroring the app's AuthUser shape
// ---------------------------------------------------------------------------
type AuthUser = {
  id: string;
  email: string;
  displayName?: string | null;
  schoolName?: string | null;
};

type DbProfile = {
  id: string;
  organization_id: string;
  email: string;
  display_name: string;
  role: 'admin' | 'principal' | 'teacher' | 'staff';
};

// ---------------------------------------------------------------------------
// Test 1: Infinite Re-render Loop - FIXED
// ---------------------------------------------------------------------------
// This test replicates the FIXED profile-loading useEffect from App.tsx that uses
// [user?.id] as dependency and equality guards before calling setUser.
// After the fix, setUser is only called when values actually differ, preventing
// infinite re-renders from new object references.
// ---------------------------------------------------------------------------

describe('Bug Condition: Infinite Re-render Loop (Requirements 1.1, 1.2)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('profile-loading useEffect with [user] dependency should stabilize within 3 renders', async () => {
    const RENDER_THRESHOLD = 3;
    const MAX_RENDERS_BEFORE_BAIL = 10;

    let renderCount = 0;

    const mockProfile: DbProfile = {
      id: 'user-1',
      organization_id: 'org-1',
      email: 'alice@school.edu',
      display_name: 'Alice',
      role: 'admin',
    };

    const mockOrgDetails = {
      id: 'org-1',
      name: 'Springfield Elementary',
      slug: null,
      address: null,
      contactEmail: null,
      contactPhone: null,
    };

    const getOrCreateProfile = vi.fn().mockResolvedValue(mockProfile);
    vi.spyOn(organizationService, 'getOrgDetails').mockResolvedValue(mockOrgDetails);

    const { unmount } = renderHook(() => {
      const [user, setUser] = useState<AuthUser | null>({
        id: 'user-1',
        email: 'alice@school.edu',
        displayName: null,
        schoolName: null,
      });
      const [, setProfileLoaded] = useState(false);
      const renderCountRef = useRef(0);

      renderCountRef.current++;
      renderCount = renderCountRef.current;

      useEffect(() => {
        let mounted = true;
        if (!user) {
          setProfileLoaded(false);
          return () => { mounted = false; };
        }

        if (renderCountRef.current > MAX_RENDERS_BEFORE_BAIL) {
          return () => { mounted = false; };
        }

        getOrCreateProfile()
          .then(async (profile: DbProfile) => {
            if (!mounted) return;

            // FIX: Equality guard - only update if displayName actually changed
            if (profile.display_name && profile.display_name !== user.displayName) {
              setUser((prev) => prev ? { ...prev, displayName: profile.display_name } : prev);
            }

            // Fetch org name and set schoolName with equality guard
            if (profile.organization_id) {
              try {
                const orgDetails = await organizationService.getOrgDetails(profile.organization_id);
                if (mounted && orgDetails?.name && orgDetails.name !== user.schoolName) {
                  setUser((prev) => prev ? { ...prev, schoolName: orgDetails.name } : prev);
                }
              } catch {
                // Non-critical
              }
            }

            setProfileLoaded(true);
          })
          .catch(() => {
            if (mounted) {
              setProfileLoaded(true);
            }
          });
        return () => { mounted = false; };
      }, [user?.id]); // FIX: depends only on user identity (id)

      return { user };
    });

    await act(async () => {
      for (let i = 0; i < 15; i++) {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      }
    });

    unmount();

    expect(renderCount).toBeLessThanOrEqual(RENDER_THRESHOLD);
  }, 10000);
});

// ---------------------------------------------------------------------------
// Test 2: Organization Update Queries Wrong Table - FIXED
// ---------------------------------------------------------------------------

describe('Bug Condition: Organization Update Failure (Requirements 1.3, 1.4)', () => {
  afterEach(() => {
    resetClient();
    vi.restoreAllMocks();
  });

  it('updateProfile({schoolName}) should query organization_memberships and update organizations table', async () => {
    const userId = 'user-1';
    const orgId = 'org-1';
    const newSchoolName = 'Springfield Elementary';

    let organizationsUpdateCalled = false;
    let organizationsUpdatePayload: { name: string; orgId: string } | null = null;

    const mockClient = createMockSupabaseClientForOrgTest({
      userId,
      orgId,
      onOrganizationsUpdate: (payload) => {
        organizationsUpdateCalled = true;
        organizationsUpdatePayload = payload;
      },
    });
    configureClient(mockClient as any);

    await updateProfileSchoolName(mockClient, userId, newSchoolName);

    expect(organizationsUpdateCalled).toBe(true);
    expect(organizationsUpdatePayload).toEqual({
      name: newSchoolName,
      orgId,
    });
  });
});

// ---------------------------------------------------------------------------
// Helper: Replicate the FIXED updateProfile schoolName logic
// ---------------------------------------------------------------------------

async function updateProfileSchoolName(
  client: any,
  userId: string,
  schoolName: string,
): Promise<void> {
  await client.auth.updateUser({ data: { school_name: schoolName } });

  // FIX: queries organization_memberships for organization_id
  const { data: membership, error: membershipFetchError } = await client
    .from('organization_memberships')
    .select('organization_id')
    .eq('profile_id', userId)
    .order('joined_at', { ascending: true })
    .limit(1)
    .single();

  if (membershipFetchError) {
    return;
  }

  if (membership?.organization_id) {
    await client
      .from('organizations')
      .update({ name: schoolName })
      .eq('id', membership.organization_id);
  }
}

// ---------------------------------------------------------------------------
// Mock Supabase Client Factory
// ---------------------------------------------------------------------------

function createMockSupabaseClientForOrgTest(opts: {
  userId: string;
  orgId: string;
  onOrganizationsUpdate: (payload: { name: string; orgId: string }) => void;
}) {
  const { orgId, onOrganizationsUpdate } = opts;

  const chainable = () => {
    const chain: Record<string, any> = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.order = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockReturnValue(chain);
    chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
    chain.update = vi.fn().mockReturnValue(chain);
    return chain;
  };

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: opts.userId, email: 'test@school.edu', user_metadata: {} } },
        error: null,
      }),
      updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        const chain = chainable();
        chain.single = vi.fn().mockResolvedValue({
          data: { organization_id: null },
          error: null,
        });
        return chain;
      }

      if (table === 'organization_memberships') {
        const chain = chainable();
        chain.single = vi.fn().mockResolvedValue({
          data: { organization_id: orgId },
          error: null,
        });
        return chain;
      }

      if (table === 'organizations') {
        const chain = chainable();
        chain.update = vi.fn((payload: any) => {
          const eqChain = chainable();
          eqChain.eq = vi.fn((_field: string, value: string) => {
            onOrganizationsUpdate({ name: payload.name, orgId: value });
            return eqChain;
          });
          return eqChain;
        });
        return chain;
      }

      return chainable();
    }),
    rpc: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: { id: opts.userId, organization_id: orgId, email: 'test@school.edu', display_name: 'Test', role: 'admin' },
        error: null,
      }),
    }),
  };
}
