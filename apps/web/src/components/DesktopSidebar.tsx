import { useState, useRef, useEffect } from 'react';
import type { NavigationAdapterProps, WorkspaceTab } from '@admini/workspace';
import { useInstallPrompt } from '@admini/pwa';

const TAB_ICONS: Record<string, string> = {
  capture: '\uD83C\uDFA4',
  dashboard: '\u25A6',
  tasks: '\u2610',
  notes: '\uD83D\uDCDD',
  observations: '\u2661',
  pulse: '\u2661',
  more: '\u2699',
  admin: '\u25CB',
};

const CORE_TAB_IDS = ['capture', 'dashboard', 'tasks', 'notes', 'observations', 'pulse'];

export function DesktopSidebar({ activeTab, tabs, onTabChange, onSignOut, userName, userRole, schoolName }: NavigationAdapterProps) {
  const { isInstallable, isStandalone, promptInstall } = useInstallPrompt();
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const coreTabs = tabs.filter(t => CORE_TAB_IDS.includes(t.id));
  const hasAdmin = tabs.some(t => t.id === 'admin');
  const initial = (userName || 'U').trim().charAt(0).toUpperCase();
  const roleSchool = [userRole, schoolName].filter(Boolean).join(' · ');

  return (
    <nav className={'desktop-sidebar' + (collapsed ? ' desktop-sidebar--collapsed' : '')} aria-label="Workspace navigation">
      <div className="desktop-sidebar__top">
        {!collapsed && <div className="desktop-sidebar__brand">AdminI.</div>}
        <button type="button" className="desktop-sidebar__collapse-btn" onClick={() => setCollapsed(c => !c)} aria-label="Toggle sidebar" title="Collapse sidebar">❐</button>
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
              <span className="desktop-sidebar__icon" aria-hidden="true">{TAB_ICONS[tab.id] ?? '\uD83D\uDCC4'}</span>
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
            {!isStandalone && (
              <button type="button" className="desktop-sidebar__menu-item" onClick={async () => { if (isInstallable) { await promptInstall(); } else { window.open('https://pdadmini.com', '_blank'); } setMenuOpen(false); }}>
                <span className="desktop-sidebar__menu-icon">⬇</span> {isInstallable ? 'Install app' : 'Get app'}
              </button>
            )}
            {onSignOut && (
              <button type="button" className="desktop-sidebar__menu-item desktop-sidebar__menu-item--logout" onClick={onSignOut}>
                <span className="desktop-sidebar__menu-icon">→</span> Log out
              </button>
            )}
          </div>
        )}
        <button type="button" className="desktop-sidebar__avatar-btn" onClick={() => setMenuOpen(o => !o)} aria-label="Account menu">
          <span className="desktop-sidebar__avatar">{initial}</span>
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
