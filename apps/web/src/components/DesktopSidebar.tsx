import type { NavigationAdapterProps, WorkspaceTab } from '@admini/workspace';
import { useThemePreference } from '@admini/workspace';

const TAB_ICONS: Record<string, string> = {
  capture: '\uD83D\uDCDD',
  dashboard: '\uD83D\uDCCA',
  tasks: '\u2705',
  pulse: '\uD83D\uDC93',
  more: '\u2699\uFE0F',
  admin: '\uD83D\uDD27',
};

const CORE_TAB_IDS = ['capture', 'dashboard', 'tasks', 'pulse'];
const UTILITY_TAB_IDS = ['more', 'admin'];

export function DesktopSidebar({ activeTab, tabs, onTabChange, onSignOut }: NavigationAdapterProps) {
  const { resolvedTheme, setThemePreference } = useThemePreference();
  const coreTabs = tabs.filter(t => CORE_TAB_IDS.includes(t.id));
  const utilityTabs = tabs.filter(t => UTILITY_TAB_IDS.includes(t.id));

  return (
    <nav className="desktop-sidebar" aria-label="Workspace navigation">
      <div className="desktop-sidebar__brand">AdminI.</div>
      <ul className="desktop-sidebar__tabs" role="tablist">
        {coreTabs.map((tab) => (
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
      <div className="desktop-sidebar__divider" />
      <ul className="desktop-sidebar__tabs" role="tablist">
        {utilityTabs.map((tab) => (
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
      <button type="button" className="desktop-sidebar__theme-toggle" onClick={() => setThemePreference(resolvedTheme === 'dark' ? 'light' : 'dark')} aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
        <span className="mode-sun" aria-hidden="true" />
        <span className="mode-moon" aria-hidden="true" />
      </button>
      {onSignOut && (
        <button
          type="button"
          className="desktop-sidebar__sign-out"
          onClick={onSignOut}
          aria-label="Sign out"
        >
          Sign Out
        </button>
      )}
    </nav>
  );
}
