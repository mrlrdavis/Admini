import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { createElement } from 'react';
import type { WorkspaceShellProps, NavigationAdapterProps, WorkspaceTab } from '../../src/types';

// ---------------------------------------------------------------------------
// Mock child tab components to isolate navigation logic.
// Each mock renders a simple div with a data-testid matching its tab name.
// ---------------------------------------------------------------------------

vi.mock('../../src/components/DashboardTab', () => ({
  DashboardTab: ({ userName }: { userName: string }) =>
    createElement('div', { 'data-testid': 'tab-dashboard' }, `Dashboard: ${userName}`),
}));

vi.mock('../../src/components/AdminTab', () => ({
  AdminTab: ({ organizationId }: { organizationId: string }) =>
    createElement('div', { 'data-testid': 'tab-admin' }, `Admin: ${organizationId}`),
}));

vi.mock('../../src/components/CaptureTab', () => ({
  CaptureTab: () => createElement('div', { 'data-testid': 'tab-capture' }, 'Capture'),
}));

vi.mock('../../src/components/TasksTab', () => ({
  TasksTab: () => createElement('div', { 'data-testid': 'tab-tasks' }, 'Tasks'),
}));

vi.mock('../../src/components/PulseTab', () => ({
  PulseTab: () => createElement('div', { 'data-testid': 'tab-pulse' }, 'Pulse'),
}));

vi.mock('../../src/components/MoreTab', () => ({
  MoreTab: () => createElement('div', { 'data-testid': 'tab-more' }, 'More'),
}));

vi.mock('../../src/components/IframeFallback', () => ({
  IframeFallback: ({ visible, src }: { visible: boolean; src: string }) =>
    createElement('div', { 'data-testid': 'iframe-fallback', 'data-visible': String(visible), 'data-src': src }),
}));

// Import after mocks are registered
import { WorkspaceShell, NATIVE_TABS } from '../../src/components/WorkspaceShell';

// ---------------------------------------------------------------------------
// REQ-6: Navigation between views works (dashboard, capture, tasks, etc.)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultProps(overrides?: Partial<WorkspaceShellProps>): WorkspaceShellProps {
  return {
    user: { id: 'user-1', email: 'test@school.edu', displayName: 'Test User', schoolName: 'Test School' },
    userRole: 'admin',
    organizationId: 'org-1',
    userName: 'Test User',
    schoolName: 'Test School',
    prototypePath: '/prototype.html',
    onSignOut: vi.fn(),
    onDeleteAccount: vi.fn(),
    onResetUserData: vi.fn(),
    onProfileUpdated: vi.fn(),
    renderNavigation: vi.fn((_props: NavigationAdapterProps) => null),
    ...overrides,
  };
}

/**
 * Renders WorkspaceShell and captures the navigation adapter props
 * so tests can call onTabChange to simulate navigation.
 */
