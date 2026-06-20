import { useCallback, useState, useRef, useEffect } from 'react';
import type { NavigationAdapterProps, WorkspaceTab } from '@admini/workspace';
import { notificationPreferencesService, notificationService } from '@admini/workspace';
import { useInstallPrompt } from '@admini/pwa';

const ICON_PATHS: Record<string, string> = {
  // mic
  capture: 'M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM5 10v1a7 7 0 0 0 14 0v-1M12 18v4M8 22h8',
  // grid dashboard
  dashboard: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  // checklist tasks
  tasks: 'M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2',
  // document notes
  notes: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5',
  // eye observations
  observations: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  // heartbeat pulse
  pulse: 'M22 12h-4l-3 9L9 3l-3 9H2',
  // gear settings
  more: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  // school building admin
  admin: 'M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6',
};

function TabIcon({ id }: { id: string }) {
  const d = ICON_PATHS[id] || ICON_PATHS.dashboard;
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

function CollapseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
    </svg>
  );
}

const CORE_TAB_IDS = ['capture', 'dashboard', 'tasks', 'notes', 'observations', 'pulse'];

export function DesktopSidebar({ activeTab, tabs, onTabChange, onSignOut, onShowPwaInstall, userId, userName, userRole, schoolName }: NavigationAdapterProps) {
  const { isInstallable, isStandalone, promptInstall } = useInstallPrompt();
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const loadUnreadCount = useCallback(async () => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }

    try {
      const [preferences, count] = await Promise.all([
        notificationPreferencesService.loadNotificationPreferences(userId),
        notificationService.getUnreadNotificationCount(),
      ]);
      setUnreadCount(preferences.pushNotifications ? count : 0);
    } catch {
      setUnreadCount(0);
    }
  }, [userId]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  useEffect(() => {
    loadUnreadCount();
  }, [loadUnreadCount]);

  useEffect(() => {
    if (menuOpen) loadUnreadCount();
  }, [menuOpen, loadUnreadCount]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') loadUnreadCount();
    };
    window.addEventListener(notificationService.NOTIFICATIONS_UPDATED_EVENT, loadUnreadCount);
    window.addEventListener('focus', loadUnreadCount);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener(notificationService.NOTIFICATIONS_UPDATED_EVENT, loadUnreadCount);
      window.removeEventListener('focus', loadUnreadCount);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadUnreadCount]);

  const coreTabs = tabs.filter(t => CORE_TAB_IDS.includes(t.id));
  const hasAdmin = tabs.some(t => t.id === 'admin');
  const initial = (userName || 'U').trim().charAt(0).toUpperCase();
  const roleSchool = [userRole, schoolName].filter(Boolean).join(' · ');
  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <nav className={'desktop-sidebar' + (collapsed ? ' desktop-sidebar--collapsed' : '')} aria-label="Workspace navigation">
      <div className="desktop-sidebar__top">
        {!collapsed && <div className="desktop-sidebar__brand">AdminI.</div>}
        <button type="button" className="desktop-sidebar__collapse-btn" onClick={() => setCollapsed(c => !c)} aria-label="Toggle sidebar" title="Collapse sidebar"><CollapseIcon /></button>
      </div>
      <ul className="desktop-sidebar__tabs" role="tablist">
        {coreTabs.map((tab) => (
          <li key={tab.id} role="presentation">
            <button
              type="button"
              role="tab"
              className={'desktop-sidebar__tab' + (activeTab === tab.id ? ' desktop-sidebar__tab--active' : '')}
              onClick={() => onTabChange(tab.id as WorkspaceTab)}
              aria-selected={activeTab === tab.id}
              title={tab.label}
            >
              <span className="desktop-sidebar__icon" aria-hidden="true"><TabIcon id={tab.id} /></span>
              {!collapsed && <span className="desktop-sidebar__label">{tab.label}</span>}
            </button>
          </li>
        ))}
      </ul>

      {/* Profile avatar + menu */}
      <div className="desktop-sidebar__profile" ref={menuRef}>
        {menuOpen && (
          <div className="desktop-sidebar__menu">
            {hasAdmin && (
              <button type="button" className="desktop-sidebar__menu-item" onClick={() => { onTabChange('admin' as WorkspaceTab); setMenuOpen(false); }}>
                <span className="desktop-sidebar__menu-icon">🏫</span> School settings
              </button>
            )}
            <button type="button" className="desktop-sidebar__menu-item" onClick={() => { onTabChange('more' as WorkspaceTab); setMenuOpen(false); }}>
              <span className="desktop-sidebar__menu-icon">⚙</span> Profile & settings
            </button>
            <button type="button" className="desktop-sidebar__menu-item" onClick={() => { onTabChange('notifications' as WorkspaceTab); setMenuOpen(false); }}>
              <span className="desktop-sidebar__menu-icon">🔔</span>
              <span className="desktop-sidebar__menu-label">Notifications</span>
              {unreadCount > 0 && (
                <span className="desktop-sidebar__menu-badge" aria-label={`${unreadCount} unread notifications`}>
                  {badgeLabel}
                </span>
              )}
            </button>
            {!isStandalone && (
              <button type="button" className="desktop-sidebar__menu-item" onClick={async () => { if (isInstallable) { await promptInstall(); } else if (onShowPwaInstall) { onShowPwaInstall(); } setMenuOpen(false); }}>
                <span className="desktop-sidebar__menu-icon">⬇</span> {isInstallable ? 'Install app' : 'Get app'}
              </button>
            )}
            {onSignOut && (
              <button type="button" className="desktop-sidebar__menu-item desktop-sidebar__menu-item--logout" onClick={onSignOut}>
                <span className="desktop-sidebar__menu-icon"><LogoutIcon /></span> Log out
              </button>
            )}
          </div>
        )}
        <button type="button" className="desktop-sidebar__avatar-btn" onClick={() => setMenuOpen(o => !o)} aria-label="Account menu">
          <span className="desktop-sidebar__avatar-wrap">
            <span className="desktop-sidebar__avatar">{initial}</span>
            {unreadCount > 0 && (
              <span className="desktop-sidebar__avatar-badge" aria-label={`${unreadCount} unread notifications`}>
                {badgeLabel}
              </span>
            )}
          </span>
          {!collapsed && (
            <span className="desktop-sidebar__avatar-text">
              <span className="desktop-sidebar__avatar-name">{userName || 'Account'}</span>
              {roleSchool && <span className="desktop-sidebar__avatar-sub">{roleSchool}</span>}
            </span>
          )}
        </button>
      </div>
    </nav>
  );
}
