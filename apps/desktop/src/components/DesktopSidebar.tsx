import type { NavigationAdapterProps, WorkspaceTab } from '@admini/workspace';

const TAB_ICONS: Record<string, string> = {
  capture: 'ðŸ“',
  dashboard: 'ðŸ“Š',
  tasks: 'âœ…',
  pulse: 'ðŸ’“',
  more: 'âš™ï¸',
  admin: 'ðŸ”§',
};

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
                {TAB_ICONS[tab.id] ?? 'ðŸ“„'}
              </span>
              <span className="desktop-sidebar__label">{tab.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
