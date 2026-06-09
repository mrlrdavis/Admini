import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Unit tests for useDismissal hook within CustomInstallButton.
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

// Mock @admini/pwa to provide controllable install prompt state
vi.mock('@admini/pwa', () => ({
  useInstallPrompt: vi.fn(() => ({
    isInstallable: true,
    isStandalone: false,
    promptInstall: vi.fn().mockResolvedValue('accepted'),
  })),
}));

import { useInstallPrompt } from '@admini/pwa';
import { CustomInstallButton } from '../CustomInstallButton';

const STORAGE_KEY = 'admini_install_dismissed';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

describe('CustomInstallButton - Dismissal Persistence', () => {
  beforeEach(() => {
    localStorage.clear();

    // Mock window.matchMedia for useResponsiveMode hook
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    vi.mocked(useInstallPrompt).mockReturnValue({
      isInstallable: true,
      isStandalone: false,
      promptInstall: vi.fn().mockResolvedValue('accepted'),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe('Requirement 3.1: Visible dismiss control', () => {
    it('renders a dismiss button separate from the install action', () => {
      render(<CustomInstallButton />);

      const dismissBtn = screen.getByRole('button', { name: /dismiss install prompt/i });
      const installBtn = screen.getByRole('button', { name: /install admini application/i });

      expect(dismissBtn).toBeInTheDocument();
      expect(installBtn).toBeInTheDocument();
      expect(dismissBtn).not.toBe(installBtn);
    });
  });

  describe('Requirement 3.2: Dismiss stores timestamp and hides immediately', () => {
    it('hides the button immediately when dismiss is clicked', async () => {
      const user = userEvent.setup();
      render(<CustomInstallButton />);

      expect(screen.getByRole('button', { name: /install admini application/i })).toBeInTheDocument();

      const dismissBtn = screen.getByRole('button', { name: /dismiss install prompt/i });
      await user.click(dismissBtn);

      expect(screen.queryByRole('button', { name: /install admini application/i })).not.toBeInTheDocument();
    });

    it('stores a dismissal record with current timestamp in localStorage', async () => {
      const user = userEvent.setup();
      const now = 1700000000000;
      vi.spyOn(Date, 'now').mockReturnValue(now);

      render(<CustomInstallButton />);

      const dismissBtn = screen.getByRole('button', { name: /dismiss install prompt/i });
      await user.click(dismissBtn);

      const stored = localStorage.getItem(STORAGE_KEY);
      expect(stored).not.toBeNull();
      const record = JSON.parse(stored!);
      expect(record.timestamp).toBe(now);
    });
  });

  describe('Requirement 3.3: 30-day cooldown prevents rendering', () => {
    it('does not render when a dismissal record exists within 30 days', () => {
      const recentTimestamp = Date.now() - (THIRTY_DAYS_MS - 1000);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ timestamp: recentTimestamp }));

      render(<CustomInstallButton />);

      expect(screen.queryByRole('button', { name: /install admini application/i })).not.toBeInTheDocument();
    });

    it('does not render when dismissal was just moments ago', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ timestamp: Date.now() }));

      render(<CustomInstallButton />);

      expect(screen.queryByRole('button', { name: /install admini application/i })).not.toBeInTheDocument();
    });
  });

  describe('Requirement 3.4: Button reappears after 30 days', () => {
    it('renders when the dismissal record is older than 30 days', () => {
      const expiredTimestamp = Date.now() - (THIRTY_DAYS_MS + 1000);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ timestamp: expiredTimestamp }));

      render(<CustomInstallButton />);

      expect(screen.getByRole('button', { name: /install admini application/i })).toBeInTheDocument();
    });

    it('renders when the dismissal record is exactly 30 days old', () => {
      const exactExpiry = Date.now() - THIRTY_DAYS_MS;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ timestamp: exactExpiry }));

      render(<CustomInstallButton />);

      // At exactly 30 days, Date.now() - timestamp === COOLDOWN_MS, which is NOT less than COOLDOWN_MS
      expect(screen.getByRole('button', { name: /install admini application/i })).toBeInTheDocument();
    });
  });

  describe('Requirement 3.5: Fallback to session-only dismissal', () => {
    it('renders the button when localStorage has invalid JSON', () => {
      localStorage.setItem(STORAGE_KEY, 'not-valid-json');

      render(<CustomInstallButton />);

      expect(screen.getByRole('button', { name: /install admini application/i })).toBeInTheDocument();
    });

    it('renders when stored record has no timestamp field', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: 'bar' }));

      render(<CustomInstallButton />);

      expect(screen.getByRole('button', { name: /install admini application/i })).toBeInTheDocument();
    });

    it('falls back to session-only dismissal when localStorage throws on read', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('Access denied', 'SecurityError');
      });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('Access denied', 'SecurityError');
      });
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new DOMException('Access denied', 'SecurityError');
      });

      render(<CustomInstallButton />);

      // Should still render (fallback = not dismissed initially)
      expect(screen.getByRole('button', { name: /install admini application/i })).toBeInTheDocument();
    });

    it('session-only dismissal hides the button without crashing when localStorage unavailable', async () => {
      const user = userEvent.setup();

      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('Access denied', 'SecurityError');
      });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('Access denied', 'SecurityError');
      });
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new DOMException('Access denied', 'SecurityError');
      });

      render(<CustomInstallButton />);

      // Button renders despite localStorage unavailability
      const dismissBtn = screen.getByRole('button', { name: /dismiss install prompt/i });
      await user.click(dismissBtn);

      // Button hides via React state (session-only)
      expect(screen.queryByRole('button', { name: /install admini application/i })).not.toBeInTheDocument();
    });
  });
});
