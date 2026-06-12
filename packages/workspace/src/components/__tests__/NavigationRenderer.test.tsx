import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NavigationRenderer, useIsDesktop, DEFAULT_TABS } from '../NavigationRenderer';
import type { NavigationRendererProps } from '../NavigationRenderer';
import type { AdminiRole, WorkspaceTab } from '../../types';
import { renderHook } from '@testing-library/react';

// Mock CSS imports
vi.mock('../../styles/desktop-sidebar.css', () => ({}));
vi.mock('../../styles/mobile-tab-bar.css', () => ({}));

// Helper to create a matchMedia mock
function createMatchMediaMock(matches: boolean) {
  const listeners: Array<(e: MediaQueryListEvent) => void> = [];
  const mql = {
    matches,
    media: '',
    onchange: null,
    addEventListener: vi.fn((event: string, handler: (e: MediaQueryListEvent) => void) => {
      if (event === 'change') listeners.push(handler);
    }),
    removeEventListener: vi.fn((event: string, handler: (e: MediaQueryListEvent) => void) => {
      const idx = listeners.indexOf(handler);
      if (idx >= 0) listeners.splice(idx, 1);
    }),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
  return { mql, listeners, trigger: (newMatches: boolean) => {
    mql.matches = newMatches;
    listeners.forEach(l => l({ matches: newMatches } as MediaQueryListEvent));
  }};
}

const defaultProps: NavigationRendererProps = {
  activeTab: 'dashboard',
  userRole: 'admin',
  onTabChange: vi.fn(),
  onSignOut: vi.fn(),
};

describe('NavigationRenderer', () => {
  let matchMediaMock: ReturnType<typeof createMatchMediaMock>;
  let originalMatchMedia: typeof window.matchMedia;
  let originalInnerWidth: number;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    originalInnerWidth = window.innerWidth;
    matchMediaMock = createMatchMediaMock(true); // default: desktop
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockReturnValue(matchMediaMock.mql),
    });
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: originalMatchMedia,
    });
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
    vi.restoreAllMocks();
  });

  describe('responsive switching', () => {
    it('renders DesktopSidebar when viewport is above 900px', () => {
      render(<NavigationRenderer {...defaultProps} />);
      // DesktopSidebar renders with aria-label "Workspace navigation"
      expect(screen.getByLabelText('Workspace navigation')).toBeDefined();
    });

    it('renders MobileTabBar when viewport is at or below 900px', () => {
      matchMediaMock = createMatchMediaMock(false);
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: vi.fn().mockReturnValue(matchMediaMock.mql),
      });
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 800,
      });

      render(<NavigationRenderer {...defaultProps} />);
      // MobileTabBar renders with aria-label "Mobile navigation"
      expect(screen.getByLabelText('Mobile navigation')).toBeDefined();
    });

    it('switches from desktop to mobile when viewport changes', () => {
      const { rerender } = render(<NavigationRenderer {...defaultProps} />);
      expect(screen.getByLabelText('Workspace navigation')).toBeDefined();

      // Simulate viewport change to mobile
      act(() => {
        matchMediaMock.trigger(false);
      });

      rerender(<NavigationRenderer {...defaultProps} />);
      expect(screen.getByLabelText('Mobile navigation')).toBeDefined();
    });
  });

  describe('tab navigation state machine', () => {
    it('calls onTabChange when a tab is clicked', () => {
      const onTabChange = vi.fn();
      render(<NavigationRenderer {...defaultProps} onTabChange={onTabChange} />);

      fireEvent.click(screen.getByRole('tab', { name: /Tasks/ }));
      expect(onTabChange).toHaveBeenCalledWith('tasks');
    });

    it('does not call onTabChange when clicking the already-active tab', () => {
      const onTabChange = vi.fn();
      render(<NavigationRenderer {...defaultProps} activeTab="dashboard" onTabChange={onTabChange} />);

      fireEvent.click(screen.getByRole('tab', { name: /Dashboard/ }));
      expect(onTabChange).not.toHaveBeenCalled();
    });

    it('dispatches admini:dismiss-modals event on tab change', () => {
      const eventHandler = vi.fn();
      window.addEventListener('admini:dismiss-modals', eventHandler);

      render(<NavigationRenderer {...defaultProps} activeTab="dashboard" />);
      fireEvent.click(screen.getByRole('tab', { name: /Tasks/ }));

      expect(eventHandler).toHaveBeenCalledTimes(1);
      window.removeEventListener('admini:dismiss-modals', eventHandler);
    });

    it('does not dispatch dismiss-modals when clicking the active tab', () => {
      const eventHandler = vi.fn();
      window.addEventListener('admini:dismiss-modals', eventHandler);

      render(<NavigationRenderer {...defaultProps} activeTab="dashboard" />);
      fireEvent.click(screen.getByRole('tab', { name: /Dashboard/ }));

      expect(eventHandler).not.toHaveBeenCalled();
      window.removeEventListener('admini:dismiss-modals', eventHandler);
    });

    it('resets scroll position on tab change', () => {
      const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

      render(<NavigationRenderer {...defaultProps} activeTab="dashboard" />);
      fireEvent.click(screen.getByRole('tab', { name: /Tasks/ }));

      expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
      scrollToSpy.mockRestore();
    });
  });

  describe('role gating', () => {
    it('shows Admin and Observations tabs for admin role', () => {
      render(<NavigationRenderer {...defaultProps} userRole="admin" />);
      expect(screen.getByRole('tab', { name: /Admin/ })).toBeDefined();
      expect(screen.getByRole('tab', { name: /Observations/ })).toBeDefined();
    });

    it('shows Admin and Observations tabs for principal role', () => {
      render(<NavigationRenderer {...defaultProps} userRole="principal" />);
      expect(screen.getByRole('tab', { name: /Admin/ })).toBeDefined();
      expect(screen.getByRole('tab', { name: /Observations/ })).toBeDefined();
    });

    it('hides Admin and Observations tabs for teacher role', () => {
      render(<NavigationRenderer {...defaultProps} userRole="teacher" />);
      expect(screen.queryByRole('tab', { name: /Admin/ })).toBeNull();
      expect(screen.queryByRole('tab', { name: /Observations/ })).toBeNull();
    });

    it('hides Admin and Observations tabs for staff role', () => {
      render(<NavigationRenderer {...defaultProps} userRole="staff" />);
      expect(screen.queryByRole('tab', { name: /Admin/ })).toBeNull();
      expect(screen.queryByRole('tab', { name: /Observations/ })).toBeNull();
    });
  });

  describe('sign out', () => {
    it('passes onSignOut callback to DesktopSidebar', () => {
      const onSignOut = vi.fn();
      render(<NavigationRenderer {...defaultProps} onSignOut={onSignOut} />);

      fireEvent.click(screen.getByRole('button', { name: /Sign out/i }));
      expect(onSignOut).toHaveBeenCalledOnce();
    });
  });
});

