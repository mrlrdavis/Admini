import { useState, useEffect, useRef } from 'react';
import { getClassroomCourses, getClassroomStudents, getGoogleToken, type ClassroomCourse, type ClassroomStudent } from '../services/googleIntegrationService';
import { sendInvitation, getPendingInvitations, revokeInvitation as revokeInvitationSvc } from '../services/invitationService';
import { parseRosterFile, validateRosterRows, bulkAddMembers, type RosterRow, type RowError, type BulkAddResult } from '../services/rosterUploadService';
import { useOrgData } from '../hooks/useOrgData';
import type { AdminiRole, OrgDetailsForm, OrgInvitation } from '../types';

// ---------------------------------------------------------------------------
// AdminTab
// ---------------------------------------------------------------------------
// School Settings tab: school details, staff access, observation subjects, and school features.
// Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 8.5, 8.6

export interface AdminTabProps {
  organizationId: string;
  /** Current user's role - used for client-side access gating (REQ-16). */
  userRole: string;
}

// ---------------------------------------------------------------------------
// Form State Machine
// ---------------------------------------------------------------------------
type InviteFormState = 'idle' | 'validating' | 'submitting' | 'success' | 'error';
type RosterUploadState = 'idle' | 'validating' | 'previewing' | 'submitting' | 'success' | 'error';

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
    removeOrgMember,
    createInvitation,
    revokeInvitation,
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
  // Invitation Form State (state machine: idle -> validating -> submitting -> success/error)
  // -------------------------------------------------------------------------
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<AdminiRole>('staff');
  const [inviteFormState, setInviteFormState] = useState<InviteFormState>('idle');
  const [inviteError, setInviteError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Bulk staff invite upload state (state machine: idle -> validating -> previewing -> submitting -> success/error)
  // -------------------------------------------------------------------------
  const [rosterState, setRosterState] = useState<RosterUploadState>('idle');
  const [rosterPreview, setRosterPreview] = useState<RosterRow[]>([]);
  const [rosterErrors, setRosterErrors] = useState<RowError[]>([]);
  const [rosterResult, setRosterResult] = useState<BulkAddResult | null>(null);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------------------
  // Member Role Change State
  // -------------------------------------------------------------------------
  const [roleChanging, setRoleChanging] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Feature Flag Toggle State
  // -------------------------------------------------------------------------
  const [flagToggling, setFlagToggling] = useState<string | null>(null);
  const [flagError, setFlagError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Student/Staff Observation Roster State (stored in localStorage for Observations)
  // -------------------------------------------------------------------------
  const [obsRoster, setObsRoster] = useState<{ name: string; type: 'student' | 'staff'; grade?: string }[]>([]);
  const [obsRosterUploading, setObsRosterUploading] = useState(false);
  const [obsRosterError, setObsRosterError] = useState<string | null>(null);
  const [obsRosterSuccess, setObsRosterSuccess] = useState<string | null>(null);
  const obsRosterFileRef = useRef<HTMLInputElement>(null);

  // Load observation roster from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('admini_roster_full');
      if (raw) setObsRoster(JSON.parse(raw));
    } catch {}
  }, []);

  // -------------------------------------------------------------------------
  // Google Classroom roster
  // -------------------------------------------------------------------------
  const [classroomCourses, setClassroomCourses] = useState<ClassroomCourse[]>([]);
  const [classroomStudents, setClassroomStudents] = useState<ClassroomStudent[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [hasClassroom, setHasClassroom] = useState(false);

  useEffect(() => {
    getGoogleToken().then(token => {
      if (token) {
        setHasClassroom(true);
        getClassroomCourses().then(setClassroomCourses).catch(() => {});
      }
    });
  }, []);

  useEffect(() => {
    if (selectedCourseId) {
      getClassroomStudents(selectedCourseId).then(setClassroomStudents).catch(() => {});
    }
  }, [selectedCourseId]);

  // -------------------------------------------------------------------------
  // Pending invitations - fetch directly from invitationService
  // -------------------------------------------------------------------------
  const [pendingInvitations, setPendingInvitations] = useState<OrgInvitation[]>([]);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    if (organizationId) {
      getPendingInvitations(organizationId)
        .then(setPendingInvitations)
        .catch(() => {});
    }
  }, [organizationId]);

  // Sync from hook invitations as well
  useEffect(() => {
    const pending = invitations.filter(inv => inv.status === 'pending');
    if (pending.length > 0) {
      setPendingInvitations(pending);
    }
  }, [invitations]);

  // -------------------------------------------------------------------------
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

  /**
   * Invitation form handler using sendInvitation with built-in retry (max 3).
   * State machine: idle -> validating -> submitting -> success/error
   */
  async function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    if (!canManageInvitations) return;

    // Transition: idle -> validating
    setInviteFormState('validating');
    setInviteError(null);

    // Basic client-side validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail.trim())) {
      setInviteFormState('error');
      setInviteError('Please enter a valid email address.');
      return;
    }

    // Transition: validating -> submitting
    setInviteFormState('submitting');

    try {
      // sendInvitation has built-in retry logic (max 3 attempts)
      const newInvite = await sendInvitation(inviteEmail.trim(), inviteRole);
      // Transition: submitting -> success
      setInviteFormState('success');
      setInviteEmail('');
      setInviteRole('staff');
      // Update pending invitations list
      setPendingInvitations(prev => [newInvite, ...prev]);
      // Reset to idle after brief success display
      setTimeout(() => setInviteFormState('idle'), 2000);
    } catch (err) {
      // Transition: submitting -> error (preserves form state per Req 6.3)
      setInviteFormState('error');
      setInviteError(getErrorMessage(err));
    }
  }

  /**
   * Revoke a pending invitation.
   */
  async function handleRevokeInvitation(invitationId: string) {
    setRevokingId(invitationId);
    try {
      await revokeInvitationSvc(invitationId);
      setPendingInvitations(prev => prev.filter(inv => inv.id !== invitationId));
    } catch (err) {
      setInviteError(getErrorMessage(err));
    } finally {
      setRevokingId(null);
    }
  }

  /**
   * Roster upload pipeline: validate -> parse -> preview -> persist
   * State machine: idle -> validating -> previewing -> submitting -> success/error
   */
  async function handleRosterFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Transition: idle -> validating
    setRosterState('validating');
    setRosterErrors([]);
    setRosterError(null);
    setRosterResult(null);

    try {
      // Step 1: Parse the file
      const parseResult = await parseRosterFile(file);

      if (parseResult.errors.length > 0 && parseResult.rows.length === 0) {
        setRosterState('error');
        setRosterErrors(parseResult.errors);
        setRosterError('All rows contain errors. Please fix and re-upload.');
        return;
      }

      // Step 2: Validate for duplicates
      const validation = validateRosterRows(parseResult.rows);

      if (validation.errors.length > 0) {
        setRosterErrors([...parseResult.errors, ...validation.errors]);
      }

      if (validation.valid.length === 0) {
        setRosterState('error');
        setRosterError('No valid rows to import after validation.');
        return;
      }

      // Transition: validating -> previewing
      setRosterPreview(validation.valid);
      setRosterState('previewing');
    } catch (err) {
      setRosterState('error');
      setRosterError(getErrorMessage(err));
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  /**
   * Confirm roster upload - persist validated rows.
   */
  async function handleRosterConfirm() {
    if (rosterPreview.length === 0) return;

    // Transition: previewing -> submitting
    setRosterState('submitting');

    try {
      const result = await bulkAddMembers(organizationId, rosterPreview);
      setRosterResult(result);
      // Transition: submitting -> success
      setRosterState('success');
      setRosterPreview([]);
    } catch (err) {
      setRosterState('error');
      setRosterError(getErrorMessage(err));
    }
  }

  /**
   * Cancel roster upload preview.
   */
  function handleRosterCancel() {
    setRosterState('idle');
    setRosterPreview([]);
    setRosterErrors([]);
    setRosterError(null);
    setRosterResult(null);
  }

  /**
   * Handle observation roster CSV upload (students and staff for Observations feature).
   * Expected columns: name, type (student/staff), grade (optional)
   * Stored in localStorage for use in ObservationsTab.
   */
  async function handleObsRosterUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setObsRosterUploading(true);
    setObsRosterError(null);
    setObsRosterSuccess(null);

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error('File must contain a header row and at least one data row.');
      }

      // Parse header
      const header = lines[0]!.toLowerCase().split(',').map(h => h.trim());
      const nameIdx = header.findIndex(h => h === 'name');
      const typeIdx = header.findIndex(h => h === 'type' || h === 'role');
      const gradeIdx = header.findIndex(h => h === 'grade');

      if (nameIdx === -1) {
        throw new Error('Missing required column: name');
      }

      // Parse rows
      const newRoster: { name: string; type: 'student' | 'staff'; grade?: string }[] = [];
      const errors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cells = lines[i]!.split(',').map(c => c.trim());
        const name = cells[nameIdx] || '';
        const typeRaw = typeIdx >= 0 ? (cells[typeIdx] || '').toLowerCase() : 'student';
        const grade = gradeIdx >= 0 ? cells[gradeIdx] : undefined;

        if (!name) {
          errors.push('Row ' + i + ': Missing name');
          continue;
        }

        // Map role values to student/staff
        let type: 'student' | 'staff' = 'student';
        if (typeRaw === 'staff' || typeRaw === 'teacher' || typeRaw === 'admin' || typeRaw === 'principal') {
          type = 'staff';
        } else if (typeRaw === 'student' || typeRaw === '') {
          type = 'student';
        } else {
          type = 'student'; // Default unknown types to student
        }

        newRoster.push({ name, type, grade: grade || undefined });
      }

      if (newRoster.length === 0) {
        throw new Error('No valid rows found. ' + (errors.length > 0 ? errors.slice(0, 3).join('; ') : ''));
      }

      // Save to localStorage
      localStorage.setItem('admini_roster_full', JSON.stringify(newRoster));
      // Also save simple names for backward compatibility
      localStorage.setItem('admini_roster', JSON.stringify(newRoster.map(r => r.name)));
      
      setObsRoster(newRoster);
      const studentCount = newRoster.filter(r => r.type === 'student').length;
      const staffCount = newRoster.filter(r => r.type === 'staff').length;
      setObsRosterSuccess('Imported ' + studentCount + ' students and ' + staffCount + ' staff members');
      
      if (errors.length > 0) {
        setObsRosterError(errors.length + ' row(s) skipped: ' + errors.slice(0, 2).join('; '));
      }
    } catch (err) {
      setObsRosterError(err instanceof Error ? err.message : 'Failed to parse file');
    } finally {
      setObsRosterUploading(false);
      if (obsRosterFileRef.current) {
        obsRosterFileRef.current.value = '';
      }
    }
  }

  function handleClearObsRoster() {
    localStorage.removeItem('admini_roster_full');
    localStorage.removeItem('admini_roster');
    setObsRoster([]);
    setObsRosterSuccess(null);
    setObsRosterError(null);
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

  async function handleRemoveMember(profileId: string, displayName: string) {
    const confirmed = window.confirm(`Remove ${displayName} from this school? They will lose access to this workspace.`);
    if (!confirmed) return;

    setRemovingMemberId(profileId);
    setRoleError(null);

    try {
      await removeOrgMember(profileId);
    } catch (err) {
      setRoleError(getErrorMessage(err));
    } finally {
      setRemovingMemberId(null);
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
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as AdminiRole)} className="admin-tab__role-select">
                <option value="admin">Admin</option>
                <option value="principal">Principal</option>
                <option value="teacher">Teacher</option>
                <option value="staff">Staff</option>
              </select>
            </label>
            {inviteError && <p className="admin-tab__error-message" role="alert">{inviteError}</p>}
            {inviteFormState === 'success' && <p className="admin-tab__success-message" role="status">Invitation sent successfully!</p>}
            <button type="submit" className="admin-tab__submit" disabled={inviteFormState === 'submitting' || inviteFormState === 'validating'}>
              {inviteFormState === 'submitting' ? 'Sending...' : inviteFormState === 'validating' ? 'Validating...' : 'Send Invitation'}
            </button>
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
                  <select className="admin-tab__role-select" value={member.role} onChange={(e) => handleRoleChange(member.profileId, e.target.value as AdminiRole)} aria-label={'Role for ' + member.displayName}>
                    <option value="admin">Admin</option>
                    <option value="principal">Principal</option>
                    <option value="teacher">Teacher</option>
                    <option value="staff">Staff</option>
                  </select>
                  <button
                    type="button"
                    className="admin-tab__remove-member-btn"
                    disabled={removingMemberId === member.profileId || roleChanging === member.profileId}
                    onClick={() => handleRemoveMember(member.profileId, member.displayName)}
                    aria-label={`Remove ${member.displayName} from Staff Roster`}
                  >
                    {removingMemberId === member.profileId ? 'Removing...' : 'Remove'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Pending Invites */}
        <section className="admin-tab__section">
          <h2 className="admin-tab__section-title">Pending Invites</h2>
          {pendingInvitations.length === 0 ? (
            <p className="admin-tab__empty">No pending invites.</p>
          ) : (
            <ul className="admin-tab__invitation-list">
              {pendingInvitations.map(inv => (
                <li key={inv.id} className="admin-tab__invitation-item">
                  <span className="admin-tab__invitation-email">{inv.email}</span>
                  <span className="admin-tab__invitation-role">{inv.role}</span>
                  <span className="admin-tab__invitation-status">Sent</span>
                  {canManageInvitations && (
                    <button
                      type="button"
                      className="admin-tab__revoke-btn"
                      disabled={revokingId === inv.id}
                      onClick={() => handleRevokeInvitation(inv.id)}
                      aria-label={`Revoke invitation for ${inv.email}`}
                    >
                      {revokingId === inv.id ? 'Revoking...' : 'Revoke'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Bulk Staff Invites Section - also shown in error state */}
        <section className="admin-tab__section" aria-labelledby="roster-upload-error-heading">
          <h2 id="roster-upload-error-heading" className="admin-tab__section-title">
            Bulk Staff Invites
          </h2>
          <p className="admin-tab__section-desc">
            Upload staff who need Admini accounts. This sends invitations; people appear in Staff Roster after accepting. Required columns: name, email, role.
          </p>
          {rosterState === 'idle' && (
            <label className="admin-tab__field">
              <span className="admin-tab__field-label">Select roster file</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx"
                onChange={handleRosterFileChange}
                className="admin-tab__input"
              />
              <span className="admin-tab__hint">Accepted formats: .csv, .xlsx</span>
            </label>
          )}
          {rosterState === 'validating' && <p className="admin-tab__loading-indicator">Validating roster file...</p>}
          {rosterState === 'previewing' && (
            <div className="admin-tab__roster-preview">
              <h3 className="admin-tab__subsection-title">Preview ({rosterPreview.length} valid rows)</h3>
              <p className="admin-tab__confirm-warning" role="alert">
                Confirming will send Admini workspace invitations to all {rosterPreview.length} staff email address(es).
                Recipients appear in Pending Invites until they accept.
              </p>
              <ul className="admin-tab__roster-list">
                {rosterPreview.slice(0, 5).map((row) => (
                  <li key={row.rowIndex} className="admin-tab__roster-item">
                    <span>{row.name}</span> - <span>{row.email}</span> - <span>{row.role}</span>
                  </li>
                ))}
              </ul>
              <div className="admin-tab__roster-actions">
                <button type="button" className="admin-tab__submit" onClick={handleRosterConfirm}>Send Staff Invites</button>
                <button type="button" className="admin-tab__cancel-btn" onClick={handleRosterCancel}>Cancel</button>
              </div>
            </div>
          )}
          {rosterState === 'submitting' && <p className="admin-tab__loading-indicator">Sending invitations...</p>}
          {rosterState === 'success' && rosterResult && (
            <div className="admin-tab__roster-result">
              <p className="admin-tab__success-message">Sent {rosterResult.added} staff invitation(s).</p>
              <button type="button" className="admin-tab__submit" onClick={handleRosterCancel}>Upload Another Staff List</button>
            </div>
          )}
          {rosterState === 'error' && (
            <div className="admin-tab__roster-error">
              <p className="admin-tab__error-message">{rosterError}</p>
              <button type="button" className="admin-tab__submit" onClick={handleRosterCancel}>Try Again</button>
            </div>
          )}
        </section>
      </div>
    );
  }

  const roleLabel = (name: string) => 'Role for ' + name;

  return (
    <div className="admin-tab">
      <h1 className="admin-tab__title">School Settings</h1>

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

      {/* Staff Roster Section */}
      <section className="admin-tab__section" aria-labelledby="members-heading">
        <h2 id="members-heading" className="admin-tab__section-title">
          Staff Roster
        </h2>
        <p className="admin-tab__section-desc">
          Admini users who accepted an invite appear here. Use this list for workspace access, permissions, and task assignment suggestions.
        </p>

        {roleError && (
          <p className="admin-tab__error-message" role="alert">
            {roleError}
          </p>
        )}

        {members.length === 0 ? (
          <p className="admin-tab__empty">No staff have joined yet. Send a staff invite below to add team members.</p>
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
                <button
                  type="button"
                  className="admin-tab__remove-member-btn"
                  disabled={removingMemberId === member.profileId || roleChanging === member.profileId}
                  onClick={() => handleRemoveMember(member.profileId, member.displayName)}
                  aria-label={`Remove ${member.displayName} from Staff Roster`}
                >
                  {removingMemberId === member.profileId ? 'Removing...' : 'Remove'}
                </button>
                {roleChanging === member.profileId && (
                  <span className="admin-tab__loading-indicator">Updating...</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Bulk Staff Invites Section */}
      <section className="admin-tab__section" aria-labelledby="bulk-staff-invites-heading">
        <div className="admin-tab__section-header">
          <div>
            <h2 id="bulk-staff-invites-heading" className="admin-tab__section-title">
              Bulk Staff Invites
            </h2>
            <p className="admin-tab__section-desc">
              Upload staff who need Admini accounts. This sends invitations; people appear in Staff Roster after accepting. Required columns: name, email, role.
            </p>
          </div>
          {rosterState === 'idle' && (
            <button
              type="button"
              className="admin-tab__import-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              Upload Staff List
            </button>
          )}
        </div>

        {rosterState === 'idle' && (
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx"
            onChange={handleRosterFileChange}
            className="admin-tab__hidden-file-input"
            aria-describedby="roster-format-hint"
          />
        )}

        {rosterState === 'validating' && (
          <p className="admin-tab__loading-indicator">Validating roster file...</p>
        )}

        {rosterState === 'previewing' && (
          <div className="admin-tab__roster-preview">
            <h3 className="admin-tab__subsection-title">
              Preview ({rosterPreview.length} valid {rosterPreview.length === 1 ? 'row' : 'rows'})
            </h3>
            <p className="admin-tab__confirm-warning" role="alert">
              Confirming will send Admini workspace invitations to all {rosterPreview.length} staff email address(es).
              Recipients appear in Pending Invites until they accept.
            </p>
            {rosterErrors.length > 0 && (
              <p className="admin-tab__warning-message" role="alert">
                {rosterErrors.length} row(s) had errors and will be skipped.
              </p>
            )}
            <ul className="admin-tab__roster-list">
              {rosterPreview.slice(0, 10).map((row) => (
                <li key={row.rowIndex} className="admin-tab__roster-item">
                  <span>{row.name}</span>
                  <span>{row.email}</span>
                  <span>{row.role}</span>
                </li>
              ))}
              {rosterPreview.length > 10 && (
                <li className="admin-tab__roster-item admin-tab__roster-item--more">
                  ...and {rosterPreview.length - 10} more
                </li>
              )}
            </ul>
            <div className="admin-tab__roster-actions">
              <button
                type="button"
                className="admin-tab__submit"
                onClick={handleRosterConfirm}
              >
                Send Staff Invites
              </button>
              <button
                type="button"
                className="admin-tab__cancel-btn"
                onClick={handleRosterCancel}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {rosterState === 'submitting' && (
          <p className="admin-tab__loading-indicator">Sending invitations...</p>
        )}

        {rosterState === 'success' && rosterResult && (
          <div className="admin-tab__roster-result">
            <p className="admin-tab__success-message" role="status">
              Sent {rosterResult.added} staff invitation(s).
            </p>
            {rosterResult.failed.length > 0 && (
              <p className="admin-tab__warning-message" role="alert">
                {rosterResult.failed.length} invitation(s) failed to send.
              </p>
            )}
            <button
              type="button"
              className="admin-tab__submit"
              onClick={handleRosterCancel}
            >
              Upload Another Staff List
            </button>
          </div>
        )}

        {rosterState === 'error' && (
          <div className="admin-tab__roster-error">
            <p className="admin-tab__error-message" role="alert">
              {rosterError}
            </p>
            {rosterErrors.length > 0 && (
              <ul className="admin-tab__error-list">
                {rosterErrors.slice(0, 5).map((err, idx) => (
                  <li key={idx}>Row {err.rowIndex}: {err.field} - {err.message}</li>
                ))}
              </ul>
            )}
            <button
              type="button"
              className="admin-tab__submit"
              onClick={handleRosterCancel}
            >
              Try Again
            </button>
          </div>
        )}
      </section>

      {/* Team Invites Section - restricted to admin/principal (REQ-16) */}
      <section className="admin-tab__section" aria-labelledby="team-invites-heading">
        <h2 id="team-invites-heading" className="admin-tab__section-title">
          Team Invites
        </h2>
        <p className="admin-tab__section-desc">
          Invite staff to your Admini workspace. Pending invites move to Staff Roster after the person accepts.
        </p>

        {canManageInvitations ? (
          <>
            <form className="admin-tab__form admin-tab__invite-form" onSubmit={handleInviteSubmit}>
              <label className="admin-tab__field">
                <span className="admin-tab__field-label">Email</span>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="staff@school.edu"
                  className="admin-tab__input"
                  required
                  disabled={inviteFormState === 'submitting'}
                />
              </label>

              <label className="admin-tab__field">
                <span className="admin-tab__field-label">Role</span>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as AdminiRole)}
                  className="admin-tab__role-select"
                  disabled={inviteFormState === 'submitting'}
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
              {inviteFormState === 'success' && (
                <p className="admin-tab__success-message" role="status">
                  Invitation sent successfully!
                </p>
              )}

              <button
                type="submit"
                className="admin-tab__submit"
                disabled={inviteFormState === 'submitting' || inviteFormState === 'validating'}
              >
                {inviteFormState === 'submitting' ? 'Sending...' : inviteFormState === 'validating' ? 'Validating...' : 'Send Staff Invite'}
              </button>
            </form>

            {/* Pending Invites List with Revoke */}
            {pendingInvitations.length > 0 && (
              <>
                <h3 className="admin-tab__subsection-title">Pending Invites</h3>
                <ul className="admin-tab__invitation-list">
                  {pendingInvitations.map((inv) => (
                    <li key={inv.id} className="admin-tab__invitation-item">
                      <span className="admin-tab__invitation-email">
                        {inv.email}
                      </span>
                      <span className="admin-tab__invitation-role">{inv.role}</span>
                      <span className="admin-tab__invitation-status">
                        {inv.status}
                      </span>
                      <button
                        type="button"
                        className="admin-tab__revoke-btn"
                        disabled={revokingId === inv.id}
                        onClick={() => handleRevokeInvitation(inv.id)}
                        aria-label={`Revoke invitation for ${inv.email}`}
                      >
                        {revokingId === inv.id ? 'Revoking...' : 'Revoke'}
                      </button>
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

      {/* Observation Subjects Section */}
      <section className="admin-tab__section" aria-labelledby="obs-roster-heading">
        <div className="admin-tab__section-header">
          <div>
            <h2 id="obs-roster-heading" className="admin-tab__section-title">
              Observation Subjects
            </h2>
            <p className="admin-tab__section-desc">
              Upload people who can be selected as observation subjects. CSV columns: name, type (student/staff), grade (optional).
            </p>
            <p className="admin-tab__section-hint">
              <strong>Important:</strong> Staff in this roster are people who may be observed, not Admini users. Use Staff Roster and Team Invites for workspace access.
            </p>
          </div>
          {obsRoster.length === 0 && (
            <button
              type="button"
              className="admin-tab__import-btn"
              onClick={() => obsRosterFileRef.current?.click()}
              disabled={obsRosterUploading}
            >
              {obsRosterUploading ? 'Uploading...' : 'Upload Subjects'}
            </button>
          )}
        </div>

        <input
          ref={obsRosterFileRef}
          type="file"
          accept=".csv"
          onChange={handleObsRosterUpload}
          className="admin-tab__hidden-file-input"
        />

        {obsRosterError && (
          <p className="admin-tab__warning-message" role="alert">{obsRosterError}</p>
        )}
        {obsRosterSuccess && (
          <p className="admin-tab__success-message" role="status">{obsRosterSuccess}</p>
        )}

        {obsRoster.length > 0 ? (
          <div className="admin-tab__obs-roster">
            <div className="admin-tab__obs-roster-summary">
              <span className="admin-tab__obs-roster-count">
                {obsRoster.filter(r => r.type === 'student').length} students, {obsRoster.filter(r => r.type === 'staff').length} staff
              </span>
              <div className="admin-tab__obs-roster-actions">
                <button
                  type="button"
                  className="admin-tab__import-btn"
                  onClick={() => obsRosterFileRef.current?.click()}
                  disabled={obsRosterUploading}
                >
                  Replace Subjects
                </button>
                <button
                  type="button"
                  className="admin-tab__cancel-btn"
                  onClick={handleClearObsRoster}
                >
                  Clear Subjects
                </button>
              </div>
            </div>
            <div className="admin-tab__obs-roster-preview">
              <h3 className="admin-tab__subsection-title">Current Subjects</h3>
              <ul className="admin-tab__roster-list">
                {obsRoster.slice(0, 10).map((person, idx) => (
                  <li key={idx} className="admin-tab__roster-item">
                    <span>{person.name}</span>
                    <span className="admin-tab__roster-type">{person.type}</span>
                    {person.grade && <span className="admin-tab__roster-grade">Grade {person.grade}</span>}
                  </li>
                ))}
                {obsRoster.length > 10 && (
                  <li className="admin-tab__roster-item admin-tab__roster-item--more">
                    ...and {obsRoster.length - 10} more
                  </li>
                )}
              </ul>
            </div>
          </div>
        ) : (
          <p className="admin-tab__empty">
            No observation subjects uploaded yet. Upload students or staff who may be selected in classroom observations.
          </p>
        )}
      </section>

      {/* School Features Section */}
      <section className="admin-tab__section" aria-labelledby="school-features-heading">
        <h2 id="school-features-heading" className="admin-tab__section-title">
          School Features
        </h2>
        <p className="admin-tab__section-desc">
          Turn optional tools on or off for this school.
        </p>

        {flagError && (
          <p className="admin-tab__error-message" role="alert">
            {flagError}
          </p>
        )}

        {featureFlags.length === 0 ? (
          <p className="admin-tab__empty">No optional school features are configured yet.</p>
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
    </div>
  );
}



