// ---------------------------------------------------------------------------
// DesktopSidebar - Desktop navigation sidebar with role-gating
// ---------------------------------------------------------------------------
// Pure presentational component. Renders navigation tabs filtered by user role.
// Requirements: 4.1, 4.2, 4.3, 4.4, 4.5

import type { ReactNode } from 'react';
import type { WorkspaceTab, AdminiRole } from '../types';
import '../styles/desktop-sidebar.css';

export interface DesktopSidebarTabItem {
  id: WorkspaceTab;
  label: string;
  icon: ReactNode;
  requiredRoles?: AdminiRole[];
}

export interface DesktopSidebarProps {
  activeTab: WorkspaceTab;
  tabs: DesktopSidebarTabItem[];
  userRole: AdminiRole;
  onTabChange: (tabId: WorkspaceTab) => void;
  onSignOut?: () => void;
}

/**
 * Filters tabs based on user role. A tab is visible if:
 * - It has no `requiredRoles` (available to everyone), OR
 * - Its `requiredRoles` array includes the current `userRole`
 */
export function filterTabsByRole(tabs: DesktopSidebarTabItem[], userRole: AdminiRole): DesktopSidebarTabItem[] {
  return tabs.filter(tab => {
    if (!tab.requiredRoles || tab.requiredRoles.length === 0) {
      return true;
    }
    return tab.requiredRoles.includes(userRole);
  });
}

export function DesktopSidebar({
  activeTab,
  tabs,
  userRole,
  onTabChange,
  onSignOut,
}: DesktopSidebarProps) {
  const visibleTabs = filterTabsByRole(tabs, userRole);

  return (
    <nav className="ds-sidebar" aria-label="Workspace navigation">
      <div className="ds-sidebar__brand">AdminI.</div>
      <ul className="ds-sidebar__tabs" role="tablist">
        {visibleTabs.map((tab) => (
          <li key={tab.id} role="presentation">
            <button
              type="button"
              role="tab"
              className={`ds-sidebar__tab${activeTab === tab.id ? ' ds-sidebar__tab--active' : ''}`}
              onClick={() => onTabChange(tab.id)}
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
            >
              <span className="ds-sidebar__icon" aria-hidden="true">
                {tab.icon}
              </span>
              <span className="ds-sidebar__label">{tab.label}</span>
            </button>
          </li>
        ))}
      </ul>
      {onSignOut && (
        <button
          type="button"
          className="ds-sidebar__sign-out"
          onClick={onSignOut}
          aria-label="Sign out"
        >
          Sign Out
        </button>
      )}
    </nav>
  );
}