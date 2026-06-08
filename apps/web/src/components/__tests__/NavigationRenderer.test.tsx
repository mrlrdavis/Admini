import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { NavigationRenderer } from '../NavigationRenderer';

const mockTabs = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'capture', label: 'Capture' },
  { id: 'tasks', label: 'Tasks' },
];

describe('NavigationRenderer', () => {
  it('renders DesktopSidebar when layoutMode is desktop', () => {
    render(
      <NavigationRenderer
        layoutMode="desktop"
        activeTab="dashboard"
        tabs={mockTabs}
        onTabChange={() => {}}
      />
    );

    const nav = screen.getByLabelText('Workspace navigation');
    expect(nav).toBeInTheDocument();
    expect(nav).toHaveClass('desktop-sidebar');
  });

  it('renders TabBar when layoutMode is mobile', () => {
    render(
      <NavigationRenderer
        layoutMode="mobile"
        activeTab="dashboard"
        tabs={mockTabs}
        onTabChange={() => {}}
      />
    );

    const tablist = screen.getByRole('tablist');
    expect(tablist).toBeInTheDocument();
    expect(tablist).toHaveClass('tab-bar');
  });

  it('propagates tab change callbacks correctly', async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();

    render(
      <NavigationRenderer
        layoutMode="mobile"
        activeTab="dashboard"
        tabs={mockTabs}
        onTabChange={onTabChange}
      />
    );

    const captureTab = screen.getByRole('tab', { name: 'Capture' });
    await user.click(captureTab);

    expect(onTabChange).toHaveBeenCalledTimes(1);
    expect(onTabChange).toHaveBeenCalledWith('capture');
  });
});
