import { useState } from 'react';
import type { NavigationAdapterProps, WorkspaceTab } from '@admini/workspace';

const TAB_ICONS: Record<string, string> = {
  capture: '\uD83D\uDCDD',
  dashboard: '\uD83D\uDCCA',
  tasks: '\u2705',
  pulse: '\uD83D\uDC93',
  more: '\u2699\uFE0F',
  admin: '\uD83D\uDD27',
};

export function MobileHamburger({ activeTab, tabs, onTabChange }: NavigationAdapterProps) {
  const [open, setOpen] = useState(false);

  function handleTabSelect(tabId: string) {
    onTabChange(tabId as WorkspaceTab);
    setOpen(false);
  }

  const triggerClass = 'mobile-nav-trigger' + (open ? ' mobile-nav-trigger--open' : '');
  const drawerClass = 'mobile-nav-drawer' + (open ? ' mobile-nav-drawer--open' : '');

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
                    <span aria-hidden="true">{TAB_ICONS[tab.id] ?? '\uD83D\uDCC4'}</span>
                    <span>{tab.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </>
  );
}