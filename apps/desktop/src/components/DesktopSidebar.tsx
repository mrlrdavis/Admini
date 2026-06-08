import type { NavigationAdapterProps, WorkspaceTab } from '@admini/workspace';

const TAB_ICONS: Record<string, string> = {
  capture: '\uD83D\uDCDD',
  dashboard: '\uD83D\uDCCA',
  tasks: '\u2705',
  pulse: '\uD83D\uDC93',
  more: '\u2699\uFE0F',
  admin: '\uD83D\uDD27',
}

export function DesktopSidebar({ activeTab, tabs, onTabChange }: NavigationAdapterProps) {
  return (
    <nav className="desktop-sidebar" aria-label="Workspace navigation">
      <div className="desktop-sidebar__brand">AdminI.</div>
      <ul className="desktop-sidebar__tabs" role="tablist">
        {tabs.map((tab) => (
          <li key={tab.id} role="presentation">
            <button
              type="button"
              role="tab"
              className={`desktop-sidebar__tab${activeTab === tab.id ? ' desktop-sidebar__tab--active' : ''}`}
              onClick={() => onTabChange(tab.id as WorkspaceTab)}
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
            >
              <span className="desktop-sidebar__icon" aria-hidden="true">
                {TAB_ICONS[tab.id] ?? '\uD83D\uDCC4'}
              </span>
              <span className="desktop-sidebar__label">{tab.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
