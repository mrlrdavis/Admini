import { renderHook, act } from '@testing-library/react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

// Helper to create a mock BeforeInstallPromptEvent
function createMockPromptEvent(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  Object.defineProperty(event, 'prompt', {
    value: vi.fn().mockResolvedValue(undefined),
  });
  Object.defineProperty(event, 'userChoice', {
    value: Promise.resolve({ outcome, platform: 'web' }),
  });
  return event;
}

// Helper to mock matchMedia
function mockMatchMedia(matches: boolean) {
  const listeners: Array<(e: MediaQueryListEvent) => void> = [];
  const mediaQueryList = {
    matches,
    media: '(display-mode: standalone)',
    addEventListener: vi.fn((event: string, handler: (e: MediaQueryListEvent) => void) => {
      if (event === 'change') listeners.push(handler);
    }),
    removeEventListener: vi.fn((event: string, handler: (e: MediaQueryListEvent) => void) => {
      if (event === 'change') {
        const idx = listeners.indexOf(handler);
        if (idx !== -1) listeners.splice(idx, 1);
      }
    }),
    dispatchEvent: vi.fn(),
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
  };

  window.matchMedia = vi.fn().mockReturnValue(mediaQueryList);

  return { mediaQueryList, listeners };
}

describe('useInstallPrompt', () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  describe('event capture sets isInstallable to true', () => {
    it('should set isInstallable to true when beforeinstallprompt fires', async () => {
      mockMatchMedia(false);

      const { result } = renderHook(() => useInstallPrompt());

      expect(result.current.isInstallable).toBe(false);

      await act(async () => {
        const event = createMockPromptEvent();
        window.dispatchEvent(event);
      });

      expect(result.current.isInstallable).toBe(true);
    });

    it('should start with isInstallable false before any event', () => {
      mockMatchMedia(false);

      const { result } = renderHook(() => useInstallPrompt());

      expect(result.current.isInstallable).toBe(false);
    });
  });

  describe('promptInstall() triggers deferred prompt', () => {
    it('should call prompt() on the deferred event and return outcome', async () => {
      mockMatchMedia(false);

      const { result } = renderHook(() => useInstallPrompt());

      const mockEvent = createMockPromptEvent('accepted');

      await act(async () => {
        window.dispatchEvent(mockEvent);
      });

      expect(result.current.isInstallable).toBe(true);

      let outcome: string | undefined;
      await act(async () => {
        outcome = await result.current.promptInstall();
      });

      expect((mockEvent as any).prompt).toHaveBeenCalled();
      expect(outcome).toBe('accepted');
      expect(result.current.isInstallable).toBe(false);
    });

    it('should return dismissed when prompt is already consumed', async () => {
      mockMatchMedia(false);

      const { result } = renderHook(() => useInstallPrompt());

      let outcome: string | undefined;
      await act(async () => {
        outcome = await result.current.promptInstall();
      });

      expect(outcome).toBe('dismissed');
    });

    it('should set isInstallable to false after prompt is consumed', async () => {
      mockMatchMedia(false);

      const { result } = renderHook(() => useInstallPrompt());

      await act(async () => {
        window.dispatchEvent(createMockPromptEvent('dismissed'));
      });

      expect(result.current.isInstallable).toBe(true);

      await act(async () => {
        await result.current.promptInstall();
      });

      expect(result.current.isInstallable).toBe(false);
    });
  });

  describe('standalone detection returns isStandalone: true', () => {
    it('should detect standalone mode from matchMedia', () => {
      mockMatchMedia(true);

      const { result } = renderHook(() => useInstallPrompt());

      expect(result.current.isStandalone).toBe(true);
    });

    it('should return isInstallable as false when in standalone mode', async () => {
      mockMatchMedia(true);

      const { result } = renderHook(() => useInstallPrompt());

      expect(result.current.isInstallable).toBe(false);
      expect(result.current.isStandalone).toBe(true);
    });

    it('should return isStandalone false when not in standalone mode', () => {
      mockMatchMedia(false);

      const { result } = renderHook(() => useInstallPrompt());

      expect(result.current.isStandalone).toBe(false);
    });
  });

  describe('cleanup removes event listeners', () => {
    it('should remove beforeinstallprompt listener on unmount', async () => {
      mockMatchMedia(false);

      const addSpy = vi.spyOn(window, 'addEventListener');
      const removeSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => useInstallPrompt());

      // Verify the listener was added
      expect(addSpy).toHaveBeenCalledWith(
        'beforeinstallprompt',
        expect.any(Function)
      );

      unmount();

      // Verify the listener was removed
      expect(removeSpy).toHaveBeenCalledWith(
        'beforeinstallprompt',
        expect.any(Function)
      );
    });

    it('should remove matchMedia change listener on unmount', () => {
      const { mediaQueryList } = mockMatchMedia(false);

      const { unmount } = renderHook(() => useInstallPrompt());

      expect(mediaQueryList.addEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      );

      unmount();

      expect(mediaQueryList.removeEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      );
    });
  });
});
