import { useState, useMemo, useEffect } from 'react';
import { LayoutShell, TabBar } from '@admini/ui';
import type { TabItem } from '@admini/ui';
import type { AuthUser } from '../supabase';
import type { WorkspaceTab } from './types';
import { DashboardTab } from './DashboardTab';
import { AdminTab } from './AdminTab';
import { IframeFallback } from './IframeFallback';

// ---------------------------------------------------------------------------
// WorkspaceShell
// ---------------------------------------------------------------------------
// Top-level workspace container that manages tab state, role-gated navigation,
// and the hybrid native/iframe rendering strategy.
// Requirements: 1.1, 1.2, 1.3, 1.4, 2.2, 2.3, 2.4, 2.6, 5.1, 5.2, 5.3

export interface WorkspaceShellProps {
  user: AuthUser;
  userRole: string;
  userName: string;
  schoolName: string;
  prototypePath: string;
  onSignOut: () => void;
  onResetUserData: () => void;
}

/** Set of tabs that have been converted to native React components. */
const NATIVE_TABS: ReadonlySet<WorkspaceTab> = new Set(['dashboard', 'admin']);

export function WorkspaceShell({
  user,
  userRole,
  userName,
  schoolName,
  prototypePath,
  onSignOut,
  onResetUserData,
}: WorkspaceShellProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('dashboard');

  // Role guard: redirect non-admin users away from the admin tab
  useEffect(() => {
    if (activeTab === 'admin' && userRole !== 'admin') {
      setActiveTab('dashboard');
    }
  }, [activeTab, userRole]);

  // Build tab configuration, conditionally including Admin for admin role
  const tabs: TabItem[] = useMemo(() => {
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

  // Determine iframe visibility: visible when active tab is NOT a native tab
  const iframeVisible = !NATIVE_TABS.has(activeTab);

  // Build the user payload for the iframe postMessage bridge
  const userPayload = useMemo(
    () => ({
      type: 'user-data',
      user: {
        id: user.id,
        email: user.email,
        displayName: userName,
        schoolName,
      },
      role: userRole,
    }),
    [user.id, user.email, userName, schoolName, userRole]
  );

  function handleTabChange(tabId: string) {
    setActiveTab(tabId as WorkspaceTab);
  }

  return (
    <LayoutShell
      bottomBar={
        <TabBar tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />
      }
    >
      {/* Native tabs render conditionally */}
      {activeTab === 'dashboard' && <DashboardTab userName={userName} />}
      {activeTab === 'admin' && userRole === 'admin' && (
        <AdminTab organizationId={user.id} />
      )}

      {/* Iframe is always mounted, visibility toggled */}
      <IframeFallback
        src={prototypePath}
        visible={iframeVisible}
        userPayload={userPayload}
        onSignOut={onSignOut}
        onResetUserData={onResetUserData}
      />
    </LayoutShell>
  );
}
