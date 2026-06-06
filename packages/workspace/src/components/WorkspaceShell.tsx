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
  userName,
  schoolName,
  prototypePath,
  onSignOut,
  onResetUserData,
  renderNavigation,
}: WorkspaceShellProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('dashboard');

  // Role guard: redirect non-admin users away from the admin tab
  useEffect(() => {
    if (activeTab === 'admin' && userRole !== 'admin') {
      setActiveTab('dashboard');
    }
  }, [activeTab, userRole]);

  // Build tab list, conditionally including Admin for admin role
  const visibleTabs: TabItem[] = useMemo(() => {
    const base: TabItem[] = [
      { id: 'capture', label: 'Capture' },
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'tasks', label: 'Tasks' },
      { id: 'pulse', label: 'Pulse' },
      { id: 'more', label: 'More' },
    ];
    if (userRole === 'admin') {
      base.push({ id: 'admin', label: 'Admin' });
    }
    return base;
  }, [userRole]);

  // IframeFallback visibility
  const iframeVisible = !NATIVE_TABS.has(activeTab);

  // User payload for iframe bridge
  const userPayload = useMemo(() => ({
    type: 'user-data',
    user: { id: user.id, email: user.email, displayName: userName, schoolName },
    role: userRole,
  }), [user.id, user.email, userName, schoolName, userRole]);

  function handleTabChange(tabId: string) {
    setActiveTab(tabId as WorkspaceTab);
  }

  function renderTabContent(): ReactNode {
    switch (activeTab) {
      case 'dashboard': return <DashboardTab userName={userName} />;
      case 'admin': return userRole === 'admin' ? <AdminTab organizationId={user.id} /> : null;
      case 'capture': return <CaptureTab />;
      case 'tasks': return <TasksTab />;
      case 'pulse': return <PulseTab />;
      case 'more': return <MoreTab onSignOut={onSignOut} />;
      default: return null;
    }
  }

  return (
    <>
      {renderNavigation({ activeTab, tabs: visibleTabs, onTabChange: handleTabChange })}
      {NATIVE_TABS.has(activeTab) && renderTabContent()}
      <IframeFallback
        src={prototypePath}
        visible={iframeVisible}
        userPayload={userPayload}
        onSignOut={onSignOut}
        onResetUserData={onResetUserData}
      />
    </>
  );
}
