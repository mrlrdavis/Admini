// ---------------------------------------------------------------------------
// WorkspaceShell - Platform-agnostic shell component
// ---------------------------------------------------------------------------
// Manages tab state, role-gated tab visibility, native tab routing,
// and IframeFallback for unconverted tabs.
// Requirements: 4.1, 4.4, 4.5, 6.2, 6.4, 7.2

import { useState, useMemo, useEffect, type ReactNode } from 'react';
import type { WorkspaceTab, TabItem, WorkspaceShellProps } from '../types';
import { DashboardTab } from './DashboardTab';
import { AdminTab } from './AdminTab';
import { CaptureTab } from './CaptureTab';
import { TasksTab } from './TasksTab';
import { PulseTab } from './PulseTab';
import { MoreTab } from './MoreTab';
import { IframeFallback } from './IframeFallback';

/** Set of tabs with native React implementations. */
export const NATIVE_TABS: ReadonlySet<WorkspaceTab> = new Set([
  'dashboard', 'admin', 'capture', 'tasks', 'pulse', 'more',
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

  // Admin/principal can access the admin tab (REQ-16)
  const canAccessAdmin = userRole === 'admin' || userRole === 'principal';

  // Role guard: redirect non-admin/principal users away from the admin tab
  useEffect(() => {
    if (activeTab === 'admin' && !canAccessAdmin) {
      setActiveTab('dashboard');
    }
  }, [activeTab, canAccessAdmin]);

  // Build tab list, conditionally including Admin for admin/principal roles
  const visibleTabs: TabItem[] = useMemo(() => {
    const base: TabItem[] = [
      { id: 'capture', label: 'Capture' },
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'tasks', label: 'Tasks' },
      { id: 'pulse', label: 'Pulse' },
      { id: 'more', label: 'More' },
    ];
    if (canAccessAdmin) {
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
      case 'dashboard': return <DashboardTab userName={userName} />;
      case 'admin': return canAccessAdmin ? <AdminTab organizationId={organizationId ?? user.id} userRole={userRole} /> : null;
      case 'capture': return <CaptureTab userId={user.id} organizationId={organizationId} />;
      case 'tasks': return <TasksTab />;
      case 'pulse': return <PulseTab />;
      case 'more': return <MoreTab onSignOut={onSignOut} onDeleteAccount={onDeleteAccount} userRole={userRole} userName={userName} schoolName={schoolName} email={user.email ?? ''} onProfileUpdated={onProfileUpdated} />;
      default: return null;
    }
  }

  return (
    <>
      {renderNavigation({ activeTab, tabs: visibleTabs, onTabChange: handleTabChange })}
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
    </>
  );
}
