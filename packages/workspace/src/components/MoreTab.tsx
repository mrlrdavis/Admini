import { useState } from 'react';
import { SkeletonCard } from '@admini/ui';
import { mapSupabaseError } from '@admini/shared';
import { getClient } from '../services/getClient';
import type { ProfileUpdatePayload } from '../types';
import { ProfileSettings } from './ProfileSettings';
import { NotificationSettings } from './NotificationSettings';
import { AppPreferences } from './AppPreferences';

// ---------------------------------------------------------------------------
// MoreTab - Settings, integrations access, and account actions.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Sub-view type for navigation state
// ---------------------------------------------------------------------------

export type MoreTabSubView = 'profile' | 'notifications' | 'preferences' | 'integrations' | 'account' | null;

// ---------------------------------------------------------------------------
// Profile update helper - performs the actual Supabase profile update
// ---------------------------------------------------------------------------

async function saveProfileField(field: 'display-name' | 'school', value: string): Promise<void> {
  const client = getClient();

  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData?.user) {
    throw new Error(mapSupabaseError(userError ?? { message: 'Not authenticated' }));
  }
  const userId = userData.user.id;

  if (field === 'display-name') {
    const { error: authErr } = await client.auth.updateUser({
      data: { display_name: value },
    });
    if (authErr) throw new Error(mapSupabaseError(authErr));

    const { error: profileErr } = await client
      .from('profiles')
      .update({ display_name: value })
      .eq('id', userId);
    if (profileErr) throw new Error(mapSupabaseError(profileErr));
  } else if (field === 'school') {
    const { error: authErr } = await client.auth.updateUser({
      data: { school_name: value },
    });
    if (authErr) throw new Error(mapSupabaseError(authErr));

    const { data: profile, error: profileFetchErr } = await client
      .from('profiles')
      .select('organization_id')
      .eq('id', userId)
      .single();
    if (profileFetchErr) throw new Error(mapSupabaseError(profileFetchErr));
    if (profile?.organization_id) {
      const { error: orgErr } = await client
        .from('organizations')
        .update({ name: value })
        .eq('id', profile.organization_id);
      if (orgErr) throw new Error(mapSupabaseError(orgErr));
    }
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MoreTabProps {
  onSignOut: () => void;
  onDeleteAccount?: () => Promise<void>;
  loading?: boolean;
  userRole?: string;
  userName?: string;
  schoolName?: string;
  email?: string;
  onProfileUpdated?: (payload: ProfileUpdatePayload) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MoreTab({ onSignOut, onDeleteAccount, loading, userRole, userName, schoolName, email, onProfileUpdated }: MoreTabProps) {
  const [activeSubView, setActiveSubView] = useState<MoreTabSubView>(null);
  const [editingField, setEditingField] = useState<'display-name' | 'school' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const isAdminOrPrincipal = userRole === 'admin' || userRole === 'principal';

  function handleEditClick(field: 'display-name' | 'school') {
    if (field === 'school' && !isAdminOrPrincipal) {
      return;
    }
    setSaveError(null);
    setEditingField(field);
    setEditValue(field === 'display-name' ? (userName || '') : (schoolName || ''));
  }

  function handleCancel() {
    setEditingField(null);
    setEditValue('');
    setSaveError(null);
  }

  async function handleSave() {
    if (!editingField) return;
    if (!editValue.trim()) {
      setSaveError(editingField === 'display-name' ? 'Display name cannot be empty' : 'School name cannot be empty');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await saveProfileField(editingField, editValue.trim());
      onProfileUpdated?.({ field: editingField, value: editValue.trim() });
      setEditingField(null);
      setEditValue('');
    } catch (err) {
      // Errors from saveProfileField are already user-friendly (mapped via mapSupabaseError).
      // Handle unexpected error shapes gracefully so the UI never breaks.
      if (typeof err === 'string') {
        setSaveError(err);
      } else if (err instanceof Error) {
        setSaveError(err.message);
      } else {
        setSaveError(mapSupabaseError(err));
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleProfileSave(payload: ProfileUpdatePayload): Promise<void> {
    try {
      await saveProfileField(payload.field, payload.value);
      onProfileUpdated?.(payload);
    } catch (err) {
      // Re-throw as a proper Error with the user-friendly message so
      // ProfileSettings can display it inline via its catch block.
      if (err instanceof Error) {
        throw err;
      }
      throw new Error(typeof err === 'string' ? err : mapSupabaseError(err));
    }
  }

  async function handleDeleteAccount() {
    if (!onDeleteAccount) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDeleteAccount();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete account. Please try again.');
      setDeleting(false);
    }
  }

  function handleBackToMenu() {
    setActiveSubView(null);
    setEditingField(null);
    setEditValue('');
    setSaveError(null);
  }

  if (loading) {
    return (
      <div className="more-tab more-tab--loading" aria-busy="true">
        <SkeletonCard height={48} />
        <SkeletonCard height={48} />
        <SkeletonCard height={48} />
        <SkeletonCard height={48} />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Profile sub-view
  // -------------------------------------------------------------------------
  if (activeSubView === 'profile') {
    return (
      <div className="more-tab more-tab--sub-view">
        <header className="more-tab__header">
          <button
            type="button"
            className="more-tab__back-btn"
            onClick={handleBackToMenu}
            aria-label="Back to settings menu"
          >
            {'\u2190'} Back
          </button>
          <h1 className="more-tab__title">Profile</h1>
        </header>

        <section className="more-tab__section" aria-labelledby="profile-sub-view-heading">
          <h2 id="profile-sub-view-heading" className="more-tab__section-title">Edit Profile</h2>
          <ProfileSettings
            userName={userName}
            schoolName={schoolName}
            email={email}
            userRole={userRole}
            onSave={handleProfileSave}
          />
        </section>
      </div>
    );
  }
  // -------------------------------------------------------------------------
  // Notifications sub-view
  // -------------------------------------------------------------------------
  if (activeSubView === 'notifications') {
    return (
      <div className="more-tab more-tab--sub-view">
        <header className="more-tab__header">
          <button
            type="button"
            className="more-tab__back-btn"
            onClick={handleBackToMenu}
            aria-label="Back to settings menu"
          >
            {'\u2190'} Back
          </button>
          <h1 className="more-tab__title">Notifications</h1>
        </header>

        <section className="more-tab__section" aria-labelledby="notifications-sub-view-heading">
          <h2 id="notifications-sub-view-heading" className="more-tab__section-title">Notification Preferences</h2>
          <NotificationSettings
            onChange={(key, value) => {
              // Preference persistence will be wired in tasks 12.3-12.5
              void key;
              void value;
            }}
          />
        </section>
      </div>
    );
  }



  // -------------------------------------------------------------------------
  // Preferences sub-view
  // -------------------------------------------------------------------------
  if (activeSubView === 'preferences') {
    return (
      <div className="more-tab more-tab--sub-view">
        <header className="more-tab__header">
          <button
            type="button"
            className="more-tab__back-btn"
            onClick={handleBackToMenu}
            aria-label="Back to settings menu"
          >
            {'\u2190'} Back
          </button>
          <h1 className="more-tab__title">App Preferences</h1>
        </header>

        <section className="more-tab__section" aria-labelledby="preferences-sub-view-heading">
          <h2 id="preferences-sub-view-heading" className="more-tab__section-title">App Preferences</h2>
          <AppPreferences
            onChange={(key, value) => {
              // Preference persistence will be wired in task 13.3
              void key;
              void value;
            }}
          />
        </section>
      </div>
    );
  }


  // -------------------------------------------------------------------------
  // Integrations sub-view
  // -------------------------------------------------------------------------
  if (activeSubView === 'integrations') {
    return (
      <div className="more-tab more-tab--sub-view">
        <header className="more-tab__header">
          <button
            type="button"
            className="more-tab__back-btn"
            onClick={handleBackToMenu}
            aria-label="Back to settings menu"
          >
            {'\u2190'} Back
          </button>
          <h1 className="more-tab__title">Integrations</h1>
        </header>

        <section className="more-tab__section" aria-labelledby="integrations-sub-view-heading">
          <h2 id="integrations-sub-view-heading" className="more-tab__section-title">Connected Apps</h2>
          <p className="more-tab__placeholder-note">
            Integration management (connected apps list, connection status, disconnect flow) will be added in a future update.
          </p>
        </section>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Account sub-view
  // -------------------------------------------------------------------------
  if (activeSubView === 'account') {
    return (
      <div className="more-tab more-tab--sub-view">
        <header className="more-tab__header">
          <button
            type="button"
            className="more-tab__back-btn"
            onClick={handleBackToMenu}
            aria-label="Back to settings menu"
          >
            {'\u2190'} Back
          </button>
          <h1 className="more-tab__title">Account</h1>
        </header>

        <section className="more-tab__section" aria-labelledby="account-sub-view-heading">
          <h2 id="account-sub-view-heading" className="more-tab__section-title">Account Management</h2>
          <p className="more-tab__placeholder-note">
            Account management (delete account, change password, export data) will be added in a future update.
          </p>
        </section>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Main menu view
  // -------------------------------------------------------------------------
  return (
    <div className="more-tab">
      {/* Header */}
      <header className="more-tab__header">
        <h1 className="more-tab__title">Settings</h1>
      </header>

      {/* Profile Section */}
      <section className="more-tab__section" aria-labelledby="more-tab-profile-heading">
        <h2 id="more-tab-profile-heading" className="more-tab__section-title">Profile</h2>
        <div className="more-tab__profile-fields">
          {/* Display Name */}
          <div className="more-tab__profile-row">
            <div className="more-tab__profile-info">
              <span className="more-tab__profile-label">Display Name</span>
              {editingField === 'display-name' ? (
                <div className="more-tab__profile-edit-inline">
                  <input
                    type="text"
                    className="more-tab__profile-input"
                    value={editValue}
                    onChange={(e) => { setEditValue(e.target.value); if (e.target.value.trim()) setSaveError(null); }}
                    onBlur={() => { if (!editValue.trim()) setSaveError('Display name cannot be empty'); }}
                    aria-label="Display name"
                    autoFocus
                    disabled={saving}
                  />
                  {saveError && editingField === 'display-name' && (
                    <p className="more-tab__save-error" role="alert">{saveError}</p>
                  )}
                  <div className="more-tab__profile-edit-actions">
                    <button type="button" className="more-tab__btn-cancel" onClick={handleCancel} disabled={saving}>Cancel</button>
                    <button type="button" className="more-tab__btn-save" onClick={handleSave} disabled={saving || !editValue.trim()}>
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
                <span className="more-tab__profile-value">{userName || 'Not provided'}</span>
              )}
            </div>
            {editingField !== 'display-name' && (
              <button type="button" className="more-tab__edit-btn" onClick={() => handleEditClick('display-name')} aria-label="Edit display name">Edit</button>
            )}
          </div>

          {/* School Name */}
          <div className="more-tab__profile-row">
            <div className="more-tab__profile-info">
              <span className="more-tab__profile-label">School</span>
              {editingField === 'school' ? (
                <div className="more-tab__profile-edit-inline">
                  <input
                    type="text"
                    className="more-tab__profile-input"
                    value={editValue}
                    onChange={(e) => { setEditValue(e.target.value); if (e.target.value.trim()) setSaveError(null); }}
                    onBlur={() => { if (!editValue.trim()) setSaveError('School name cannot be empty'); }}
                    aria-label="School name"
                    autoFocus
                    disabled={saving}
                  />
                  {saveError && editingField === 'school' && (
                    <p className="more-tab__save-error" role="alert">{saveError}</p>
                  )}
                  <div className="more-tab__profile-edit-actions">
                    <button type="button" className="more-tab__btn-cancel" onClick={handleCancel} disabled={saving}>Cancel</button>
                    <button type="button" className="more-tab__btn-save" onClick={handleSave} disabled={saving || !editValue.trim()}>
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
                <span className="more-tab__profile-value">{schoolName || 'Not provided'}</span>
              )}
              {!isAdminOrPrincipal && editingField !== 'school' && (
                <span className="more-tab__admin-only-notice" role="note">Admin only ï¿½ only administrators or principals can change the school name.</span>
              )}
            </div>
            {editingField !== 'school' && (
              <button
                type="button"
                className="more-tab__edit-btn"
                onClick={() => handleEditClick('school')}
                disabled={!isAdminOrPrincipal}
                aria-label={isAdminOrPrincipal ? 'Edit school name' : 'School name editing restricted to admin or principal roles'}
              >
                Edit
              </button>
            )}
          </div>

          {/* Email (read-only) */}
          <div className="more-tab__profile-row">
            <div className="more-tab__profile-info">
              <span className="more-tab__profile-label">Email</span>
              <span className="more-tab__profile-value">{email || 'Not provided'}</span>
            </div>
          </div>

          {/* Role (read-only) */}
          <div className="more-tab__profile-row">
            <div className="more-tab__profile-info">
              <span className="more-tab__profile-label">Role</span>
              <span className="more-tab__profile-value">{userRole || 'Not provided'}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Settings Section */}
      <section className="more-tab__section" aria-labelledby="more-tab-settings-heading">
        <h2 id="more-tab-settings-heading" className="more-tab__section-title">Settings</h2>
        <ul className="more-tab__list" role="list">
          <li className="more-tab__list-item">
            <button type="button" className="more-tab__link-btn" onClick={() => setActiveSubView('profile')}>
              <span className="more-tab__link-icon" aria-hidden="true">{'\uD83D\uDC64'}</span>
              <span className="more-tab__link-label">Profile</span>
            </button>
          </li>
          <li className="more-tab__list-item">
            <button type="button" className="more-tab__link-btn" onClick={() => setActiveSubView('notifications')}>
              <span className="more-tab__link-icon" aria-hidden="true">{'\ud83d\udd14'}</span>
              <span className="more-tab__link-label">Notifications</span>
            </button>
          </li>
          <li className="more-tab__list-item">
            <button type="button" className="more-tab__link-btn" onClick={() => setActiveSubView('preferences')}>
              <span className="more-tab__link-icon" aria-hidden="true">{'\u2699\ufe0f'}</span>
              <span className="more-tab__link-label">Preferences</span>
            </button>
          </li>
        </ul>
      </section>

      {/* Integrations Section */}
      <section className="more-tab__section" aria-labelledby="more-tab-integrations-heading">
        <h2 id="more-tab-integrations-heading" className="more-tab__section-title">Integrations</h2>
        <ul className="more-tab__list" role="list">
          <li className="more-tab__list-item">
            <button type="button" className="more-tab__link-btn" onClick={() => setActiveSubView('integrations')}>
              <span className="more-tab__link-icon" aria-hidden="true">{'\ud83d\udd17'}</span>
              <span className="more-tab__link-label">Connected Apps</span>
            </button>
          </li>
          <li className="more-tab__list-item">
            <button type="button" className="more-tab__link-btn">
              <span className="more-tab__link-icon" aria-hidden="true">{'\u2795'}</span>
              <span className="more-tab__link-label">Add Integration</span>
            </button>
          </li>
        </ul>
      </section>

      {/* Account Actions Section */}
      <section className="more-tab__section" aria-labelledby="more-tab-account-heading">
        <h2 id="more-tab-account-heading" className="more-tab__section-title">Account</h2>
        <div className="more-tab__actions">
          <button
            type="button"
            className="more-tab__sign-out-btn"
            onClick={onSignOut}
          >
            Sign Out
          </button>
          {onDeleteAccount && (
            <button
              type="button"
              className="more-tab__delete-account-btn"
              onClick={() => { setDeleteError(null); setShowDeleteConfirm(true); }}
              disabled={deleting}
              aria-label="Delete account"
            >
              {deleting ? 'Deleting...' : 'Delete Account'}
            </button>
          )}
          {deleteError && (
            <p className="more-tab__save-error" role="alert">{deleteError}</p>
          )}
        </div>
      </section>

      {/* Delete Account Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="more-tab__confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-confirm-title">
          <div className="more-tab__confirm-dialog">
            <h3 id="delete-confirm-title" className="more-tab__confirm-title">Delete Account</h3>
            <p className="more-tab__confirm-message">
              Are you sure you want to permanently delete your account? This action cannot be undone. All your data, tasks, and profile information will be removed.
            </p>
            <div className="more-tab__confirm-actions">
              <button
                type="button"
                className="more-tab__btn-cancel"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="more-tab__confirm-delete-btn"
                onClick={handleDeleteAccount}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Yes, Delete My Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
