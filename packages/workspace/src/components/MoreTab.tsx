import { useState, useEffect, useCallback, useRef } from 'react';
import { SkeletonCard } from '@admini/ui';
import { mapSupabaseError } from '@admini/shared';
import { getClient } from '../services/getClient';
import { loadNotificationPreferences, saveNotificationPreferences } from '../services/notificationPreferences';
import type { NotificationPreferences } from '../services/notificationPreferences';
import type { ProfileUpdatePayload } from '../types';
import { ProfileSettings } from './ProfileSettings';
import { NotificationSettings } from './NotificationSettings';
import { AppPreferences } from './AppPreferences';
import { ConnectedIntegrations } from './ConnectedIntegrations';
import { IntegrationCatalog } from './IntegrationCatalog';
import { useThemePreference } from '../hooks/useThemePreference';
import { useCompactMode } from '../hooks/useCompactMode';
import { useDebouncedSave } from '../hooks/useDebouncedSave';

// ---------------------------------------------------------------------------
// MoreTab - Settings, integrations access, and account actions.
// ---------------------------------------------------------------------------

/**
 * Detects whether an error message indicates a session/auth expiry.
 * Used to show an actionable Sign In button alongside the error (REQ-15).
 */
function isSessionExpiredError(message: string | null | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return lower.includes('sign in again') || lower.includes('session has expired') || lower.includes('not authenticated');
}

// ---------------------------------------------------------------------------
// Sub-view type for navigation state
// ---------------------------------------------------------------------------

export type MoreTabSubView = 'profile' | 'notifications' | 'preferences' | 'integrations' | 'account' | 'help' | null;

// ---------------------------------------------------------------------------
// SessionStorage key for persisting last-visited settings section
// ---------------------------------------------------------------------------

const LAST_SETTINGS_SECTION_KEY = 'admini_last_settings_section';

const VALID_SUB_VIEWS: ReadonlySet<string> = new Set([
  'profile',
  'notifications',
  'preferences',
  'integrations',
  'account',
  'help',
]);

/** Safely read the last-visited section from sessionStorage. Returns null if unavailable or invalid. */
function getPersistedSection(): MoreTabSubView {
  try {
    const stored = sessionStorage.getItem(LAST_SETTINGS_SECTION_KEY);
    if (stored && VALID_SUB_VIEWS.has(stored)) {
      return stored as MoreTabSubView;
    }
  } catch {
    // sessionStorage unavailable (e.g., private browsing restrictions) - ignore
  }
  return null;
}

/** Safely persist the current section to sessionStorage. */
function persistSection(view: MoreTabSubView): void {
  try {
    if (view) {
      sessionStorage.setItem(LAST_SETTINGS_SECTION_KEY, view);
    } else {
      sessionStorage.removeItem(LAST_SETTINGS_SECTION_KEY);
    }
  } catch {
    // sessionStorage unavailable - silently ignore
  }
}