function renderShell(overrides?: Partial<WorkspaceShellProps>) {
  let navProps: NavigationAdapterProps | null = null;

  const renderNavigation = (props: NavigationAdapterProps) => {
    navProps = props;
    return createElement(
      'nav',
      { 'data-testid': 'navigation' },
      props.tabs.map((tab) =>
        createElement(
          'button',
          {
            key: tab.id,
            'data-testid': `nav-tab-${tab.id}`,
            'data-active': String(props.activeTab === tab.id),
            onClick: () => props.onTabChange(tab.id as WorkspaceTab),
          },
          tab.label,
        ),
      ),
    );
  };

  const result = render(
    createElement(WorkspaceShell, defaultProps({ renderNavigation, ...overrides })),
  );

  return { ...result, getNavProps: () => navProps! };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WorkspaceNavigation (REQ-6)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Active tab content rendering', () => {
    it('renders DashboardTab by default (initial active tab)', () => {
      const { container } = renderShell();
      expect(container.querySelector('[data-testid="tab-dashboard"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="tab-capture"]')).toBeNull();
      expect(container.querySelector('[data-testid="tab-tasks"]')).toBeNull();
    });

    it('renders CaptureTab when activeTab is capture', () => {
      const { container, getNavProps } = renderShell();

      act(() => {
        getNavProps().onTabChange('capture');
      });

      expect(container.querySelector('[data-testid="tab-capture"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="tab-dashboard"]')).toBeNull();
    });

    it('renders TasksTab when activeTab is tasks', () => {
      const { container, getNavProps } = renderShell();

      act(() => {
        getNavProps().onTabChange('tasks');
      });

      expect(container.querySelector('[data-testid="tab-tasks"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="tab-dashboard"]')).toBeNull();
    });

    it('renders PulseTab when activeTab is pulse', () => {
      const { container, getNavProps } = renderShell();

      act(() => {
        getNavProps().onTabChange('pulse');
      });

      expect(container.querySelector('[data-testid="tab-pulse"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="tab-dashboard"]')).toBeNull();
    });

    it('renders MoreTab when activeTab is more', () => {
      const { container, getNavProps } = renderShell();

      act(() => {
        getNavProps().onTabChange('more');
      });

      expect(container.querySelector('[data-testid="tab-more"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="tab-dashboard"]')).toBeNull();
    });

    it('renders AdminTab when activeTab is admin and user is admin', () => {
      const { container, getNavProps } = renderShell({ userRole: 'admin' });

      act(() => {
        getNavProps().onTabChange('admin');
      });

      expect(container.querySelector('[data-testid="tab-admin"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="tab-dashboard"]')).toBeNull();
    });
  });

  describe('2. Tab switching', () => {
    it('switches from dashboard to tasks', () => {
      const { container, getNavProps } = renderShell();

      expect(container.querySelector('[data-testid="tab-dashboard"]')).not.toBeNull();

      act(() => {
        getNavProps().onTabChange('tasks');
      });

      expect(container.querySelector('[data-testid="tab-tasks"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="tab-dashboard"]')).toBeNull();
    });

    it('switches between multiple tabs in sequence', () => {
      const { container, getNavProps } = renderShell();

      act(() => { getNavProps().onTabChange('capture'); });
      expect(container.querySelector('[data-testid="tab-capture"]')).not.toBeNull();

      act(() => { getNavProps().onTabChange('pulse'); });
      expect(container.querySelector('[data-testid="tab-pulse"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="tab-capture"]')).toBeNull();

      act(() => { getNavProps().onTabChange('more'); });
      expect(container.querySelector('[data-testid="tab-more"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="tab-pulse"]')).toBeNull();

      act(() => { getNavProps().onTabChange('dashboard'); });
      expect(container.querySelector('[data-testid="tab-dashboard"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="tab-more"]')).toBeNull();
    });

    it('updates activeTab in navigation props on tab change', () => {
      const { getNavProps } = renderShell();

      expect(getNavProps().activeTab).toBe('dashboard');

      act(() => { getNavProps().onTabChange('tasks'); });
      expect(getNavProps().activeTab).toBe('tasks');

      act(() => { getNavProps().onTabChange('capture'); });
      expect(getNavProps().activeTab).toBe('capture');
    });
  });

  describe('3. Non-native tabs display IframeFallback', () => {
    it('hides IframeFallback when a native tab is active', () => {
      const { container } = renderShell();
      const iframe = container.querySelector('[data-testid="iframe-fallback"]');
      expect(iframe).not.toBeNull();
      expect(iframe!.getAttribute('data-visible')).toBe('false');
    });

    it('shows IframeFallback when a non-native tab is active', () => {
      const { container, getNavProps } = renderShell();

      act(() => {
        getNavProps().onTabChange('observations' as WorkspaceTab);
      });

      const iframe = container.querySelector('[data-testid="iframe-fallback"]');
      expect(iframe!.getAttribute('data-visible')).toBe('true');
    });

    it('passes prototypePath as src to IframeFallback', () => {
      const { container } = renderShell({ prototypePath: '/my-prototype.html' });
      const iframe = container.querySelector('[data-testid="iframe-fallback"]');
      expect(iframe!.getAttribute('data-src')).toBe('/my-prototype.html');
    });

    it('NATIVE_TABS set contains expected native tabs', () => {
      expect(NATIVE_TABS.has('dashboard')).toBe(true);
      expect(NATIVE_TABS.has('admin')).toBe(true);
      expect(NATIVE_TABS.has('capture')).toBe(true);
      expect(NATIVE_TABS.has('tasks')).toBe(true);
      expect(NATIVE_TABS.has('pulse')).toBe(true);
      expect(NATIVE_TABS.has('more')).toBe(true);
    });
  });

  describe('4. Admin tab is role-gated', () => {
    it('redirects non-admin users away from admin tab to dashboard', () => {
      const { container, getNavProps } = renderShell({ userRole: 'teacher' });

      act(() => {
        getNavProps().onTabChange('admin');
      });

      expect(container.querySelector('[data-testid="tab-dashboard"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="tab-admin"]')).toBeNull();
    });

    it('redirects staff role away from admin tab', () => {
      const { container, getNavProps } = renderShell({ userRole: 'staff' });

      act(() => {
        getNavProps().onTabChange('admin');
      });

      expect(container.querySelector('[data-testid="tab-dashboard"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="tab-admin"]')).toBeNull();
    });

    it('allows admin role to access admin tab', () => {
      const { container, getNavProps } = renderShell({ userRole: 'admin' });

      act(() => {
        getNavProps().onTabChange('admin');
      });

      expect(container.querySelector('[data-testid="tab-admin"]')).not.toBeNull();
    });

    it('allows principal role to access admin tab', () => {
      const { container, getNavProps } = renderShell({ userRole: 'principal' });

      act(() => {
        getNavProps().onTabChange('admin');
      });

      expect(container.querySelector('[data-testid="tab-admin"]')).not.toBeNull();
    });
  });

  describe('5. All visible tabs rendered in navigation', () => {
    it('renders all base tabs for admin user (includes admin tab)', () => {
      const { getNavProps } = renderShell({ userRole: 'admin' });
      const tabs = getNavProps().tabs;
      const tabIds = tabs.map((t) => t.id);

      expect(tabIds).toContain('capture');
      expect(tabIds).toContain('dashboard');
      expect(tabIds).toContain('tasks');
      expect(tabIds).toContain('pulse');
      expect(tabIds).toContain('more');
      expect(tabIds).toContain('admin');
      expect(tabs.length).toBe(6);
    });

    it('renders all base tabs for principal user (includes admin tab)', () => {
      const { getNavProps } = renderShell({ userRole: 'principal' });
      const tabs = getNavProps().tabs;
      const tabIds = tabs.map((t) => t.id);

      expect(tabIds).toContain('admin');
      expect(tabs.length).toBe(6);
    });

    it('does NOT include admin tab for teacher role', () => {
      const { getNavProps } = renderShell({ userRole: 'teacher' });
      const tabs = getNavProps().tabs;
      const tabIds = tabs.map((t) => t.id);

      expect(tabIds).not.toContain('admin');
      expect(tabs.length).toBe(5);
    });

    it('does NOT include admin tab for staff role', () => {
      const { getNavProps } = renderShell({ userRole: 'staff' });
      const tabs = getNavProps().tabs;
      const tabIds = tabs.map((t) => t.id);

      expect(tabIds).not.toContain('admin');
      expect(tabs.length).toBe(5);
    });

    it('all tabs have labels', () => {
      const { getNavProps } = renderShell({ userRole: 'admin' });
      const tabs = getNavProps().tabs;

      tabs.forEach((tab) => {
        expect(tab.label).toBeTruthy();
        expect(typeof tab.label).toBe('string');
      });
    });

    it('renderNavigation is called with onTabChange callback', () => {
      const { getNavProps } = renderShell();
      expect(typeof getNavProps().onTabChange).toBe('function');
    });
  });
});
