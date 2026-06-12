import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DesktopSidebar, filterTabsByRole } from '../DesktopSidebar';
import type { DesktopSidebarTabItem } from '../DesktopSidebar';
import type { AdminiRole, WorkspaceTab } from '../../types';
import React from 'react';

// Mock the CSS import
vi.mock('../../styles/desktop-sidebar.css', () => ({}));

const ALL_TABS: DesktopSidebarTabItem[] = [
  { id: 'capture', label: 'Capture', icon: React.createElement('span', null, 'C') },
  { id: 'dashboard', label: 'Dashboard', icon: React.createElement('span', null, 'D') },
  { id: 'tasks', label: 'Tasks', icon: React.createElement('span', null, 'T') },
  { id: 'notes', label: 'Notes', icon: React.createElement('span', null, 'N') },
  { id: 'observations', label: 'Observations', icon: React.createElement('span', null, 'O'), requiredRoles: ['admin', 'principal'] },
  { id: 'pulse', label: 'Pulse', icon: React.createElement('span', null, 'P') },
  { id: 'more', label: 'Settings', icon: React.createElement('span', null, 'S') },
  { id: 'admin', label: 'Admin', icon: React.createElement('span', null, 'A'), requiredRoles: ['admin', 'principal'] },
];

describe('DesktopSidebar', () => {
  it('renders brand text "AdminI."', () => {
    render(
      <DesktopSidebar
        activeTab="dashboard"
        tabs={ALL_TABS}
        userRole="admin"
        onTabChange={() => {}}
      />
    );
    expect(screen.getByText('AdminI.')).toBeDefined();
  });

  it('renders all tabs for admin role', () => {
    render(
      <DesktopSidebar
        activeTab="dashboard"
        tabs={ALL_TABS}
        userRole="admin"
        onTabChange={() => {}}
      />
    );
    expect(screen.getByRole('tab', { name: /Capture/ })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Dashboard/ })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Tasks/ })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Notes/ })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Observations/ })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Pulse/ })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Settings/ })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Admin/ })).toBeDefined();
  });

  it('hides admin and observations tabs for teacher role', () => {
    render(
      <DesktopSidebar
        activeTab="dashboard"
        tabs={ALL_TABS}
        userRole="teacher"
        onTabChange={() => {}}
      />
    );
    expect(screen.queryByRole('tab', { name: /Admin/ })).toBeNull();
    expect(screen.queryByRole('tab', { name: /Observations/ })).toBeNull();
    // Other tabs should still be visible
    expect(screen.getByRole('tab', { name: /Dashboard/ })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Capture/ })).toBeDefined();
  });

  it('highlights the active tab with active class', () => {
    render(
      <DesktopSidebar
        activeTab="tasks"
        tabs={ALL_TABS}
        userRole="admin"
        onTabChange={() => {}}
      />
    );
    const tasksTab = screen.getByRole('tab', { name: /Tasks/ });
    expect(tasksTab.className).toContain('ds-sidebar__tab--active');
    expect(tasksTab.getAttribute('aria-selected')).toBe('true');

    const dashboardTab = screen.getByRole('tab', { name: /Dashboard/ });
    expect(dashboardTab.className).not.toContain('ds-sidebar__tab--active');
    expect(dashboardTab.getAttribute('aria-selected')).toBe('false');
  });

  it('calls onTabChange when a tab is clicked', () => {
    const onTabChange = vi.fn();
    render(
      <DesktopSidebar
        activeTab="dashboard"
        tabs={ALL_TABS}
        userRole="admin"
        onTabChange={onTabChange}
      />
    );
    fireEvent.click(screen.getByRole('tab', { name: /Tasks/ }));
    expect(onTabChange).toHaveBeenCalledWith('tasks');
  });

  it('calls onSignOut when sign out button is clicked', () => {
    const onSignOut = vi.fn();
    render(
      <DesktopSidebar
        activeTab="dashboard"
        tabs={ALL_TABS}
        userRole="admin"
        onTabChange={() => {}}
        onSignOut={onSignOut}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Sign out/i }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it('does not render sign out button when onSignOut is not provided', () => {
    render(
      <DesktopSidebar
        activeTab="dashboard"
        tabs={ALL_TABS}
        userRole="admin"
        onTabChange={() => {}}
      />
    );
    expect(screen.queryByRole('button', { name: /Sign out/i })).toBeNull();
  });

  it('has proper navigation landmark', () => {
    render(
      <DesktopSidebar
        activeTab="dashboard"
        tabs={ALL_TABS}
        userRole="admin"
        onTabChange={() => {}}
      />
    );
    expect(screen.getByRole('navigation', { name: /Workspace navigation/i })).toBeDefined();
  });
});

describe('filterTabsByRole', () => {
  it('returns all tabs without requiredRoles for any role', () => {
    const tabs: DesktopSidebarTabItem[] = [
      { id: 'dashboard', label: 'Dashboard', icon: React.createElement('span', null, 'D') },
      { id: 'tasks', label: 'Tasks', icon: React.createElement('span', null, 'T') },
    ];
    const result = filterTabsByRole(tabs, 'teacher');
    expect(result).toHaveLength(2);
  });

  it('includes role-gated tabs when user has required role', () => {
    const tabs: DesktopSidebarTabItem[] = [
      { id: 'admin', label: 'Admin', icon: React.createElement('span', null, 'A'), requiredRoles: ['admin', 'principal'] },
    ];
    expect(filterTabsByRole(tabs, 'admin')).toHaveLength(1);
    expect(filterTabsByRole(tabs, 'principal')).toHaveLength(1);
  });

  it('excludes role-gated tabs when user lacks required role', () => {
    const tabs: DesktopSidebarTabItem[] = [
      { id: 'admin', label: 'Admin', icon: React.createElement('span', null, 'A'), requiredRoles: ['admin', 'principal'] },
    ];
    expect(filterTabsByRole(tabs, 'teacher')).toHaveLength(0);
    expect(filterTabsByRole(tabs, 'staff')).toHaveLength(0);
  });

  it('handles empty requiredRoles array as unrestricted', () => {
    const tabs: DesktopSidebarTabItem[] = [
      { id: 'dashboard', label: 'Dashboard', icon: React.createElement('span', null, 'D'), requiredRoles: [] },
    ];
    expect(filterTabsByRole(tabs, 'teacher')).toHaveLength(1);
  });
});