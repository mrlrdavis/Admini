import { useState, useEffect } from 'react';
import { useOrgData } from '../hooks/useOrgData';
import type { AdminiRole, OrgDetailsForm } from '../types';

// ---------------------------------------------------------------------------
// AdminTab
// ---------------------------------------------------------------------------
// Organization Management tab: school details, members, invitations, feature flags.
// Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 8.5, 8.6

export interface AdminTabProps {
  organizationId: string;
  /** Current user's role - used for client-side access gating (REQ-16). */
  userRole: string;
}

/**
 * Determines if an error represents a 403 authorization error.
 */
function is403Error(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('403') || msg.includes('insufficient') || msg.includes('permission')) {
      return true;
    }
    const code = (err as { code?: string }).code;
    if (code === '403' || code === 'PGRST301') {
      return true;
    }
  }
  return false;
}

/**
 * Extract a user-friendly error message from an error.
 */
function getErrorMessage(err: unknown): string {
  if (is403Error(err)) {
    return 'Insufficient permissions';
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'An unexpected error occurred';
}

export function AdminTab({ organizationId, userRole }: AdminTabProps) {
  const {
    orgDetails,
    members,
    invitations,
    featureFlags,
    loading,
    error,
    updateOrgDetails,
    updateMemberRole,
    createInvitation,
    toggleFeatureFlag,
  } = useOrgData(organizationId);

  // Role-based access: only admin/principal can manage invitations (REQ-16)
  const canManageInvitations = userRole === 'admin' || userRole === 'principal';

  // -------------------------------------------------------------------------
  // School Details Form State
  // -------------------------------------------------------------------------
  const [detailsForm, setDetailsForm] = useState<OrgDetailsForm>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Populate form when org details are loaded
  useEffect(() => {
    if (orgDetails) {
      setDetailsForm({
        name: orgDetails.name,
        address: orgDetails.address ?? '',
        contactEmail: orgDetails.contactEmail ?? '',
        contactPhone: orgDetails.contactPhone ?? '',
      });
    }
  }, [orgDetails]);

  // -------------------------------------------------------------------------
  // Invitation Form State
  // -------------------------------------------------------------------------
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<AdminiRole>('staff');
  const [inviteSaving, setInviteSaving] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Member Role Change State
  // -------------------------------------------------------------------------
  const [roleChanging, setRoleChanging] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Feature Flag Toggle State
  // -------------------------------------------------------------------------
  const [flagToggling, setFlagToggling] = useState<string | null>(null);
  const [flagError, setFlagError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Separate invitation fetch that works even when org details fail
  const [persistedInvitations, setPersistedInvitations] = useState<typeof invitations>([]);
  useEffect(() => {
    if (invitations.length > 0) {
      setPersistedInvitations(invitations);
    } else if (organizationId) {
      import('../services/invitationService').then(mod => {
        mod.listInvitations(organizationId).then(setPersistedInvitations).catch(() => {});
      });
    }
  }, [invitations, organizationId]);

  // Handlers
  // -------------------------------------------------------------------------

  async function handleDetailsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      await updateOrgDetails(detailsForm);
      setSaveSuccess(true);
    } catch (err) {
      // Preserve form state on failure (Req 6.3)
      setSaveError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    if (!canManageInvitations) return;

    setInviteSaving(true);
    setInviteError(null);

    try {
      await createInvitation(inviteEmail.trim(), inviteRole);
      // Clear form on success
      setInviteEmail('');
      setInviteRole('staff');
    } catch (err) {
      // Preserve form state on failure (Req 6.3)
      setInviteError(getErrorMessage(err));
    } finally {
      setInviteSaving(false);
    }
  }

  async function handleRoleChange(profileId: string, newRole: AdminiRole) {
    setRoleChanging(profileId);
    setRoleError(null);

    try {
      await updateMemberRole(profileId, newRole);
    } catch (err) {
      setRoleError(getErrorMessage(err));
    } finally {
      setRoleChanging(null);
    }
  }

  async function handleFlagToggle(flagId: string, enabled: boolean) {
    setFlagToggling(flagId);
    setFlagError(null);

    try {
      await toggleFeatureFlag(flagId, enabled);
    } catch (err) {
      setFlagError(getErrorMessage(err));
    } finally {
      setFlagToggling(null);
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="admin-tab admin-tab--loading">
        <p>Loading organization data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-tab">
        <h1 className="admin-tab__title">Admin</h1>

        {/* Invite Staff */}
        <section className="admin-tab__section" aria-labelledby="invite-heading">
          <h2 id="invite-heading" className="admin-tab__section-title">Invite Staff</h2>
          <p className="admin-tab__section-desc">Send invitations to build your team. Track who has joined and manage permissions.</p>
          <form className="admin-tab__form admin-tab__invite-form" onSubmit={handleInviteSubmit}>
            <label className="admin-tab__field">
              <span className="admin-tab__field-label">Email</span>
              <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="staff@school.edu" className="admin-tab__input" required />
            </label>
            <label className="admin-tab__field">
              <span className="admin-tab__field-label">Role</span>
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as any)} className="admin-tab__role-select">
                <option value="admin">Admin</option>
                <option value="principal">Principal</option>
                <option value="teacher">Teacher</option>
                <option value="staff">Staff</option>
              </select>
            </label>
            {inviteError && <p className="admin-tab__error-message" role="alert">{inviteError}</p>}
            <button type="submit" className="admin-tab__submit" disabled={inviteSaving}>{inviteSaving ? 'Sending...' : 'Send Invitation'}</button>
          </form>
        </section>

        {/* Staff Roster */}
        <section className="admin-tab__section" aria-labelledby="roster-heading">
          <h2 id="roster-heading" className="admin-tab__section-title">Staff Roster</h2>
          <p className="admin-tab__section-desc">Team members who have accepted invitations appear here.</p>
          {members.length === 0 ? (
            <p className="admin-tab__empty">No team members yet. Invite staff above to get started.</p>
          ) : (
            <ul className="admin-tab__member-list">
              {members.map((member) => (
                <li key={member.profileId} className="admin-tab__member-item">
                  <div className="admin-tab__member-info">
                    <span className="admin-tab__member-name">{member.displayName}</span>
                    <span className="admin-tab__member-email">{member.email}</span>
                  </div>
                  <select className="admin-tab__role-select" value={member.role} onChange={(e) => handleRoleChange(member.profileId, e.target.value as any)} aria-label={'Role for ' + member.displayName}>
                    <option value="admin">Admin</option>
                    <option value="principal">Principal</option>
                    <option value="teacher">Teacher</option>
                    <option value="staff">Staff</option>
                  </select>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Pending Invitations */}
        <section className="admin-tab__section">
          <h2 className="admin-tab__section-title">Pending Invitations</h2>
          {persistedInvitations.filter((inv: any) => inv.status === 'pending').length === 0 ? (
            <p className="admin-tab__empty">No pending invitations.</p>
          ) : (
            <ul className="admin-tab__invitation-list">
              {invitations.filter((inv: any) => inv.status === 'pending').map(inv => (
                <li key={inv.id} className="admin-tab__invitation-item">
                  <span className="admin-tab__invitation-email">{inv.email}</span>
                  <span className="admin-tab__invitation-role">{inv.role}</span>
                  <span className="admin-tab__invitation-status">Sent</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  }

  const roleLabel = (name: string) => 'Role for ' + name;

  return (
    <div className="admin-tab">
      <h1 className="admin-tab__title">Organization Management</h1>

      {/* School Details Section */}
      <section className="admin-tab__section" aria-labelledby="school-details-heading">
        <h2 id="school-details-heading" className="admin-tab__section-title">
          School Details
        </h2>

        <form className="admin-tab__form" onSubmit={handleDetailsSubmit}>
          <label className="admin-tab__field">
            <span className="admin-tab__field-label">School Name</span>
            <input
              type="text"
              value={detailsForm.name ?? ''}
              onChange={(e) =>
                setDetailsForm((prev) => ({ ...prev, name: e.target.value }))
              }
              className="admin-tab__input"
            />
          </label>

          <label className="admin-tab__field">
            <span className="admin-tab__field-label">Address</span>
            <input
              type="text"
              value={detailsForm.address ?? ''}
              onChange={(e) =>
                setDetailsForm((prev) => ({ ...prev, address: e.target.value }))
              }
              className="admin-tab__input"
            />
          </label>

          <label className="admin-tab__field">
            <span className="admin-tab__field-label">Contact Email</span>
            <input
              type="email"
              value={detailsForm.contactEmail ?? ''}
              onChange={(e) =>
                setDetailsForm((prev) => ({ ...prev, contactEmail: e.target.value }))
              }
              className="admin-tab__input"
            />
          </label>

          <label className="admin-tab__field">
            <span className="admin-tab__field-label">Contact Phone</span>
            <input
              type="tel"
              value={detailsForm.contactPhone ?? ''}
              onChange={(e) =>
                setDetailsForm((prev) => ({ ...prev, contactPhone: e.target.value }))
              }
              className="admin-tab__input"
            />
          </label>

          {saveError && (
            <p className="admin-tab__error-message" role="alert">
              {saveError}
            </p>
          )}
          {saveSuccess && (
            <p className="admin-tab__success-message" role="status">
              School details updated successfully.
            </p>
          )}

          <button
            type="submit"
            className="admin-tab__submit"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Details'}
          </button>
        </form>
      </section>

      {/* Member List Section */}
      <section className="admin-tab__section" aria-labelledby="members-heading">
        <h2 id="members-heading" className="admin-tab__section-title">
          Members
        </h2>

        {roleError && (
          <p className="admin-tab__error-message" role="alert">
            {roleError}
          </p>
        )}

        {members.length === 0 ? (
          <p className="admin-tab__empty">No members found.</p>
        ) : (
          <ul className="admin-tab__member-list">
            {members.map((member) => (
              <li key={member.profileId} className="admin-tab__member-item">
                <div className="admin-tab__member-info">
                  <span className="admin-tab__member-name">
                    {member.displayName}
                  </span>
                  <span className="admin-tab__member-email">
                    {member.email}
                  </span>
                </div>
                <select
                  className="admin-tab__role-select"
                  value={member.role}
                  disabled={roleChanging === member.profileId}
                  onChange={(e) =>
                    handleRoleChange(
                      member.profileId,
                      e.target.value as AdminiRole
                    )
                  }
                  aria-label={roleLabel(member.displayName)}
                >
                  <option value="admin">Admin</option>
                  <option value="principal">Principal</option>
                  <option value="teacher">Teacher</option>
                  <option value="staff">Staff</option>
                </select>
                {roleChanging === member.profileId && (
                  <span className="admin-tab__loading-indicator">Updating...</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Invitations Section - restricted to admin/principal (REQ-16) */}
      <section className="admin-tab__section" aria-labelledby="invitations-heading">
        <h2 id="invitations-heading" className="admin-tab__section-title">
          Invitations
        </h2>

        {canManageInvitations ? (
          <>
            <form className="admin-tab__form admin-tab__invite-form" onSubmit={handleInviteSubmit}>
              <label className="admin-tab__field">
                <span className="admin-tab__field-label">Email</span>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="admin-tab__input"
                  required
                />
              </label>

              <label className="admin-tab__field">
                <span className="admin-tab__field-label">Role</span>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as AdminiRole)}
                  className="admin-tab__role-select"
                >
                  <option value="admin">Admin</option>
                  <option value="principal">Principal</option>
                  <option value="teacher">Teacher</option>
                  <option value="staff">Staff</option>
                </select>
              </label>

              {inviteError && (
                <p className="admin-tab__error-message" role="alert">
                  {inviteError}
                </p>
              )}

              <button
                type="submit"
                className="admin-tab__submit"
                disabled={inviteSaving}
              >
                {inviteSaving ? 'Sending...' : 'Send Invitation'}
              </button>
            </form>

            {/* Pending Invitations List */}
            {invitations.filter((inv) => inv.status === 'pending').length > 0 && (
              <>
                <h3 className="admin-tab__subsection-title">Pending Invitations</h3>
                <ul className="admin-tab__invitation-list">
                  {invitations
                    .filter((inv) => inv.status === 'pending')
                    .map((inv) => (
                      <li key={inv.id} className="admin-tab__invitation-item">
                        <span className="admin-tab__invitation-email">
                          {inv.email}
                        </span>
                        <span className="admin-tab__invitation-role">{inv.role}</span>
                        <span className="admin-tab__invitation-status">
                          {inv.status}
                        </span>
                      </li>
                    ))}
                </ul>
              </>
            )}
          </>
        ) : (
          <p className="admin-tab__restricted-notice" role="status">
            Only administrators and principals can manage invitations.
          </p>
        )}
      </section>

      {/* Feature Flags Section */}
      <section className="admin-tab__section" aria-labelledby="feature-flags-heading">
        <h2 id="feature-flags-heading" className="admin-tab__section-title">
          Feature Flags
        </h2>

        {flagError && (
          <p className="admin-tab__error-message" role="alert">
            {flagError}
          </p>
        )}

        {featureFlags.length === 0 ? (
          <p className="admin-tab__empty">No feature flags configured.</p>
        ) : (
          <ul className="admin-tab__flag-list">
            {featureFlags.map((flag) => (
              <li key={flag.id} className="admin-tab__flag-item">
                <label className="admin-tab__flag-label">
                  <input
                    type="checkbox"
                    checked={flag.enabled}
                    disabled={flagToggling === flag.id}
                    onChange={(e) =>
                      handleFlagToggle(flag.id, e.target.checked)
                    }
                    className="admin-tab__flag-toggle"
                  />
                  <span className="admin-tab__flag-key">{flag.flagKey}</span>
                </label>
                {flagToggling === flag.id && (
                  <span className="admin-tab__loading-indicator">Saving...</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Invite Team Section */}
      <section className="admin-tab__section">
        <h2 className="admin-tab__section-title">Invite Team Members</h2>
        <p className="admin-tab__section-desc">
          Send an invitation email to add staff to your school's AdminI workspace.
        </p>
        <a
          href="mailto:ladariusdvs99@gmail.com?subject=AdminI%20Team%20Invitation%20Request&body=I%27d%20like%20to%20invite%20the%20following%20people%20to%20my%20AdminI%20workspace%3A%0A%0AName%3A%20%0AEmail%3A%20%0ARole%20(admin%2C%20principal%2C%20teacher%2C%20staff)%3A%20%0A%0ASchool%3A%20%0A"
          className="admin-tab__invite-btn"
        >
          Invite via Email
        </a>
      </section>
    </div>
  );
}