describe('DEFAULT_TABS configuration', () => {
  it('has correct tab order', () => {
    const tabIds = DEFAULT_TABS.map(t => t.id);
    expect(tabIds).toEqual([
      'capture', 'dashboard', 'tasks', 'notes',
      'observations', 'pulse', 'more', 'admin',
    ]);
  });

  it('restricts admin and observations tabs to admin/principal roles', () => {
    const adminTab = DEFAULT_TABS.find(t => t.id === 'admin');
    const obsTab = DEFAULT_TABS.find(t => t.id === 'observations');
    expect(adminTab?.requiredRoles).toEqual(['admin', 'principal']);
    expect(obsTab?.requiredRoles).toEqual(['admin', 'principal']);
  });

  it('has no role restrictions on standard tabs', () => {
    const standardTabs = DEFAULT_TABS.filter(t => t.id !== 'admin' && t.id !== 'observations');
    standardTabs.forEach(tab => {
      expect(tab.requiredRoles).toBeUndefined();
    });
  });
});

describe('useIsDesktop hook', () => {
  let originalMatchMedia: typeof window.matchMedia;
  let originalInnerWidth: number;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    originalInnerWidth = window.innerWidth;
  });

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: originalMatchMedia,
    });
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });

  it('returns true when viewport is above breakpoint', () => {
    const mockMql = createMatchMediaMock(true);
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockReturnValue(mockMql.mql),
    });
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });

    const { result } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(true);
  });

  it('returns false when viewport is below breakpoint', () => {
    const mockMql = createMatchMediaMock(false);
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockReturnValue(mockMql.mql),
    });
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 800,
    });

    const { result } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(false);
  });

  it('accepts a custom breakpoint', () => {
    const mockMql = createMatchMediaMock(true);
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockReturnValue(mockMql.mql),
    });
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1200,
    });

    const { result } = renderHook(() => useIsDesktop(1100));
    expect(result.current).toBe(true);
  });
});
