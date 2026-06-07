import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PWAProvider, usePWAContext } from '../context/PWAProvider';

/**
 * Unit tests for PWAProvider context.
 * Validates: Requirements 3.5, 6.1
 */

// Helper consumer component that exposes context values for testing
function ContextConsumer() {
  const { isOnline, isStandalone } = usePWAContext();
  return (
    <div>
      <span data-testid="is-online">{String(isOnline)}</span>
      <span data-testid="is-standalone">{String(isStandalone)}</span>
    </div>
  );
}

describe('PWAProvider', () => {
  let originalNavigatorOnLine: boolean;
  let matchMediaMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalNavigatorOnLine = navigator.onLine;
    matchMediaMock = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: matchMediaMock,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isOnline tracks online/offline events', () => {
    it('initializes isOnline from navigator.onLine (online)', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        configurable: true,
        value: true,
      });

      render(
        <PWAProvider>
          <ContextConsumer />
        </PWAProvider>
      );

      expect(screen.getByTestId('is-online').textContent).toBe('true');
    });

    it('initializes isOnline from navigator.onLine (offline)', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        configurable: true,
        value: false,
      });

      render(
        <PWAProvider>
          <ContextConsumer />
        </PWAProvider>
      );

      expect(screen.getByTestId('is-online').textContent).toBe('false');
    });

    it('updates isOnline to false on offline event', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        configurable: true,
        value: true,
      });

      render(
        <PWAProvider>
          <ContextConsumer />
        </PWAProvider>
      );

      expect(screen.getByTestId('is-online').textContent).toBe('true');

      act(() => {
        window.dispatchEvent(new Event('offline'));
      });

      expect(screen.getByTestId('is-online').textContent).toBe('false');
    });

    it('updates isOnline to true on online event', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        configurable: true,
        value: false,
      });

      render(
        <PWAProvider>
          <ContextConsumer />
        </PWAProvider>
      );

      expect(screen.getByTestId('is-online').textContent).toBe('false');

      act(() => {
        window.dispatchEvent(new Event('online'));
      });

      expect(screen.getByTestId('is-online').textContent).toBe('true');
    });
  });

  describe('isStandalone detects display mode', () => {
    it('detects standalone mode when matchMedia matches', () => {
      matchMediaMock.mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      });

      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        configurable: true,
        value: true,
      });

      render(
        <PWAProvider>
          <ContextConsumer />
        </PWAProvider>
      );

      expect(screen.getByTestId('is-standalone').textContent).toBe('true');
      expect(matchMediaMock).toHaveBeenCalledWith('(display-mode: standalone)');
    });

    it('detects non-standalone mode when matchMedia does not match', () => {
      matchMediaMock.mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      });

      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        configurable: true,
        value: true,
      });

      render(
        <PWAProvider>
          <ContextConsumer />
        </PWAProvider>
      );

      expect(screen.getByTestId('is-standalone').textContent).toBe('false');
    });
  });

  it('throws error when usePWAContext is used outside PWAProvider', () => {
    // Suppress React error boundary console output
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<ContextConsumer />)).toThrow(
      'usePWAContext must be used within a PWAProvider'
    );

    consoleSpy.mockRestore();
  });
});
