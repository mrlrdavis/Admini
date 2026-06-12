import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MobileTabBar, filterTabsByRole } from './MobileTabBar';
import type { MobileTabBarTabItem } from './MobileTabBar';
import type { AdminiRole } from '../types';

const ALL_TABS: MobileTabBarTabItem[] = [
  { id: 'capture', label: 'Capture', icon: 'C' },
  { id: 'dashboard', label: 'Dashboard', icon: 'D' },
  { id: 'tasks', label: 'Tasks', icon: 'T' },
  { id: 'notes', label: 'Notes', icon: 'N' },
  { id: 'observations', label: 'Observations', icon: 'O', requiredRoles: ['admin', 'principal'] },
  { id: 'pulse', label: 'Pulse', icon: 'P' },
  { id: 'admin', label: 'Admin', icon: 'A', requiredRoles: ['admin', 'principal'] },
];

describe('MobileTabBar', () => {
  it('renders visible tabs as buttons with role="tab"', () => {
    render(
      <MobileTabBar
        activeTab="dashboard"
        tabs={ALL_TABS}
        userRole="admin"
        onTabChange={() => {}}
      />
    );

    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(7);
  });

  it('marks the active tab with aria-selected="true"', () => {
    render(
      <MobileTabBar
        activeTab="tasks"
        tabs={ALL_TABS}
        userRole="admin"
        onTabChange={() => {}}
      />
    );

    const tasksTab = screen.getByLabelText('Tasks');
    expect(tasksTab.getAttribute('aria-selected')).toBe('true');

    const dashboardTab = screen.getByLabelText('Dashboard');
    expect(dashboardTab.getAttribute('aria-selected')).toBe('false');
  });

  it('applies active class to the active tab', () => {
    render(
      <MobileTabBar
        activeTab="dashboard"
        tabs={ALL_TABS}
        userRole="admin"
        onTabChange={() => {}}
      />
    );

    const activeTab = screen.getByLabelText('Dashboard');
    expect(activeTab.className).toContain('mobile-tab-bar__item--active');
  });

  it('calls onTabChange with the tab id when clicked', () => {
    const onTabChange = vi.fn();
    render(
      <MobileTabBar
        activeTab="dashboard"
        tabs={ALL_TABS}
        userRole="admin"
        onTabChange={onTabChange}
      />
    );

    fireEvent.click(screen.getByLabelText('Tasks'));
    expect(onTabChange).toHaveBeenCalledWith('tasks');
  });

  it('hides role-gated tabs for non-admin/principal roles', () => {
    render(
      <MobileTabBar
        activeTab="dashboard"
        tabs={ALL_TABS}
        userRole="teacher"
        onTabChange={() => {}}
      />
    );

    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(5);
    expect(screen.queryByLabelText('Admin')).toBeNull();
    expect(screen.queryByLabelText('Observations')).toBeNull();
  });

  it('shows role-gated tabs for admin users', () => {
    render(
      <MobileTabBar
        activeTab="dashboard"
        tabs={ALL_TABS}
        userRole="admin"
        onTabChange={() => {}}
      />
    );

    expect(screen.getByLabelText('Admin')).toBeDefined();
    expect(screen.getByLabelText('Observations')).toBeDefined();
  });

  it('shows role-gated tabs for principal users', () => {
    render(
      <MobileTabBar
        activeTab="dashboard"
        tabs={ALL_TABS}
        userRole="principal"
        onTabChange={() => {}}
      />
    );

    expect(screen.getByLabelText('Admin')).toBeDefined();
    expect(screen.getByLabelText('Observations')).toBeDefined();
  });

  it('renders with aria-label for accessibility', () => {
    render(
      <MobileTabBar
        activeTab="dashboard"
        tabs={ALL_TABS}
        userRole="admin"
        onTabChange={() => {}}
      />
    );

    const nav = screen.getByLabelText('Mobile navigation');
    expect(nav).toBeDefined();
    expect(nav.getAttribute('role')).toBe('tablist');
  });
});

describe('filterTabsByRole', () => {
  it('returns all tabs when none have requiredRoles', () => {
    const tabs: MobileTabBarTabItem[] = [
      { id: 'capture', label: 'Capture', icon: 'C' },
      { id: 'dashboard', label: 'Dashboard', icon: 'D' },
    ];
    const result = filterTabsByRole(tabs, 'teacher');
    expect(result.length).toBe(2);
  });

  it('filters out tabs whose requiredRoles do not include the user role', () => {
    const result = filterTabsByRole(ALL_TABS, 'teacher');
    const ids = result.map(t => t.id);
    expect(ids).not.toContain('admin');
    expect(ids).not.toContain('observations');
    expect(ids).toContain('capture');
    expect(ids).toContain('dashboard');
  });

  it('includes tabs whose requiredRoles include the user role', () => {
    const result = filterTabsByRole(ALL_TABS, 'admin');
    const ids = result.map(t => t.id);
    expect(ids).toContain('admin');
    expect(ids).toContain('observations');
  });

  it('treats empty requiredRoles as no restriction', () => {
    const tabs: MobileTabBarTabItem[] = [
      { id: 'capture', label: 'Capture', icon: 'C', requiredRoles: [] },
    ];
    const result = filterTabsByRole(tabs, 'staff');
    expect(result.length).toBe(1);
  });
});
