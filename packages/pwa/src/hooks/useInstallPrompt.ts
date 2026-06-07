import { useCallback, useEffect, useRef, useState } from 'react';
import type { BeforeInstallPromptEvent } from '../types';

export interface UseInstallPromptReturn {
  /** Whether the app is installable (beforeinstallprompt was captured) */
  isInstallable: boolean;
  /** Whether the app is running in standalone mode */
  isStandalone: boolean;
  /** Trigger the native install prompt */
  promptInstall: () => Promise<'accepted' | 'dismissed'>;
}

/**
 * Hook that manages the PWA install prompt lifecycle.
 *
 * - Listens for `beforeinstallprompt` and stores the deferred event
 * - Detects standalone mode via `window.matchMedia('(display-mode: standalone)')`
 * - Returns `isInstallable: false` when standalone or after prompt is consumed
 * - Cleans up event listeners on unmount
 */
export function useInstallPrompt(): UseInstallPromptReturn {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isStandalone, setIsStandalone] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(display-mode: standalone)').matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(display-mode: standalone)');

    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      setIsStandalone(e.matches);
      if (e.matches) {
        // When entering standalone mode, app is no longer installable
        deferredPromptRef.current = null;
        setIsInstallable(false);
      }
    };

    mediaQuery.addEventListener('change', handleDisplayModeChange);

    return () => {
      mediaQuery.removeEventListener('change', handleDisplayModeChange);
    };
  }, []);

  useEffect(() => {
    // Don't listen for install prompt if already in standalone mode
    if (isStandalone) return;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [isStandalone]);

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed'> => {
    const prompt = deferredPromptRef.current;
    if (!prompt) {
      return 'dismissed';
    }

    // Consume and clear the stored event
    deferredPromptRef.current = null;
    setIsInstallable(false);

    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    return outcome;
  }, []);

  return {
    isInstallable: isStandalone ? false : isInstallable,
    isStandalone,
    promptInstall,
  };
}
