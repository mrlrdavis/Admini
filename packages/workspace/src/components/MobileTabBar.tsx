// ---------------------------------------------------------------------------
// MobileTabBar - Fixed bottom tab bar for mobile viewports (<=900px)
// ---------------------------------------------------------------------------
// Pure presentational component. Renders a bottom tab bar with role-gating.
// Uses same filterTabsByRole logic as DesktopSidebar.
// Requirements: 1.4, 4.4

import type { ReactNode } from 'react';
import type { WorkspaceTab, AdminiRole } from '../types';
import '../styles/mobile-tab-bar.css';

export interface MobileTabBarTabItem {
  id: WorkspaceTab;
  label: string;
  icon: ReactNode;
  requiredRoles?: AdminiRole[];
}

export interface MobileTabBarProps {
  activeTab: WorkspaceTab;
  tabs: MobileTabBarTabItem[];
  userRole: AdminiRole;
  onTabChange: (tabId: WorkspaceTab) => void;
  onSignOut?: () => void;
}

/**
 * Filters tabs based on user role. A tab is visible if:
 * - It has no `requiredRoles` (available to everyone), OR
 * - Its `requiredRoles` array includes the current `userRole`
 */
export function filterTabsByRole(tabs: MobileTabBarTabItem[], userRole: AdminiRole): MobileTabBarTabItem[] {
  return tabs.filter((tab) => {
    if (!tab.requiredRoles || tab.requiredRoles.length === 0) {
      return true;
    }
    return tab.requiredRoles.includes(userRole);
  });
}

export function MobileTabBar({
  activeTab,
  tabs,
  userRole,
  onTabChange,
}: MobileTabBarProps) {
  const visibleTabs = filterTabsByRole(tabs, userRole);

  return (
    <nav className="mobile-tab-bar" aria-label="Mobile navigation" role="tablist">
      {visibleTabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            className={`mobile-tab-bar__item${isActive ? ' mobile-tab-bar__item--active' : ''}`}
            onClick={() => onTabChange(tab.id)}
            aria-selected={isActive}
            aria-controls={`panel-${tab.id}`}
            aria-label={tab.label}
          >
            <span className="mobile-tab-bar__icon" aria-hidden="true">
              {tab.icon}
            </span>
            <span className="mobile-tab-bar__label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