/** Clear the persisted section from sessionStorage. */
function clearPersistedSection(): void {
  try {
    sessionStorage.removeItem(LAST_SETTINGS_SECTION_KEY);
  } catch {
    // sessionStorage unavailable - silently ignore
  }
}

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
  // Stack-based navigation: initialize from persisted section for quick return
  const [viewStack, setViewStack] = useState<MoreTabSubView[]>(() => {
    const persisted = getPersistedSection();
    return persisted ? [persisted] : [];
  });
  const [isReturning, setIsReturning] = useState(false);
  const { compactMode, setCompactMode } = useCompactMode();
  const { themePreference, setThemePreference } = useThemePreference();
  const activeSubView: MoreTabSubView = viewStack[viewStack.length - 1] ?? null;

  const [editingField, setEditingField] = useState<'display-name' | 'school' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Account / auth provider detection state
  const [isEmailUser, setIsEmailUser] = useState<boolean | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);

  // Change password form state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Export Data state
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Notification preferences state
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>({
    emailNotifications: false,
    pushNotifications: false,
    activityDigest: false,
  });
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState<string | null>(null);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifRetryCount, setNotifRetryCount] = useState(0);
  const MAX_NOTIF_RETRIES = 3;

  const isAdminOrPrincipal = userRole === 'admin' || userRole === 'principal';

  // ---------------------------------------------------------------------------
  // Accessibility: focus management refs
  // ---------------------------------------------------------------------------

  /** Ref for sub-view heading - receives focus when navigating into a sub-view */
  const subViewHeadingRef = useRef<HTMLHeadingElement>(null);
  /** Ref for the back button in sub-views - alternative focus target */
  const backButtonRef = useRef<HTMLButtonElement>(null);
  /** Tracks which menu button triggered navigation (for focus restoration on goBack) */
  const lastFocusedMenuRef = useRef<HTMLButtonElement | null>(null);
  /** Ref for the settings menu heading - receives focus on goBack to main menu */
  const menuHeadingRef = useRef<HTMLHeadingElement>(null);

  // ---------------------------------------------------------------------------
  // Accessibility: manage focus on sub-view navigation
  // When navigating to a sub-view, focus the heading so screen readers announce
  // the new view. When returning to the main menu, restore focus to the button
  // that triggered the navigation (or the menu heading as fallback).
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (activeSubView !== null) {
      // Small delay to allow the DOM to render the sub-view before focusing
      const timer = setTimeout(() => {
        if (subViewHeadingRef.current) {
          subViewHeadingRef.current.focus();
        } else if (backButtonRef.current) {
          backButtonRef.current.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    } else if (isReturning) {
      // Returning to main menu - restore focus to the triggering button
      const timer = setTimeout(() => {
        if (lastFocusedMenuRef.current) {
          lastFocusedMenuRef.current.focus();
          lastFocusedMenuRef.current = null;
        } else if (menuHeadingRef.current) {
          menuHeadingRef.current.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [activeSubView, isReturning]);

  // ---------------------------------------------------------------------------
  // Persist active section to sessionStorage whenever it changes
  // ---------------------------------------------------------------------------

  useEffect(() => {
    persistSection(activeSubView);
  }, [activeSubView]);

  // ---------------------------------------------------------------------------
  // Detect auth provider when account sub-view is active
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (activeSubView !== 'account') return;

    let cancelled = false;

    async function detectAuthProvider() {
      try {
        const client = getClient();
        const { data: userData, error: userError } = await client.auth.getUser();
        if (userError || !userData?.user) return;

        const user = userData.user;
        // Check identities array for email provider
        const hasEmailIdentity = user.identities?.some(
          (identity) => identity.provider === 'email'
        ) ?? false;
        // Fallback: check app_metadata.provider
        const appProvider = user.app_metadata?.provider;
        const isEmail = hasEmailIdentity || appProvider === 'email';

        if (!cancelled) {
          setIsEmailUser(isEmail);
        }
      } catch {
        // If detection fails, default to not showing the button
        if (!cancelled) {
          setIsEmailUser(false);
        }
      }
    }

    detectAuthProvider();

    return () => {
      cancelled = true;
    };
  }, [activeSubView]);

  // ---------------------------------------------------------------------------
  // Load notification preferences when the notifications sub-view becomes active
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (activeSubView !== 'notifications') return;

    let cancelled = false;

    async function fetchPrefs() {
      setNotifLoading(true);
      setNotifError(null);
      try {
        const client = getClient();
        const { data: userData, error: userError } = await client.auth.getUser();
        if (userError || !userData?.user) {
          throw new Error('Unable to load preferences. Please sign in again.');
        }
        const prefs = await loadNotificationPreferences(userData.user.id);
        if (!cancelled) {
          setNotifPrefs(prefs);
        }
      } catch (err) {
        if (!cancelled) {
          setNotifError(
            err instanceof Error ? err.message : 'Failed to load notification preferences.',
          );
        }
      } finally {
        if (!cancelled) {
          setNotifLoading(false);
        }
      }
    }

    fetchPrefs();

    return () => {
      cancelled = true;
    };
  }, [activeSubView]);

  // ---------------------------------------------------------------------------
  // Debounced save for notification preferences (avoids excessive writes on rapid toggles)
  // ---------------------------------------------------------------------------

  const debouncedSaveNotifPrefs = useDebouncedSave<NotificationPreferences>(
    useCallback(async (prefs: NotificationPreferences) => {
      setNotifSaving(true);
      setNotifError(null);
      try {
        const client = getClient();
        const { data: userData, error: userError } = await client.auth.getUser();
        if (userError || !userData?.user) {
          throw new Error('Unable to save preferences. Please sign in again.');
        }
        await saveNotificationPreferences(userData.user.id, prefs);
      } catch {
        // Silently fall back - preferences are saved to localStorage by the service
      } finally {
        setNotifSaving(false);
      }
    }, []),
    800,
  );

  const handleNotifChange = useCallback(
    (key: string, value: boolean) => {
      // Update local state immediately for instant UI feedback
      setNotifPrefs((prev) => {
        const updated = { ...prev, [key]: value };
        // Schedule debounced save with the updated preferences
        debouncedSaveNotifPrefs(updated);
        return updated;
      });
      setNotifError(null);
      setNotifRetryCount(0);
    },
    [debouncedSaveNotifPrefs],
  );

  // ---------------------------------------------------------------------------
  // Retry handler for notification preference save failures
  // ---------------------------------------------------------------------------

  const handleNotifRetry = useCallback(async () => {
    if (notifRetryCount >= MAX_NOTIF_RETRIES) {
      setNotifError('Maximum retry attempts reached. Please try again later.');
      return;
    }
    setNotifRetryCount((prev) => prev + 1);
    setNotifSaving(true);
    setNotifError(null);
    try {
      const client = getClient();
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError || !userData?.user) {
        throw new Error('Unable to save preferences. Please sign in again.');
      }
      await saveNotificationPreferences(userData.user.id, notifPrefs);
    } catch (err) {
      setNotifError(
        err instanceof Error ? err.message : 'Failed to save notification preferences.',
      );
    } finally {
      setNotifSaving(false);
    }
  }, [notifPrefs, notifRetryCount]);

  // ---------------------------------------------------------------------------
  // Navigation helpers (stack-based)
  // ---------------------------------------------------------------------------

  /** Push a view onto the navigation stack, storing the triggering button for focus restoration */
  function navigateTo(view: MoreTabSubView, event?: React.MouseEvent<HTMLButtonElement>) {
    if (view !== null) {
      // Store the button that triggered navigation so focus can return on goBack
      if (event?.currentTarget) {
        lastFocusedMenuRef.current = event.currentTarget;
      }
      setIsReturning(false);
      setViewStack((prev) => [...prev, view]);
    }
  }

  /** Pop the top view from the stack (go back one level) */
  function goBack() {
    setIsReturning(true);
    setViewStack((prev) => {
      const next = prev.slice(0, -1);
      // Clear persisted section when navigating back to main menu
      if (next.length === 0) {
        clearPersistedSection();
      }
      return next;
    });
    setEditingField(null);
    setEditValue('');
    setSaveError(null);
  }

  /** Clear the entire stack back to main menu */
  function resetToMenu() {
    setViewStack([]);
    clearPersistedSection();
    setEditingField(null);
    setEditValue('');
    setSaveError(null);
  }

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
      setDeleteError(mapSupabaseError(err));
      setDeleting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Change Password handler
  // ---------------------------------------------------------------------------

  function handleCancelChangePassword() {
    setShowChangePassword(false);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
    setPasswordSuccess(false);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    // Validation
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setPasswordSaving(true);
    try {
      const client = getClient();
      const { error } = await client.auth.updateUser({ password: newPassword });
      if (error) {
        setPasswordError(mapSupabaseError(error));
        return;
      }
      setPasswordSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      // Auto-hide the form after a short delay on success
      setTimeout(() => {
        setShowChangePassword(false);
        setPasswordSuccess(false);
      }, 2000);
    } catch (err) {
      setPasswordError(mapSupabaseError(err));
    } finally {
      setPasswordSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Export Data handler - fetches profile + tasks and triggers JSON download
  // ---------------------------------------------------------------------------

  async function handleExportData() {
    setExporting(true);
    setExportError(null);
    try {
      const client = getClient();
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError || !userData?.user) {
        throw new Error('Unable to export data. Please sign in again.');
      }
      const userId = userData.user.id;

      // Fetch profile
      const { data: profile, error: profileErr } = await client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (profileErr) {
        throw new Error(mapSupabaseError(profileErr));
      }

      // Fetch tasks
      const { data: tasks, error: tasksErr } = await client
        .from('tasks')
        .select('*')
        .eq('created_by', userId);
      if (tasksErr) {
        throw new Error(mapSupabaseError(tasksErr));
      }

      // Build export object
      const exportData = {
        exportedAt: new Date().toISOString(),
        profile: profile ?? {},
        tasks: tasks ?? [],
      };

      // Create blob and trigger download
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const date = new Date().toISOString().split('T')[0];
      const link = document.createElement('a');
      link.href = url;
      link.download = `admini-export-${date}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(mapSupabaseError(err));
    } finally {
      setExporting(false);
    }
  }


  // ---------------------------------------------------------------------------
  // Export CSV handler - fetches tasks and triggers CSV download
  // ---------------------------------------------------------------------------

  async function handleExportCSV() {
    setExporting(true);
    setExportError(null);
    try {
      const client = getClient();
      const { data: userData, error: userError } = await client.auth.getUser();
      if (userError || !userData?.user) throw new Error('Unable to export data. Please sign in again.');
      const userId = userData.user.id;

      const { data: tasks, error: tasksErr } = await client
        .from('tasks')
        .select('*')
        .eq('created_by', userId);
      if (tasksErr) throw new Error(mapSupabaseError(tasksErr));

      // Build CSV
      const headers = ['Title', 'Priority', 'Status', 'Due Date', 'Assigned To', 'Created At'];
      const rows = (tasks || []).map((t: any) => [
        t.title,
        t.priority,
        t.status,
        t.due_at || '',
        t.assigned_to || '',
        t.created_at,
      ]);
      const csv = [headers.join(','), ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const date = new Date().toISOString().split('T')[0];
      const a = document.createElement('a');
      a.href = url;
      a.download = `admini-tasks-${date}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setExportError(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  // Suppress unused variable warning - resetToMenu is available for future use
  void resetToMenu;

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
      <div className="more-tab more-tab--sub-view" role="region" aria-label="Profile settings">
        <header className="more-tab__header">
          <button
            type="button"
            ref={backButtonRef}
            className="more-tab__back-btn"
            onClick={goBack}
            aria-label="Back to settings menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20" aria-hidden="true"><path d="M19 12H5" /><polyline points="12 19 5 12 12 5" /></svg>
          </button>
          <h1 ref={subViewHeadingRef} className="more-tab__title" tabIndex={-1}>Profile</h1>
        </header>

        <section className="more-tab__section">
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
      <div className="more-tab more-tab--sub-view" role="region" aria-label="Notification settings">
        <header className="more-tab__header">
          <button
            type="button"
            ref={backButtonRef}
            className="more-tab__back-btn"
            onClick={goBack}
            aria-label="Back to settings menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20" aria-hidden="true"><path d="M19 12H5" /><polyline points="12 19 5 12 12 5" /></svg>
          </button>
          <h1 ref={subViewHeadingRef} className="more-tab__title" tabIndex={-1}>Notifications</h1>
        </header>

        <section className="more-tab__section">
          {notifLoading ? (
            <div className="more-tab__notif-loading" aria-busy="true">
              <SkeletonCard height={44} />
              <SkeletonCard height={44} />
              <SkeletonCard height={44} />
            </div>
          ) : (
            <NotificationSettings
              emailNotifications={notifPrefs.emailNotifications}
              pushNotifications={notifPrefs.pushNotifications}
              activityDigest={notifPrefs.activityDigest}
              onChange={handleNotifChange}
              saving={notifSaving}
              error={notifError}
              onRetry={notifRetryCount < MAX_NOTIF_RETRIES ? handleNotifRetry : undefined}
            />
          )}
        </section>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Preferences sub-view
  // -------------------------------------------------------------------------
  if (activeSubView === 'preferences') {
    return (
      <div className="more-tab more-tab--sub-view" role="region" aria-label="App preferences settings">
        <header className="more-tab__header">
          <button
            type="button"
            ref={backButtonRef}
            className="more-tab__back-btn"
            onClick={goBack}
            aria-label="Back to settings menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20" aria-hidden="true"><path d="M19 12H5" /><polyline points="12 19 5 12 12 5" /></svg>
          </button>
          <h1 ref={subViewHeadingRef} className="more-tab__title" tabIndex={-1}>App Preferences</h1>
        </header>

        <section className="more-tab__section">
          <AppPreferences
            theme={themePreference}
            onChange={(key, value) => {
              if (key === 'theme' && typeof value === 'string') {
                setThemePreference(value as 'light' | 'dark' | 'system');
              }
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
      <div className="more-tab more-tab--sub-view" role="region" aria-label="Integrations settings">
        <header className="more-tab__header">
          <button
            type="button"
            ref={backButtonRef}
            className="more-tab__back-btn"
            onClick={goBack}
            aria-label="Back to settings menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20" aria-hidden="true"><path d="M19 12H5" /><polyline points="12 19 5 12 12 5" /></svg>
          </button>
          <h1 ref={subViewHeadingRef} className="more-tab__title" tabIndex={-1}>Integrations</h1>
        </header>

        <section className="more-tab__section">
          {showCatalog ? (
            <>
              <IntegrationCatalog
                onBack={() => setShowCatalog(false)}
                onConnected={() => setShowCatalog(false)}
              />
            </>
          ) : (
            <>
              <ConnectedIntegrations onAddIntegration={() => setShowCatalog(true)} />
            </>
          )}
        </section>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Account sub-view
  // -------------------------------------------------------------------------
  if (activeSubView === 'account') {
    return (
      <div className="more-tab more-tab--sub-view" role="region" aria-label="Account management settings">
        <header className="more-tab__header">
          <button
            type="button"
            ref={backButtonRef}
            className="more-tab__back-btn"
            onClick={goBack}
            aria-label="Back to settings menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20" aria-hidden="true"><path d="M19 12H5" /><polyline points="12 19 5 12 12 5" /></svg>
          </button>
          <h1 ref={subViewHeadingRef} className="more-tab__title" tabIndex={-1}>Account</h1>
        </header>

        <section className="more-tab__section">

          {/* Change Password - only for email/password users */}
          {isEmailUser === true && (
            <div className="more-tab__account-action">
              <p className="more-tab__account-action-description">Update your account password</p>
              {!showChangePassword && (
                <button
                  type="button"
                  className="more-tab__btn-secondary"
                  onClick={() => setShowChangePassword(true)}
                  aria-label="Change password"
                >
                  Change Password
                </button>
              )}
              {showChangePassword && (
                <form
                  className="more-tab__password-form"
                  onSubmit={handleChangePassword}
                  aria-label="Change password form"
                >
                  {passwordSuccess && (
                    <p className="more-tab__password-success" role="status">
                      Password updated successfully.
                    </p>
                  )}
                  {passwordError && (
                    <div className="more-tab__error-container" role="alert">
                      <p className="more-tab__save-error">{passwordError}</p>
                      {isSessionExpiredError(passwordError) && (
                        <button
                          type="button"
                          className="more-tab__btn-secondary"
                          onClick={onSignOut}
                          aria-label="Sign in again"
                        >
                          Sign in again
                        </button>
                      )}
                    </div>
                  )}
                  <div className="more-tab__password-field">
                    <label htmlFor="new-password" className="more-tab__password-label">
                      New Password
                    </label>
                    <input
                      id="new-password"
                      type="password"
                      className="more-tab__profile-input"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      minLength={8}
                      placeholder="Minimum 8 characters"
                      disabled={passwordSaving}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                  <div className="more-tab__password-field">
                    <label htmlFor="confirm-password" className="more-tab__password-label">
                      Confirm Password
                    </label>
                    <input
                      id="confirm-password"
                      type="password"
                      className="more-tab__profile-input"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      minLength={8}
                      placeholder="Re-enter new password"
                      disabled={passwordSaving}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                  <div className="more-tab__password-actions">
                    <button
                      type="button"
                      className="more-tab__btn-cancel"
                      onClick={handleCancelChangePassword}
                      disabled={passwordSaving}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="more-tab__btn-save"
                      disabled={passwordSaving || newPassword.length < 8 || !confirmPassword}
                    >
                      {passwordSaving ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* OAuth-only notice */}
          {isEmailUser === false && (
            <p className="more-tab__oauth-notice" role="note">
              Password management is not available for accounts using Google sign-in
            </p>
          )}

          {/* Loading state while detecting auth method */}
          {isEmailUser === null && (
            <p className="more-tab__placeholder-note">Loading account details...</p>
          )}
        </section>

        {/* Export Data */}
        <section className="more-tab__section" aria-labelledby="account-export-heading">
          <h2 id="account-export-heading" className="more-tab__section-title">Export Data</h2>
          <p className="more-tab__account-action-description">Download a copy of your profile and task data</p>
          <div className="more-tab__export-buttons">
            <button type="button" className="more-tab__btn-secondary" onClick={handleExportData} disabled={exporting}>
              {exporting ? 'Exporting...' : 'Export JSON'}
            </button>
            <button type="button" className="more-tab__btn-secondary" onClick={handleExportCSV} disabled={exporting}>
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
          {exportError && (
            <div className="more-tab__error-container" role="alert">
              <p className="more-tab__save-error">{exportError}</p>
              {isSessionExpiredError(exportError) && (
                <button
                  type="button"
                  className="more-tab__btn-secondary"
                  onClick={onSignOut}
                  aria-label="Sign in again"
                >
                  Sign in again
                </button>
              )}
            </div>
          )}
        </section>

        {/* Danger Zone */}
        <section className="more-tab__section more-tab__danger-zone" aria-labelledby="account-danger-zone-heading">
          <h2 id="account-danger-zone-heading" className="more-tab__section-title">Danger Zone</h2>
          <p className="more-tab__danger-description">
            Permanently delete your account and all associated data. This cannot be undone.
          </p>
          {onDeleteAccount && (
            <button
              type="button"
              className="more-tab__danger-btn"
              onClick={() => { setDeleteError(null); setShowDeleteConfirm(true); }}
              disabled={deleting}
              aria-label="Delete account"
            >
              {deleting ? 'Deleting...' : 'Delete Account'}
            </button>
          )}
          {deleteError && (
            <div className="more-tab__error-container" role="alert">
              <p className="more-tab__save-error">{deleteError}</p>
              {isSessionExpiredError(deleteError) && (
                <button
                  type="button"
                  className="more-tab__btn-secondary"
                  onClick={onSignOut}
                  aria-label="Sign in again"
                >
                  Sign in again
                </button>
              )}
            </div>
          )}
        </section>

        {/* Delete Account Confirmation Dialog */}
        {showDeleteConfirm && (
          <div className="more-tab__confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-confirm-title-account">
            <div className="more-tab__confirm-dialog">
              <h3 id="delete-confirm-title-account" className="more-tab__confirm-title">Delete Account</h3>
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

  // -------------------------------------------------------------------------
  // Help sub-view
  // -------------------------------------------------------------------------
  if (activeSubView === 'help') {
    return (
      <section className="more-tab more-tab--sub-view" role="region" aria-label="Help">
        <header className="more-tab__sub-header">
          <button
            type="button"
            ref={backButtonRef}
            className="more-tab__back-btn"
            onClick={goBack}
            aria-label="Back to settings menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20" aria-hidden="true"><path d="M19 12H5" /><polyline points="12 19 5 12 12 5" /></svg>
          </button>
        </header>
        <div className="more-tab__help-content">
          <h2 ref={subViewHeadingRef} className="more-tab__help-title" tabIndex={-1}>How to use AdminI</h2>

          <div className="more-tab__help-section">
            <h3>📊 Dashboard</h3>
            <p>Your daily overview showing tasks, activity, and key metrics. Cards update in real-time as you complete work.</p>
          </div>

          <div className="more-tab__help-section">
            <h3>📝 Capture</h3>
            <p><strong>Voice:</strong> Tap the microphone to transcribe observations using speech recognition.</p>
            <p><strong>Tap:</strong> Use the word board for quick categorized captures, or type free-text notes.</p>
            <p><strong>Notes:</strong> Create, edit, and search meeting notes with attendee tracking.</p>
          </div>

          <div className="more-tab__help-section">
            <h3>✅ Tasks</h3>
            <p>Create tasks with titles, notes, due dates, and assignments. Use filter pills to view tasks by timeframe or delegation status. Tap the + button to add new tasks.</p>
          </div>

          <div className="more-tab__help-section">
            <h3>💓 Pulse</h3>
            <p>Track your daily rhythm with scheduled check-ins. The Day Structure shows your typical schedule blocks. Stats update as you complete work throughout the day.</p>
          </div>

          <div className="more-tab__help-section">
            <h3>⚙️ More (Settings)</h3>
            <p>Manage your profile, notification preferences, app theme, connected integrations, and account settings.</p>
          </div>

          <div className="more-tab__help-section">
            <h3>🔧 Admin</h3>
            <p>Organization management for admins and principals. Manage school details, team members, invitations, and feature flags. Contact support at <a href="mailto:ladariusdvs99@gmail.com">ladariusdvs99@gmail.com</a> for assistance.</p>
          </div>
        </div>
      </section>
    );
  }

  // -------------------------------------------------------------------------
  // Main menu view
  // -------------------------------------------------------------------------
  return (
    <div className={`more-tab${isReturning ? " more-tab--returning" : ""}`} role="region" aria-label="Settings menu" onAnimationEnd={() => setIsReturning(false)}>
      {/* Header */}
      <header className="more-tab__header">
        <h1 ref={menuHeadingRef} className="more-tab__title" tabIndex={-1}>Settings</h1>
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
                <span className="more-tab__admin-only-notice" role="note">Admin only &#x2014; only administrators or principals can change the school name.</span>
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
              <span className="more-tab__profile-value">{userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : 'Not provided'}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Settings Section */}
      <section className="more-tab__section" aria-labelledby="more-tab-settings-heading">
        <h2 id="more-tab-settings-heading" className="more-tab__section-title">Settings</h2>
        <ul className="more-tab__list" role="list">
          <li className="more-tab__list-item">
            <button type="button" className="more-tab__link-btn" onClick={(e) => navigateTo('profile', e)}>
              <span className="more-tab__link-icon" aria-hidden="true">{'\uD83D\uDC64'}</span>
              <span className="more-tab__link-label">Profile</span>
            </button>
          </li>
          <li className="more-tab__list-item">
            <button type="button" className="more-tab__link-btn" onClick={(e) => navigateTo('notifications', e)}>
              <span className="more-tab__link-icon" aria-hidden="true">{'\ud83d\udd14'}</span>
              <span className="more-tab__link-label">Notifications</span>
            </button>
          </li>
          <li className="more-tab__list-item">
            <button type="button" className="more-tab__link-btn" onClick={(e) => navigateTo('preferences', e)}>
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
            <button type="button" className="more-tab__link-btn" onClick={(e) => navigateTo('integrations', e)}>
              <span className="more-tab__link-icon" aria-hidden="true">{'\ud83d\udd17'}</span>
              <span className="more-tab__link-label">Connected Apps</span>
            </button>
          </li>
          <li className="more-tab__list-item">
            <button type="button" className="more-tab__link-btn" onClick={(e) => { setShowCatalog(true); navigateTo('integrations', e); }}>
              <span className="more-tab__link-icon" aria-hidden="true">{'\u2795'}</span>
              <span className="more-tab__link-label">Add Integration</span>
            </button>
          </li>
        </ul>
      </section>

      {/* Account Actions Section */}
      <section className="more-tab__section" aria-labelledby="more-tab-account-heading">
        <h2 id="more-tab-account-heading" className="more-tab__section-title">Account</h2>
        <ul className="more-tab__list" role="list">
          <li className="more-tab__list-item">
            <button type="button" className="more-tab__link-btn" onClick={(e) => navigateTo('account', e)}>
              <span className="more-tab__link-icon" aria-hidden="true">{'\uD83D\uDEE0\uFE0F'}</span>
              <span className="more-tab__link-label">Manage Account</span>
            </button>
          </li>
          <li className="more-tab__list-item">
            <button type="button" className="more-tab__link-btn" onClick={(e) => navigateTo('help', e)}>
              <span className="more-tab__link-icon" aria-hidden="true">{'\u2753'}</span>
              <span className="more-tab__link-label">Help</span>
            </button>
          </li>
        </ul>
        <div className="more-tab__actions">
          <button
            type="button"
            className="more-tab__sign-out-btn"
            onClick={onSignOut}
          >
            Sign Out
          </button>
          {onDeleteAccount && (userRole === 'admin' || userRole === 'principal') && (
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
          {(userRole !== 'admin' && userRole !== 'principal') && (
            <p className="more-tab__account-action-description">
              Account deletion requires admin permission. Contact <a href="mailto:ladariusdvs99@gmail.com">support</a> for assistance.
            </p>
          )}
          {deleteError && (
            <div className="more-tab__error-container" role="alert">
              <p className="more-tab__save-error">{deleteError}</p>
              {isSessionExpiredError(deleteError) && (
                <button
                  type="button"
                  className="more-tab__btn-secondary"
                  onClick={onSignOut}
                  aria-label="Sign in again"
                >
                  Sign in again
                </button>
              )}
            </div>
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

