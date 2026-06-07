import { createContext, useContext, useEffect, useState } from 'react';
import type { PWAContextValue } from '../types';

const PWAContext = createContext<PWAContextValue | undefined>(undefined);

/**
 * Provides PWA connectivity and display mode state to the component tree.
 *
 * Tracks online/offline status via navigator.onLine and browser events.
 * Detects standalone (installed) mode via matchMedia.
 */
export function PWAProvider(props: { children: React.ReactNode }): React.ReactElement {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isStandalone] = useState<boolean>(
    () => window.matchMedia('(display-mode: standalone)').matches
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <PWAContext.Provider value={{ isOnline, isStandalone }}>
      {props.children}
    </PWAContext.Provider>
  );
}

/**
 * Access PWA context values (isOnline, isStandalone).
 * Must be used within a PWAProvider.
 */
export function usePWAContext(): PWAContextValue {
  const context = useContext(PWAContext);
  if (context === undefined) {
    throw new Error('usePWAContext must be used within a PWAProvider');
  }
  return context;
}
