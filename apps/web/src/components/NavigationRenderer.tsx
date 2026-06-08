import type { NavigationAdapterProps } from '@admini/workspace';
import type { LayoutMode } from '@admini/ui';
import { TabBar } from '@admini/ui';
import { DesktopSidebar } from './DesktopSidebar';

interface NavigationRendererProps extends NavigationAdapterProps {
  layoutMode: LayoutMode;
}

export function NavigationRenderer({ layoutMode, activeTab, tabs, onTabChange }: NavigationRendererProps) {
  if (layoutMode === 'desktop') {
    return <DesktopSidebar activeTab={activeTab} tabs={tabs} onTabChange={onTabChange} />;
  }
  return <TabBar tabs={tabs} activeTab={activeTab} onTabChange={onTabChange as (tabId: string) => void} />;
}
