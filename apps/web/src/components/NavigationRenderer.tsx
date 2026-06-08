import type { NavigationAdapterProps } from '@admini/workspace';
import type { LayoutMode } from '@admini/ui';
import { DesktopSidebar } from './DesktopSidebar';
import { MobileHamburger } from './MobileHamburger';

interface NavigationRendererProps extends NavigationAdapterProps {
  layoutMode: LayoutMode;
}

export function NavigationRenderer({ layoutMode, activeTab, tabs, onTabChange, onSignOut }: NavigationRendererProps) {
  if (layoutMode === 'desktop') {
    return <DesktopSidebar activeTab={activeTab} tabs={tabs} onTabChange={onTabChange} onSignOut={onSignOut} />;
  }
  return <MobileHamburger activeTab={activeTab} tabs={tabs} onTabChange={onTabChange} onSignOut={onSignOut} />;
}