import { useState } from 'react';
import type { NavigationAdapterProps, WorkspaceTab } from '@admini/workspace';

// Same SVG icon paths as DesktopSidebar for visual consistency
const ICON_PATHS: Record<string, string> = {
  capture: 'M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM5 10v1a7 7 0 0 0 14 0v-1M12 18v4M8 22h8',
  dashboard: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  tasks: 'M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2',
  notes: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5',
  observations: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  pulse: 'M22 12h-4l-3 9L9 3l-3 9H2',
  more: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  admin: 'M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6',
};

function TabIcon({ id }: { id: string }) {
  const d = ICON_PATHS[id] || ICON_PATHS.dashboard;
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

export function MobileHamburger({ activeTab, tabs, onTabChange, onSignOut, unreadNotificationCount }: NavigationAdapterProps) {
  const [open, setOpen] = useState(false);

  function handleTabSelect(tabId: string) {
    onTabChange(tabId as WorkspaceTab);
    setOpen(false);
  }

  const triggerClass = 'mobile-nav-trigger' + (open ? ' mobile-nav-trigger--open' : '');
  const drawerClass = 'mobile-nav-drawer' + (open ? ' mobile-nav-drawer--open' : '');
  const badgeLabel = unreadNotificationCount && unreadNotificationCount > 99 ? '99+' : String(unreadNotificationCount ?? 0);

  return (
    <>
      <button
        type="button"
        className={triggerClass}
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
      >
        <span className="mobile-nav-trigger__icon" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        {unreadNotificationCount && unreadNotificationCount > 0 && (
          <span className="mobile-nav-trigger__badge" aria-label={String(unreadNotificationCount) + ' unread notifications'}>
            {badgeLabel}
          </span>
        )}
      </button>
      <div className={drawerClass}>
        <div className="mobile-nav-drawer__backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
        <nav className="mobile-nav-drawer__panel" aria-label="Workspace navigation">
          <div className="mobile-nav-drawer__brand">AdminI.</div>
          <ul className="mobile-nav-drawer__tabs" role="tablist">
            {tabs.map((tab) => {
              const tabClass = 'mobile-nav-drawer__tab' + (activeTab === tab.id ? ' mobile-nav-drawer__tab--active' : '');
              return (
                <li key={tab.id} role="presentation">
                  <button
                    type="button"
                    role="tab"
                    className={tabClass}
                    onClick={() => handleTabSelect(tab.id)}
                    aria-selected={activeTab === tab.id}
                  >
                    <span className="mobile-nav-drawer__tab-icon"><TabIcon id={tab.id} /></span>
                    <span className="mobile-nav-drawer__tab-label">{tab.label}</span>
                    {tab.id === 'notifications' && unreadNotificationCount && unreadNotificationCount > 0 && (
                      <span className="mobile-nav-drawer__badge" aria-label={String(unreadNotificationCount) + ' unread notifications'}>
                        {badgeLabel}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          {onSignOut && (
            <button
              type="button"
              className="mobile-nav-drawer__sign-out"
              onClick={() => { onSignOut(); setOpen(false); }}
              aria-label="Sign out"
            >
              <LogoutIcon />
              <span>Sign Out</span>
            </button>
          )}
        </nav>
      </div>
    </>
  );
}