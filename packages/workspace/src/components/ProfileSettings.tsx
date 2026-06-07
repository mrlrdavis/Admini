import { useState, useEffect, useRef } from 'react';
import { mapSupabaseError } from '@admini/shared';
import type { ProfileUpdatePayload } from '../types';

// ---------------------------------------------------------------------------
// ProfileSettings - Standalone profile editing component.
// Renders editable display name, read-only email, admin-gated school name,
// and read-only role display.
// ---------------------------------------------------------------------------

export interface ProfileSettingsProps {
  userName?: string;
  schoolName?: string;
  email?: string;
  userRole?: string;
  /** Called when the user saves a field. Returns the field key and new value. */
  onSave?: (payload: ProfileUpdatePayload) => Promise<void> | void;
  /** When true, disables Save buttons and inputs during an external save. */
  saving?: boolean;
  /** External error message to display (overrides internal validation). */
  error?: string | null;
}

export function ProfileSettings({
  userName,
  schoolName,
  email,
  userRole,
  onSave,
  saving: externalSaving,
  error: externalError,
}: ProfileSettingsProps) {
  const [editingField, setEditingField] = useState<'display-name' | 'school' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [internalSaving, setInternalSaving] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [savedField, setSavedField] = useState<'display-name' | 'school' | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saving = externalSaving || internalSaving;
  const error = externalError ?? internalError;
  const isAdminOrPrincipal = userRole === 'admin' || userRole === 'principal';

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  function handleEditClick(field: 'display-name' | 'school') {
    if (field === 'school' && !isAdminOrPrincipal) return;
    setInternalError(null);
    setSavedField(null);
    setEditingField(field);
    setEditValue(field === 'display-name' ? (userName || '') : (schoolName || ''));
  }

  function handleCancel() {
    setEditingField(null);
    setEditValue('');
    setInternalError(null);
  }

  async function handleSave() {
    if (!editingField) return;
    const trimmed = editValue.trim();
    if (!trimmed) {
      setInternalError(
        editingField === 'display-name'
          ? 'Display name cannot be empty'
          : 'School name cannot be empty',
      );
      return;
    }
    setInternalSaving(true);
    setInternalError(null);
    try {
      const field = editingField;
      await onSave?.({ field, value: trimmed });
      setEditingField(null);
      setEditValue('');
      setSavedField(field);
      // Auto-dismiss success message after 2.5 seconds
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => {
        setSavedField(null);
      }, 2500);
    } catch (err) {
      // Handle all possible error shapes gracefully (REQ-15).
      // Errors from the parent's onSave are typically already user-friendly,
      // but we still guard against unexpected shapes to prevent UI breakage.
      if (typeof err === 'string') {
        setInternalError(err);
      } else if (err instanceof Error) {
        setInternalError(err.message);
      } else {
        setInternalError(mapSupabaseError(err));
      }
    } finally {
      setInternalSaving(false);
    }
  }

  return (
    <div className="profile-settings" aria-label="Profile settings">
      {/* Display Name */}
      <div className="profile-settings__row">
        <div className="profile-settings__info">
          <span className="profile-settings__label">Display Name</span>
          {editingField === 'display-name' ? (
            <div className="profile-settings__edit-inline">
              <input
                type="text"
                className="profile-settings__input"
                value={editValue}
                onChange={(e) => {
                  setEditValue(e.target.value);
                  if (e.target.value.trim()) setInternalError(null);
                }}
                onBlur={() => {
                  if (!editValue.trim()) setInternalError('Display name cannot be empty');
                }}
                aria-label="Display name"
                autoFocus
                disabled={saving}
              />
              {error && editingField === 'display-name' && (
                <p className="profile-settings__error" role="alert">{error}</p>
              )}
              <div className="profile-settings__actions">
                <button type="button" className="profile-settings__btn-cancel" onClick={handleCancel} disabled={saving}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="profile-settings__btn-save"
                  onClick={handleSave}
                  disabled={saving || !editValue.trim()}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <span className="profile-settings__value">{userName || 'Not provided'}</span>
              {savedField === 'display-name' && (
                <span className="profile-settings__success" role="status">{'\u2713 Updated'}</span>
              )}
            </>
          )}
        </div>
        {editingField !== 'display-name' && (
          <button
            type="button"
            className="profile-settings__edit-btn"
            onClick={() => handleEditClick('display-name')}
            aria-label="Edit display name"
          >
            Edit
          </button>
        )}
      </div>

      {/* Email (read-only) */}
      <div className="profile-settings__row">
        <div className="profile-settings__info">
          <span className="profile-settings__label">Email</span>
          <span className="profile-settings__value">{email || 'Not provided'}</span>
        </div>
      </div>

      {/* School Name */}
      <div className="profile-settings__row">
        <div className="profile-settings__info">
          <span className="profile-settings__label">School</span>
          {editingField === 'school' ? (
            <div className="profile-settings__edit-inline">
              <input
                type="text"
                className="profile-settings__input"
                value={editValue}
                onChange={(e) => {
                  setEditValue(e.target.value);
                  if (e.target.value.trim()) setInternalError(null);
                }}
                onBlur={() => {
                  if (!editValue.trim()) setInternalError('School name cannot be empty');
                }}
                aria-label="School name"
                autoFocus
                disabled={saving}
              />
              {error && editingField === 'school' && (
                <p className="profile-settings__error" role="alert">{error}</p>
              )}
              <div className="profile-settings__actions">
                <button type="button" className="profile-settings__btn-cancel" onClick={handleCancel} disabled={saving}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="profile-settings__btn-save"
                  onClick={handleSave}
                  disabled={saving || !editValue.trim()}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <span className="profile-settings__value">{schoolName || 'Not provided'}</span>
              {savedField === 'school' && (
                <span className="profile-settings__success" role="status">{'\u2713 Updated'}</span>
              )}
            </>
          )}
          {!isAdminOrPrincipal && editingField !== 'school' && (
            <span className="profile-settings__admin-notice" role="note">
              Admin only {'\u2014'} only administrators or principals can change the school name.
            </span>
          )}
        </div>
        {editingField !== 'school' && (
          <button
            type="button"
            className="profile-settings__edit-btn"
            onClick={() => handleEditClick('school')}
            disabled={!isAdminOrPrincipal}
            aria-label={
              isAdminOrPrincipal
                ? 'Edit school name'
                : 'School name editing restricted to admin or principal roles'
            }
          >
            Edit
          </button>
        )}
      </div>

      {/* Role (read-only) */}
      <div className="profile-settings__row">
        <div className="profile-settings__info">
          <span className="profile-settings__label">Role</span>
          <span className="profile-settings__value">{userRole || 'Not provided'}</span>
        </div>
      </div>
    </div>
  );
}
