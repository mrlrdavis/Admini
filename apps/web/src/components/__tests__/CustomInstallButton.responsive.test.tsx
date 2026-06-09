import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CustomInstallButton } from '../CustomInstallButton';

// Mock @admini/pwa
vi.mock('@admini/pwa', () => ({
  useInstallPrompt: vi.fn(),
}));

import { useInstallPrompt } from '@admini/pwa';
const mockUseInstallPrompt = vi.mocked(useInstallPrompt);

type ChangeListener = (e: MediaQueryListEvent) => void;

interface MockMediaQueryList {
  matches: boolean;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  listeners: ChangeListener[];
  /** Simulate a media query change */
  trigger(matches: boolean): void;
}

function createMockMatchMedia(initialMatches: boolean): {
  mockMatchMedia: ReturnType<typeof vi.fn>;
  mql: MockMediaQueryList;
} {
  const listeners: ChangeListener[] = [];
  const mql: MockMediaQueryList = {
    matches: initialMatches,
    addEventListener: vi.fn((event: string, listener: ChangeListener) => {
      if (event === 'change') {
        listeners.push(listener);
      }
    }),
    removeEventListener: vi.fn((event: string, listener: ChangeListener) => {
      if (event === 'change') {
        const idx = listeners.indexOf(listener);
        if (idx >= 0) listeners.splice(idx, 1);
      }
    }),
    listeners,
    trigger(matches: boolean) {
      mql.matches = matches;
      listeners.forEach((l) => l({ matches } as MediaQueryListEvent));
    },
  };

  const mockMatchMedia = vi.fn().mockReturnValue(mql);
  return { mockMatchMedia, mql };
}

describe('useResponsiveMode (via CustomInstallButton)', () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    localStorage.clear();
    mockUseInstallPrompt.mockReturnValue({
      isInstallable: true,
      isStandalone: false,
      promptInstall: vi.fn().mockResolvedValue('dismissed'),
    });
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('renders with desktop class when viewport > 768px', () => {
    const { mockMatchMedia } = createMockMatchMedia(false); // false = viewport > 768px
    window.matchMedia = mockMatchMedia as unknown as typeof window.matchMedia;

    render(<CustomInstallButton />);

    const container = screen.getByRole('group', { name: 'Install prompt' });
    expect(container.className).toContain('custom-install-button--desktop');
    expect(container.className).not.toContain('custom-install-button--mobile');
  });

  it('renders with mobile class when viewport <= 768px', () => {
    const { mockMatchMedia } = createMockMatchMedia(true); // true = viewport <= 768px
    window.matchMedia = mockMatchMedia as unknown as typeof window.matchMedia;

    render(<CustomInstallButton />);

    const container = screen.getByRole('group', { name: 'Install prompt' });
    expect(container.className).toContain('custom-install-button--mobile');
    expect(container.className).not.toContain('custom-install-button--desktop');
  });

  it('transitions from desktop to mobile on resize without unmounting', () => {
    const { mockMatchMedia, mql } = createMockMatchMedia(false); // start as desktop
    window.matchMedia = mockMatchMedia as unknown as typeof window.matchMedia;

    render(<CustomInstallButton />);

    const container = screen.getByRole('group', { name: 'Install prompt' });
    expect(container.className).toContain('custom-install-button--desktop');

    // Simulate resize to mobile
    act(() => {
      mql.trigger(true);
    });

    // Same container element should now have mobile class (no remount)
    const updatedContainer = screen.getByRole('group', { name: 'Install prompt' });
    expect(updatedContainer.className).toContain('custom-install-button--mobile');
    expect(updatedContainer.className).not.toContain('custom-install-button--desktop');
  });

  it('transitions from mobile to desktop on resize without unmounting', () => {
    const { mockMatchMedia, mql } = createMockMatchMedia(true); // start as mobile
    window.matchMedia = mockMatchMedia as unknown as typeof window.matchMedia;

    render(<CustomInstallButton />);

    const container = screen.getByRole('group', { name: 'Install prompt' });
    expect(container.className).toContain('custom-install-button--mobile');

    // Simulate resize to desktop
    act(() => {
      mql.trigger(false);
    });

    const updatedContainer = screen.getByRole('group', { name: 'Install prompt' });
    expect(updatedContainer.className).toContain('custom-install-button--desktop');
    expect(updatedContainer.className).not.toContain('custom-install-button--mobile');
  });

  it('cleans up the matchMedia listener on unmount', () => {
    const { mockMatchMedia, mql } = createMockMatchMedia(false);
    window.matchMedia = mockMatchMedia as unknown as typeof window.matchMedia;

    const { unmount } = render(<CustomInstallButton />);
    expect(mql.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));

    unmount();
    expect(mql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('uses the (max-width: 768px) media query', () => {
    const { mockMatchMedia } = createMockMatchMedia(false);
    window.matchMedia = mockMatchMedia as unknown as typeof window.matchMedia;

    render(<CustomInstallButton />);

    expect(mockMatchMedia).toHaveBeenCalledWith('(max-width: 768px)');
  });
});