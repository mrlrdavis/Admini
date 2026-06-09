import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Standalone mode tests for CustomInstallButton.
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4
 */

// Mutable reference so individual tests can change the return value
const mockUseInstallPrompt = vi.fn(() => ({
  isInstallable: true,
  isStandalone: false,
  promptInstall: vi.fn().mockResolvedValue('accepted'),
}));

vi.mock('@admini/pwa', () => ({
  useInstallPrompt: () => mockUseInstallPrompt(),
}));

import { CustomInstallButton } from '../CustomInstallButton';

const STORAGE_KEY = 'admini_install_dismissed';

type ChangeListener = (e: MediaQueryListEvent) => void;

interface MockMediaQueryList {
  matches: boolean;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  listeners: ChangeListener[];
  trigger(matches: boolean): void;
}

function createMockMatchMedia(initialMatches = false): {
  mockMatchMedia: ReturnType<typeof vi.fn>;
  mql: MockMediaQueryList;
} {
  const listeners: ChangeListener[] = [];
  const mql: MockMediaQueryList = {
    matches: initialMatches,
    addEventListener: vi.fn((event: string, listener: ChangeListener) => {
      if (event === 'change') listeners.push(listener);
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

describe('CustomInstallButton - Standalone Mode (Requirements 6.1-6.4)', () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    localStorage.clear();
    sessionStorage.clear();

    const { mockMatchMedia } = createMockMatchMedia(false);
    window.matchMedia = mockMatchMedia as unknown as typeof window.matchMedia;

    mockUseInstallPrompt.mockReturnValue({
      isInstallable: true,
      isStandalone: false,
      promptInstall: vi.fn().mockResolvedValue('accepted'),
    });
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('Requirement 6.1: Does not render in standalone mode', () => {
    it('returns null (renders nothing) when isStandalone is true', () => {
      mockUseInstallPrompt.mockReturnValue({
        isInstallable: true,
        isStandalone: true,
        promptInstall: vi.fn().mockResolvedValue('accepted'),
      });

      const { container } = render(<CustomInstallButton />);
      expect(container.firstChild).toBeNull();
    });

    it('renders normally when isStandalone is false and isInstallable is true', () => {
      mockUseInstallPrompt.mockReturnValue({
        isInstallable: true,
        isStandalone: false,
        promptInstall: vi.fn().mockResolvedValue('accepted'),
      });

      render(<CustomInstallButton />);
      expect(screen.getByRole('button', { name: /install admini application/i })).toBeInTheDocument();
    });

    it('does not render any DOM content when isStandalone is true, even if isInstallable is also true', () => {
      mockUseInstallPrompt.mockReturnValue({
        isInstallable: true,
        isStandalone: true,
        promptInstall: vi.fn().mockResolvedValue('accepted'),
      });

      render(<CustomInstallButton />);

      expect(screen.queryByRole('button', { name: /install admini application/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /dismiss install prompt/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  describe('Requirement 6.2: Disappears immediately on mid-session standalone transition', () => {
    it('hides the button when isStandalone transitions from false to true', () => {
      mockUseInstallPrompt.mockReturnValue({
        isInstallable: true,
        isStandalone: false,
        promptInstall: vi.fn().mockResolvedValue('accepted'),
      });

      const { rerender } = render(<CustomInstallButton />);
      expect(screen.getByRole('button', { name: /install admini application/i })).toBeInTheDocument();

      mockUseInstallPrompt.mockReturnValue({
        isInstallable: false,
        isStandalone: true,
        promptInstall: vi.fn().mockResolvedValue('accepted'),
      });

      rerender(<CustomInstallButton />);

      expect(screen.queryByRole('button', { name: /install admini application/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('renders null container when transitioning to standalone', () => {
      mockUseInstallPrompt.mockReturnValue({
        isInstallable: true,
        isStandalone: false,
        promptInstall: vi.fn().mockResolvedValue('accepted'),
      });

      const { rerender, container } = render(<CustomInstallButton />);
      expect(container.firstChild).not.toBeNull();

      mockUseInstallPrompt.mockReturnValue({
        isInstallable: false,
        isStandalone: true,
        promptInstall: vi.fn().mockResolvedValue('accepted'),
      });

      rerender(<CustomInstallButton />);
      expect(container.firstChild).toBeNull();
    });

    it('stays hidden if standalone transitions back to false but isInstallable is still false', () => {
      mockUseInstallPrompt.mockReturnValue({
        isInstallable: false,
        isStandalone: true,
        promptInstall: vi.fn().mockResolvedValue('accepted'),
      });

      const { rerender } = render(<CustomInstallButton />);
      expect(screen.queryByRole('button', { name: /install admini application/i })).not.toBeInTheDocument();

      mockUseInstallPrompt.mockReturnValue({
        isInstallable: false,
        isStandalone: false,
        promptInstall: vi.fn().mockResolvedValue('accepted'),
      });

      rerender(<CustomInstallButton />);
      expect(screen.queryByRole('button', { name: /install admini application/i })).not.toBeInTheDocument();
    });
  });

  describe('Requirement 6.3: Consumes isStandalone from useInstallPrompt only', () => {
    it('does not add its own matchMedia listener for display-mode: standalone', () => {
      const { mockMatchMedia } = createMockMatchMedia(false);
      window.matchMedia = mockMatchMedia as unknown as typeof window.matchMedia;

      mockUseInstallPrompt.mockReturnValue({
        isInstallable: true,
        isStandalone: false,
        promptInstall: vi.fn().mockResolvedValue('accepted'),
      });

      render(<CustomInstallButton />);

      const calls: string[] = (mockMatchMedia.mock.calls as [string][]).map((c) => c[0]);
      const standaloneQueries = calls.filter((q) => q.includes('standalone'));
      expect(standaloneQueries).toHaveLength(0);
    });

    it('renders nothing when isStandalone is true from useInstallPrompt, regardless of matchMedia state', () => {
      const { mockMatchMedia } = createMockMatchMedia(false);
      window.matchMedia = mockMatchMedia as unknown as typeof window.matchMedia;

      mockUseInstallPrompt.mockReturnValue({
        isInstallable: true,
        isStandalone: true,
        promptInstall: vi.fn().mockResolvedValue('accepted'),
      });

      const { container } = render(<CustomInstallButton />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Requirement 6.4: Skips localStorage reads in standalone mode', () => {
    it('does not call localStorage.getItem for dismissal key when isStandalone is true', () => {
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');

      mockUseInstallPrompt.mockReturnValue({
        isInstallable: true,
        isStandalone: true,
        promptInstall: vi.fn().mockResolvedValue('accepted'),
      });

      render(<CustomInstallButton />);

      const dismissalKeyReads = getItemSpy.mock.calls.filter(
        (call) => call[0] === STORAGE_KEY
      );
      expect(dismissalKeyReads).toHaveLength(0);
    });

    it('does not call localStorage.setItem for dismissal key when isStandalone is true', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

      mockUseInstallPrompt.mockReturnValue({
        isInstallable: true,
        isStandalone: true,
        promptInstall: vi.fn().mockResolvedValue('accepted'),
      });

      render(<CustomInstallButton />);

      const dismissalKeyWrites = setItemSpy.mock.calls.filter(
        (call) => call[0] === STORAGE_KEY
      );
      expect(dismissalKeyWrites).toHaveLength(0);
    });

    it('reads localStorage normally when isStandalone is false', () => {
      const expiredTimestamp = Date.now() - (31 * 24 * 60 * 60 * 1000);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ timestamp: expiredTimestamp }));

      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');

      mockUseInstallPrompt.mockReturnValue({
        isInstallable: true,
        isStandalone: false,
        promptInstall: vi.fn().mockResolvedValue('accepted'),
      });

      render(<CustomInstallButton />);

      const dismissalKeyReads = getItemSpy.mock.calls.filter(
        (call) => call[0] === STORAGE_KEY
      );
      expect(dismissalKeyReads.length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: /install admini application/i })).toBeInTheDocument();
    });

    it('does not evaluate any dismissal record when standalone, even if one exists in localStorage', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ timestamp: Date.now() }));

      mockUseInstallPrompt.mockReturnValue({
        isInstallable: true,
        isStandalone: true,
        promptInstall: vi.fn().mockResolvedValue('accepted'),
      });

      const { container } = render(<CustomInstallButton />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Integration: standalone transitions via reactive hook', () => {
    it('goes from visible to null and back to visible as isStandalone and isInstallable change', () => {
      mockUseInstallPrompt.mockReturnValue({
        isInstallable: true,
        isStandalone: false,
        promptInstall: vi.fn().mockResolvedValue('accepted'),
      });

      const { rerender, container } = render(<CustomInstallButton />);
      expect(container.firstChild).not.toBeNull();
      expect(screen.getByRole('button', { name: /install admini application/i })).toBeInTheDocument();

      act(() => {
        mockUseInstallPrompt.mockReturnValue({
          isInstallable: false,
          isStandalone: true,
          promptInstall: vi.fn().mockResolvedValue('accepted'),
        });
        rerender(<CustomInstallButton />);
      });

      expect(container.firstChild).toBeNull();

      act(() => {
        mockUseInstallPrompt.mockReturnValue({
          isInstallable: true,
          isStandalone: false,
          promptInstall: vi.fn().mockResolvedValue('accepted'),
        });
        rerender(<CustomInstallButton />);
      });

      expect(screen.getByRole('button', { name: /install admini application/i })).toBeInTheDocument();
    });
  });
});