// ---------------------------------------------------------------------------
// NavigationRenderer - Responsive navigation switch with tab state machine
// ---------------------------------------------------------------------------
// Renders DesktopSidebar above 900px, MobileTabBar at/below 900px.
// Implements the Tab Navigation state machine:
//   idle + TAB_CLICK(tabId) ->
//     1. Dismiss open modals (AchievementsModal, task-creation modals)
//     2. Set activeTab = tabId
//     3. Reset scroll position to top for target tab
//     4. Preserve filter selections within each tab (component state retained)
//     5. -> idle
// Requirements: 1.4, 4.5

import { useState, useEffect, useCallback } from 'react';
import type { WorkspaceTab, AdminiRole } from '../types';
import { DesktopSidebar } from './DesktopSidebar';
import type { DesktopSidebarTabItem } from './DesktopSidebar';
import { MobileTabBar } from './MobileTabBar';

const DESKTOP_BREAKPOINT = 900;

export interface NavigationRendererProps {
  activeTab: WorkspaceTab;
  userRole: AdminiRole;
  onTabChange: (tabId: WorkspaceTab) => void;
  onSignOut?: () => void;
}

/**
 * Default tabs configuration for the application.
 * Tab order: Capture, Dashboard, Tasks, Notes, Observations, Pulse, Settings, Admin
 * Admin and Observations require 'admin' or 'principal' role.
 */
export const DEFAULT_TABS: DesktopSidebarTabItem[] = [
  { id: 'capture', label: 'Capture', icon: '📝' },
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'tasks', label: 'Tasks', icon: '✓' },
  { id: 'notes', label: 'Notes', icon: '📒' },
  { id: 'observations', label: 'Observations', icon: '👁', requiredRoles: ['admin', 'principal'] },
  { id: 'pulse', label: 'Pulse', icon: '❤️' },
  { id: 'more', label: 'Settings', icon: '⚙' },
  { id: 'admin', label: 'Admin', icon: '🔧', requiredRoles: ['admin', 'principal'] },
];

/**
 * Custom hook to detect whether the viewport width is above the desktop breakpoint.
 * Uses window.matchMedia for efficient, event-driven detection.
 */
export function useIsDesktop(breakpoint: number = DESKTOP_BREAKPOINT): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth > breakpoint;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(`(min-width: ${breakpoint + 1}px)`);
    setIsDesktop(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setIsDesktop(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [breakpoint]);

  return isDesktop;
}

/**
 * Dismisses any open modals by dispatching a custom event.
 * Components with modals (AchievementsModal, task-creation modals) listen
 * for this event and close themselves.
 */
function dismissOpenModals(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('admini:dismiss-modals'));
  }
}

/**
 * Resets the scroll position to the top of the page.
 */
function resetScrollPosition(): void {
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
}

/**
 * NavigationRenderer - Responsive navigation that switches between
 * DesktopSidebar (>900px) and MobileTabBar (<=900px).
 *
 * Implements tab navigation state machine transitions on TAB_CLICK:
 * 1. Dismiss any open modals
 * 2. Set activeTab via onTabChange callback
 * 3. Reset scroll position to top
 * 4. Preserve filter state (handled by component state retention - no explicit reset)
 */
export function NavigationRenderer({
  activeTab,
  userRole,
  onTabChange,
  onSignOut,
}: NavigationRendererProps) {
  const isDesktop = useIsDesktop();

  /**
   * Tab navigation state machine handler.
   * Executes the transition sequence before delegating to onTabChange.
   */
  const handleTabChange = useCallback(
    (tabId: WorkspaceTab) => {
      // Skip if clicking the already-active tab
      if (tabId === activeTab) return;

      // 1. Dismiss any open modals
      dismissOpenModals();

      // 2. Set activeTab (delegated to parent via callback)
      onTabChange(tabId);

      // 3. Reset scroll position to top for target tab
      resetScrollPosition();

      // 4. Preserve filter selections (no-op: React component state is
      //    retained because tab content components remain mounted or
      //    their state is lifted to the parent)
    },
    [activeTab, onTabChange],
  );

  if (isDesktop) {
    return (
      <DesktopSidebar
        activeTab={activeTab}
        tabs={DEFAULT_TABS}
        userRole={userRole}
        onTabChange={handleTabChange}
        onSignOut={onSignOut}
      />
    );
  }

  return (
    <MobileTabBar
      activeTab={activeTab}
      tabs={DEFAULT_TABS}
      userRole={userRole}
      onTabChange={handleTabChange}
      onSignOut={onSignOut}
    />
  );
}
