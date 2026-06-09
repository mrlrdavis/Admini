import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Accessibility tests for CustomInstallButton ARIA live region.
 * Validates: Requirements 5.4, 5.5
 */

// Mock @admini/pwa to provide controllable install prompt state
const mockUseInstallPrompt = vi.fn(() => ({
  isInstallable: true,
  isStandalone: false,
  promptInstall: vi.fn().mockResolvedValue('accepted'),
}));

vi.mock('@admini/pwa', () => ({
  useInstallPrompt: () => mockUseInstallPrompt(),
}));

import { CustomInstallButton } from '../CustomInstallButton';

describe('CustomInstallButton - Accessibility (ARIA Live Region)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();

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

    mockUseInstallPrompt.mockReturnValue({
      isInstallable: true,
      isStandalone: false,
      promptInstall: vi.fn().mockResolvedValue('accepted'),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('Requirement 5.4: ARIA live region exists', () => {
    it('renders a live region with role="status" when the button is visible', async () => {
      render(<CustomInstallButton />);

      await waitFor(() => {
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toBeInTheDocument();
        expect(liveRegion).toHaveAttribute('aria-live', 'polite');
        expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
      });
    });

    it('renders a live region even when the button is not visible (isInstallable is false)', () => {
      mockUseInstallPrompt.mockReturnValue({
        isInstallable: false,
        isStandalone: false,
        promptInstall: vi.fn().mockResolvedValue('accepted'),
      });

      render(<CustomInstallButton />);

      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toBeInTheDocument();
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    });

    it('does not render a live region in standalone mode', () => {
      mockUseInstallPrompt.mockReturnValue({
        isInstallable: true,
        isStandalone: true,
        promptInstall: vi.fn().mockResolvedValue('accepted'),
      });

      render(<CustomInstallButton />);

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  describe('Requirement 5.4: Announces button appearance', () => {
    it('announces availability when the button first appears', async () => {
      render(<CustomInstallButton />);

      await waitFor(() => {
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent('Install AdminI prompt is available');
      });
    });

    it('announces availability when button becomes visible after being hidden', async () => {
      // Start hidden
      mockUseInstallPrompt.mockReturnValue({
        isInstallable: false,
        isStandalone: false,
        promptInstall: vi.fn().mockResolvedValue('accepted'),
      });

      const { rerender } = render(<CustomInstallButton />);

      // Become visible
      mockUseInstallPrompt.mockReturnValue({
        isInstallable: true,
        isStandalone: false,
        promptInstall: vi.fn().mockResolvedValue('accepted'),
      });

      rerender(<CustomInstallButton />);

      await waitFor(() => {
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent('Install AdminI prompt is available');
      });
    });
  });

  describe('Requirement 5.5: Announces dismissal', () => {
    it('announces dismissal when the button is dismissed by user', async () => {
      const user = userEvent.setup();
      render(<CustomInstallButton />);

      const dismissBtn = screen.getByRole('button', { name: /dismiss install prompt/i });
      await user.click(dismissBtn);

      await waitFor(() => {
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent('Install prompt dismissed');
      });
    });

    it('live region persists in DOM after button is dismissed', async () => {
      const user = userEvent.setup();
      render(<CustomInstallButton />);

      const dismissBtn = screen.getByRole('button', { name: /dismiss install prompt/i });
      await user.click(dismissBtn);

      await waitFor(() => {
        // Button should be gone
        expect(screen.queryByRole('button', { name: /install admini application/i })).not.toBeInTheDocument();
      });

      // Live region should still be present
      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toBeInTheDocument();
    });
  });

  describe('Requirement 5.5: WCAG contrast approach', () => {
    it('install button uses CSS classes backed by design tokens for WCAG contrast', () => {
      render(<CustomInstallButton />);

      const installBtn = screen.getByRole('button', { name: /install admini application/i });
      expect(installBtn.className).toContain('custom-install-button__install-btn');
    });

    it('dismiss button uses CSS classes backed by design tokens for WCAG contrast', () => {
      render(<CustomInstallButton />);

      const dismissBtn = screen.getByRole('button', { name: /dismiss install prompt/i });
      expect(dismissBtn.className).toContain('custom-install-button__dismiss-btn');
    });
  });
});