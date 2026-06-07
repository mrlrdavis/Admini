/**
 * Represents the browser's `beforeinstallprompt` event.
 * This event is fired when the browser determines the app meets installability criteria.
 */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

/**
 * Internal state for managing the install prompt lifecycle.
 */
export interface InstallPromptState {
  deferredPrompt: BeforeInstallPromptEvent | null;
  status: 'idle' | 'prompted' | 'accepted' | 'dismissed';
}

/**
 * Context value provided by PWAProvider for tracking
 * connectivity and display mode state.
 */
export interface PWAContextValue {
  /** Whether the device currently has network connectivity */
  isOnline: boolean;
  /** Whether the app is running in standalone (installed) mode */
  isStandalone: boolean;
}
