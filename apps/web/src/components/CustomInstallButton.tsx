import { useState, useCallback, useEffect, useRef } from 'react';
import { useInstallPrompt } from '@admini/pwa';
import './CustomInstallButton.css';

const STORAGE_KEY = 'admini_install_dismissed';
const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MOBILE_BREAKPOINT = '(max-width: 768px)';
const ANIMATION_SESSION_KEY = 'admini_install_animated';

interface DismissalRecord {
  timestamp: number;
}

/**
 * Internal hook that manages dismissal persistence with localStorage.
 * Falls back to session-only (useState) if localStorage is unavailable.
 *
 * - When skipStorage is true (standalone mode): skips all localStorage reads/writes
 * - On mount: reads localStorage, parses timestamp, checks if within 30-day cooldown
 * - On dismiss: writes { timestamp: Date.now() } to localStorage
 * - If localStorage throws (private browsing, quota, security): falls back to useState
 */
function useDismissal(skipStorage = false): { isDismissed: boolean; dismiss: () => void } {
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    if (skipStorage) return false;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const record: DismissalRecord = JSON.parse(raw);
      if (typeof record.timestamp !== 'number') return false;
      return Date.now() - record.timestamp < COOLDOWN_MS;
    } catch {
      // localStorage unavailable or JSON parse failed - start as not dismissed
      return false;
    }
  });

  const [storageAvailable] = useState<boolean>(() => {
    if (skipStorage) return false;
    try {
      const testKey = '__admini_storage_test__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  });

  const dismiss = useCallback(() => {
    setIsDismissed(true);
    if (storageAvailable) {
      try {
        const record: DismissalRecord = { timestamp: Date.now() };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
      } catch {
        // Storage write failed - session-only dismissal is already set via state
      }
    }
  }, [storageAvailable]);

  return { isDismissed, dismiss };
}

/**
 * Responsive layout mode detection hook.
 * Uses window.matchMedia with a change listener to detect viewport width.
 * Returns 'mobile' when viewport is at or below 768px, 'desktop' otherwise.
 * Handles resize transitions without unmounting - state-driven rendering.
 */
function useResponsiveMode(): 'desktop' | 'mobile' {
  const [mode, setMode] = useState<'desktop' | 'mobile'>(() => {
    if (typeof window === 'undefined') return 'desktop';
    return window.matchMedia(MOBILE_BREAKPOINT).matches ? 'mobile' : 'desktop';
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(MOBILE_BREAKPOINT);

    const handleChange = (e: MediaQueryListEvent) => {
      setMode(e.matches ? 'mobile' : 'desktop');
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return mode;
}

/**
 * First-appearance tracking hook for entrance animation.
 * Uses sessionStorage to track whether animation has already played this session.
 *
 * - On first render where shouldShow becomes true and sessionStorage flag is absent:
 *   returns true (apply animation class) and sets sessionStorage flag to "1".
 * - On subsequent appearances in the same session: returns false (no animation class).
 * - If sessionStorage is unavailable: always returns true (harmless default - always animate).
 */
function useIsFirstAppearance(shouldShow: boolean): boolean {
  const hasAnimatedRef = useRef<boolean | null>(null);

  if (hasAnimatedRef.current === null) {
    // Initialize on first call: check if we already animated this session
    try {
      hasAnimatedRef.current = sessionStorage.getItem(ANIMATION_SESSION_KEY) === '1';
    } catch {
      // sessionStorage unavailable - treat as never animated (will always animate)
      hasAnimatedRef.current = false;
    }
  }

  const isFirst = shouldShow && !hasAnimatedRef.current;

  if (isFirst) {
    // Mark as animated for the rest of this session
    hasAnimatedRef.current = true;
    try {
      sessionStorage.setItem(ANIMATION_SESSION_KEY, '1');
    } catch {
      // sessionStorage write failed - animation flag is still set in ref
    }
  }

  return isFirst;
}

/**
 * Hook that manages the ARIA live region announcement message.
 * Tracks visibility transitions and produces appropriate screen reader messages.
 */
function useLiveAnnouncement(shouldShow: boolean): string {
  const [liveMessage, setLiveMessage] = useState<string>('');
  const prevShouldShowRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (prevShouldShowRef.current !== null && prevShouldShowRef.current !== shouldShow) {
      if (shouldShow) {
        setLiveMessage('Install AdminI prompt is available');
      } else {
        setLiveMessage('Install prompt dismissed');
      }
    } else if (prevShouldShowRef.current === null && shouldShow) {
      // First render where button is already visible
      setLiveMessage('Install AdminI prompt is available');
    }
    prevShouldShowRef.current = shouldShow;
  }, [shouldShow]);

  return liveMessage;
}

/**
 * Download icon SVG component.
 */
function DownloadIcon() {
  return (
    <svg
      className="custom-install-button__icon"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 1v9m0 0L5 7m3 3l3-3M3 13h10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Custom branded PWA install button that replaces the generic InstallButton.
 *
 * Visibility logic: renders only when isInstallable AND not dismissed AND not standalone.
 * Adapts between desktop (header action) and mobile (banner card) via useResponsiveMode.
 *
 * When isStandalone is true, no DOM nodes are rendered and no localStorage reads occur.
 * The skipStorage parameter is passed to useDismissal to prevent any storage operations
 * in standalone mode (Requirement 6.4).
 */
export function CustomInstallButton(): React.ReactElement | null {
  const { isInstallable, isStandalone, promptInstall } = useInstallPrompt();
  const { isDismissed, dismiss } = useDismissal(isStandalone);
  const mode = useResponsiveMode();

  const shouldShow = isInstallable && !isDismissed && !isStandalone;

  // All hooks must be called unconditionally (before any early returns)
  const isFirstAppearance = useIsFirstAppearance(shouldShow);
  const liveMessage = useLiveAnnouncement(shouldShow);

  // Standalone check - skip all rendering including live region
  if (isStandalone) {
    return null;
  }

  const handleInstall = async () => {
    await promptInstall();
  };

  const handleDismiss = () => {
    dismiss();
  };

  // Always render the wrapper with a live region for screen reader announcements.
  // The button content is conditionally rendered inside.
  if (!shouldShow) {
    return (
      <div className="custom-install-button__live-wrapper">
        <span
          className="custom-install-button__sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {liveMessage}
        </span>
      </div>
    );
  }

  const baseClass = 'custom-install-button';
  const modeClass = `${baseClass}--${mode}`;
  const animateClass = isFirstAppearance ? `${baseClass}--animate-in` : '';
  const className = [baseClass, modeClass, animateClass].filter(Boolean).join(' ');

  return (
    <div className="custom-install-button__live-wrapper">
      <span
        className="custom-install-button__sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {liveMessage}
      </span>
      <div className={className} role="group" aria-label="Install prompt">
        <button
          type="button"
          className="custom-install-button__install-btn"
          onClick={handleInstall}
          aria-label="Install AdminI application"
        >
          <DownloadIcon />
          <span>Install AdminI</span>
        </button>
        <button
          type="button"
          className="custom-install-button__dismiss-btn"
          onClick={handleDismiss}
          aria-label="Dismiss install prompt"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
