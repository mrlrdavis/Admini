import { useState, useEffect, useCallback } from 'react';

import {
  getOrgDetails,
  updateOrgDetails as updateOrgDetailsSvc,
  listOrgMembers,
  updateMemberRole as updateMemberRoleSvc,
  listFeatureFlags,
  toggleFeatureFlag as toggleFeatureFlagSvc,
} from '../services/organizationService';

import {
  listInvitations,
  createInvitation as createInvitationSvc,
  revokeInvitation as revokeInvitationSvc,
} from '../services/invitationService';

import type {
  OrgDetails,
  OrgDetailsForm,
  OrgMember,
  OrgFeatureFlag,
  AdminiRole,
  OrgInvitation,
} from '../types';

// ---------------------------------------------------------------------------
// Hook Return Type
// ---------------------------------------------------------------------------

export interface UseOrgDataReturn {
  /** Organization details (null while loading or on error). */
  orgDetails: OrgDetails | null;
  /** List of organization members. */
  members: OrgMember[];
  /** List of invitations. */
  invitations: OrgInvitation[];
  /** List of feature flags. */
  featureFlags: OrgFeatureFlag[];
  /** True while the initial data fetch is in progress. */
  loading: boolean;
  /** Top-level fetch error message, if any. */
  error: string | null;

  // Mutation functions
  updateOrgDetails: (form: OrgDetailsForm) => Promise<void>;
  updateMemberRole: (profileId: string, role: AdminiRole) => Promise<void>;
  createInvitation: (email: string, role: AdminiRole) => Promise<void>;
  revokeInvitation: (invitationId: string) => Promise<void>;
  toggleFeatureFlag: (flagId: string, enabled: boolean) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Custom hook that fetches and manages organization data for the Admin tab.
 *
 * Fetches org details, members, invitations, and feature flags via the service
 * layer. Provides mutation functions that update local state on success and
 * surface per-operation loading/error states via thrown errors.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */
export function useOrgData(orgId: string): UseOrgDataReturn {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const [orgDetails, setOrgDetails] = useState<OrgDetails | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [invitations, setInvitations] = useState<OrgInvitation[]>([]);
  const [featureFlags, setFeatureFlags] = useState<OrgFeatureFlag[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Initial Data Fetch
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchAll() {
      setLoading(true);
      setError(null);

      // Fetch invitations independently so they load even if org details fail
      listInvitations(orgId).then(list => {
        if (!cancelled) setInvitations(list);
      }).catch(() => {});

      try {
        const [details, memberList, , flags] = await Promise.all([
          getOrgDetails(orgId),
          listOrgMembers(orgId),
          listInvitations(orgId),
          listFeatureFlags(orgId),
        ]);

        if (cancelled) return;

        setOrgDetails(details);
        setMembers(memberList);
        setFeatureFlags(flags);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load organization data.');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchAll();

    return () => {
      cancelled = true;
    };
  }, [orgId]);

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  /**
   * Update organization details. On success, local state is updated with the
   * returned data. Throws on failure so callers can display error UI.
   * Requirement 8.5: callers should disable submit while awaiting.
   */
  const updateOrgDetails = useCallback(
    async (form: OrgDetailsForm): Promise<void> => {
      const updated = await updateOrgDetailsSvc(orgId, form);
      setOrgDetails(updated);
    },
    [orgId],
  );

  /**
   * Update a member's role. On success, the members list is updated locally.
   * Throws on failure.
   */
  const updateMemberRole = useCallback(
    async (profileId: string, role: AdminiRole): Promise<void> => {
      await updateMemberRoleSvc(orgId, profileId, role);
      setMembers((prev) =>
        prev.map((m) => (m.profileId === profileId ? { ...m, role } : m)),
      );
    },
    [orgId],
  );

  /**
   * Create an invitation. On success, the new invitation is prepended to the
   * invitations list. Throws on failure.
   */
  const createInvitation = useCallback(
    async (email: string, role: AdminiRole): Promise<void> => {
      const newInvite = await createInvitationSvc(orgId, email, role);
      setInvitations((prev) => [newInvite, ...prev]);
    },
    [orgId],
  );

  /**
   * Revoke an invitation. On success, the invitation status is updated locally.
   * Throws on failure.
   */
  const revokeInvitation = useCallback(
    async (invitationId: string): Promise<void> => {
      const revoked = await revokeInvitationSvc(invitationId);
      setInvitations((prev) =>
        prev.map((inv) => (inv.id === invitationId ? revoked : inv)),
      );
    },
    [],
  );

  /**
   * Toggle a feature flag. On success, the flag's enabled state is updated
   * locally. Throws on failure.
   */
  const toggleFeatureFlag = useCallback(
    async (flagId: string, enabled: boolean): Promise<void> => {
      await toggleFeatureFlagSvc(orgId, flagId, enabled);
      setFeatureFlags((prev) =>
        prev.map((f) => (f.id === flagId ? { ...f, enabled } : f)),
      );
    },
    [orgId],
  );

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    orgDetails,
    members,
    invitations,
    featureFlags,
    loading,
    error,
    updateOrgDetails,
    updateMemberRole,
    createInvitation,
    revokeInvitation,
    toggleFeatureFlag,
  };
}
