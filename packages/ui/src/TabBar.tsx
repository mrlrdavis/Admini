import type { ReactNode } from 'react';

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
}

export interface TabBarProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function TabBar({ tabs, activeTab, onTabChange }: TabBarProps): JSX.Element {
  return (
    <nav className="tab-bar" role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            className={`tab-item${isActive ? ' tab-item--active' : ''}`}
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.id)}
            type="button"
          >
            {tab.icon && <span className="tab-item__icon">{tab.icon}</span>}
            <span className="tab-item__label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}