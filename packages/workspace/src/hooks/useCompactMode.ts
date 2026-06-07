import { useEffect, useCallback, useState } from 'react';
import { getAppPreferences, saveAppPreferences } from '../services/appPreferencesStorage';

// ---------------------------------------------------------------------------
// useCompactMode
//
// Manages the compact mode preference lifecycle:
// 1. Loads saved compact mode state from IndexedDB on mount
// 2. Applies/removes the 'compact-mode' CSS class on document.documentElement
// 3. Provides a setter for toggling the preference
//
// Requirement: REQ-11 - Compact mode toggle works
// ---------------------------------------------------------------------------

const COMPACT_CLASS = 'compact-mode';

/**
 * Apply or remove the compact-mode class on the document root element.
 */
function applyCompactMode(enabled: boolean): void {
  if (enabled) {
    document.documentElement.classList.add(COMPACT_CLASS);
  } else {
    document.documentElement.classList.remove(COMPACT_CLASS);
  }
}

export interface UseCompactModeReturn {
  /** Whether compact mode is currently enabled. */
  compactMode: boolean;
  /** Toggle or explicitly set compact mode (persists to IndexedDB and applies immediately). */
  setCompactMode: (enabled: boolean) => void;
}

/**
 * Hook that manages the compact mode preference.
 * Loads from IndexedDB on mount, applies to DOM, and provides a setter.
 */
export function useCompactMode(): UseCompactModeReturn {
  const [compactMode, setCompactModeState] = useState<boolean>(false);

  // -------------------------------------------------------------------------
  // Load saved preference on mount and apply it
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function loadAndApply() {
      try {
        const prefs = await getAppPreferences();
        if (cancelled) return;

        setCompactModeState(prefs.compactMode);
        applyCompactMode(prefs.compactMode);
      } catch {
        // Fallback: leave compact mode off if storage read fails
        if (cancelled) return;
        applyCompactMode(false);
      }
    }

    loadAndApply();
    return () => { cancelled = true; };
  }, []);

  // -------------------------------------------------------------------------
  // Setter: update preference, persist, and apply immediately
  // -------------------------------------------------------------------------
  const setCompactMode = useCallback((enabled: boolean) => {
    setCompactModeState(enabled);
    applyCompactMode(enabled);

    // Persist to IndexedDB (fire-and-forget)
    saveAppPreferences({ compactMode: enabled }).catch(() => {
      // Storage write failed - compact mode is still applied in-memory for this session
    });
  }, []);

  return { compactMode, setCompactMode };
}
