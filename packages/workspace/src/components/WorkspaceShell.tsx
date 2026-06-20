// ---------------------------------------------------------------------------
// WorkspaceShell - Platform-agnostic shell component
// ---------------------------------------------------------------------------
// Manages tab state, role-gated tab visibility, native tab routing,
// and IframeFallback for unconverted tabs.
// Requirements: 4.1, 4.4, 4.5, 6.2, 6.4, 7.2

import { useState, useMemo, useEffect, useCallback, type ReactNode } from 'react';
import type { WorkspaceTab, TabItem, WorkspaceShellProps } from '../types';
import { DashboardTab } from './DashboardTab';
import { AdminTab } from './AdminTab';
import { CaptureTab } from './CaptureTab';
import { TasksTab } from './TasksTab';
import { PulseTab } from './PulseTab';
import { NotificationsTab } from './NotificationsTab';
import { MoreTab } from './MoreTab';
import { NotesTab } from './NotesTab';
import { ObservationsTab } from './ObservationsTab';
import { IframeFallback } from './IframeFallback';
import { ToastContainer } from './Toast';
import { getAppPreferences } from '../services/appPreferencesStorage';
import { loadNotificationPreferences } from '../services/notificationPreferences';
import { getUnreadNotificationCount, NOTIFICATIONS_UPDATED_EVENT } from '../services/notificationService';

/** Set of tabs with native React implementations. */
export const NATIVE_TABS: ReadonlySet<WorkspaceTab> = new Set([
  'dashboard', 'admin', 'capture', 'tasks', 'notes', 'pulse', 'notifications', 'more', 'observations',
]);

export function WorkspaceShell({
  user,
  userRole,
  organizationId,
  userName,
  schoolName,
  prototypePath,
  onSignOut,
  onDeleteAccount,
  onResetUserData,
  onProfileUpdated,
  renderNavigation,
}: WorkspaceShellProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('dashboard');
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const loadUnreadNotificationCount = useCallback(async () => {
    try {
      const [preferences, count] = await Promise.all([
        loadNotificationPreferences(user.id),
        getUnreadNotificationCount(),
      ]);
      setUnreadNotificationCount(preferences.pushNotifications ? count : 0);
    } catch {
      setUnreadNotificationCount(0);
    }
  }, [user.id]);

  useEffect(() => {
    loadUnreadNotificationCount();
  }, [loadUnreadNotificationCount]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadUnreadNotificationCount();
    };
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, loadUnreadNotificationCount);
    window.addEventListener('focus', loadUnreadNotificationCount);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, loadUnreadNotificationCount);
      window.removeEventListener('focus', loadUnreadNotificationCount);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadUnreadNotificationCount]);

  // Dashboard is always the landing tab

  // Admin/principal can access the admin tab (REQ-16)
  const canAccessAdmin = userRole === 'admin' || userRole === 'principal';

  // Role guard: redirect non-admin/principal users away from the admin tab
  useEffect(() => {
    if (activeTab === 'admin' && !canAccessAdmin) {
      setActiveTab('dashboard');
    }
  }, [activeTab, canAccessAdmin]);

  // Build tab list, conditionally including Observations and Admin for admin/principal roles
  const visibleTabs: TabItem[] = useMemo(() => {
    const base: TabItem[] = [
      { id: 'capture', label: 'Capture' },
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'tasks', label: 'Tasks' },
      { id: 'notes', label: 'Notes' },
      { id: 'pulse', label: 'Pulse' },
      { id: 'notifications', label: 'Notifications' },
      { id: 'more', label: 'Settings' },
    ];
    if (canAccessAdmin) {
      base.splice(3, 0, { id: 'observations', label: 'Observations' });
      base.push({ id: 'admin', label: 'Admin' });
    }
    return base;
  }, [canAccessAdmin]);

  // IframeFallback visibility
  const iframeVisible = !NATIVE_TABS.has(activeTab);

  // User payload for iframe bridge.
  // Must match the format expected by prototype HTML message listeners:
  // type: 'user' with name, email, schoolName, role at root level.
  const userPayload = useMemo(() => ({
    type: 'user',
    name: userName,
    email: user.email ?? '',
    schoolName,
    role: userRole,
  }), [user.email, userName, schoolName, userRole]);

  function handleTabChange(tabId: string) {
    setActiveTab(tabId as WorkspaceTab);
  }

  function renderTabContent(): ReactNode {
    switch (activeTab) {
      case 'dashboard': return <DashboardTab userName={userName} userId={user.id} organizationId={organizationId} onTabChange={handleTabChange} />;
      case 'admin': return canAccessAdmin && organizationId ? <AdminTab organizationId={organizationId} userRole={userRole} /> : <div className="admin-tab admin-tab--empty"><p>Complete onboarding to access Admin settings.</p></div>;
      case 'capture': return <CaptureTab userId={user.id} organizationId={organizationId} />;
      case 'tasks': return <TasksTab userId={user.id} organizationId={organizationId} userRole={userRole} />;
      case 'notes': return <NotesTab userId={user.id} organizationId={organizationId} onTabChange={handleTabChange} />;
      case 'observations': return <ObservationsTab userId={user.id} organizationId={organizationId} userName={userName} userRole={userRole} />;
      case 'pulse': return <PulseTab />;
      case 'notifications': return <NotificationsTab userId={user.id} onTabChange={handleTabChange} />;
      case 'more': return <MoreTab onSignOut={onSignOut} onDeleteAccount={onDeleteAccount} userRole={userRole} userName={userName} schoolName={schoolName} email={user.email ?? ''} onProfileUpdated={onProfileUpdated} />;
      default: return null;
    }
  }

  return (
    <>
      {renderNavigation({ activeTab, tabs: visibleTabs, onTabChange: handleTabChange, onSignOut, userId: user.id, userName, userRole, schoolName, unreadNotificationCount })}
      <div className="workspace-shell__content">
        {NATIVE_TABS.has(activeTab) && renderTabContent()}
      </div>
      <IframeFallback
        src={prototypePath}
        visible={iframeVisible}
        userPayload={userPayload}
        userRole={userRole}
        onSignOut={onSignOut}
        onResetUserData={onResetUserData}
        onProfileUpdated={onProfileUpdated}
      />
      <ToastContainer />
    </>
  );
}
