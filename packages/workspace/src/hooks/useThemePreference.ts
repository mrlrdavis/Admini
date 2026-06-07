import { useEffect, useCallback, useRef, useState } from 'react';
import { getAppPreferences, saveAppPreferences } from '../services/appPreferencesStorage';
import type { ThemePreference } from '../components/AppPreferences';

// ---------------------------------------------------------------------------
// useThemePreference
//
// Manages the theme preference lifecycle:
// 1. Loads saved theme from IndexedDB on mount
// 2. Applies the resolved theme as `data-theme` attribute on <html>
// 3. Listens for OS-level color-scheme changes when mode is 'system'
// 4. Provides a setter for when the user changes their preference
//
// Requirement: REQ-11 - Theme toggle works and persists
// ---------------------------------------------------------------------------

/**
 * Resolve the effective theme ('light' or 'dark') from a preference value.
 * When 'system', queries the OS-level prefers-color-scheme media query.
 */
function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference === 'system') {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }
  return preference;
}

/**
 * Apply the resolved theme to the document root element.
 */
function applyTheme(resolved: 'light' | 'dark'): void {
  document.documentElement.setAttribute('data-theme', resolved);
}

export interface UseThemePreferenceReturn {
  /** The current theme preference ('light' | 'dark' | 'system'). */
  themePreference: ThemePreference;
  /** The resolved/applied theme ('light' | 'dark'). */
  resolvedTheme: 'light' | 'dark';
  /** Update the theme preference (persists to IndexedDB and applies immediately). */
  setThemePreference: (theme: ThemePreference) => void;
}

/**
 * Hook that manages the application theme preference.
 * Loads from IndexedDB, applies to DOM, and listens for system changes.
 */
export function useThemePreference(): UseThemePreferenceReturn {
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => resolveTheme('system'));
  const mediaQueryRef = useRef<MediaQueryList | null>(null);

  // -------------------------------------------------------------------------
  // Load saved preference on mount and apply it
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function loadAndApply() {
      try {
        const prefs = await getAppPreferences();
        if (cancelled) return;

        const saved = prefs.theme;
        setThemePreferenceState(saved);

        const resolved = resolveTheme(saved);
        setResolvedTheme(resolved);
        applyTheme(resolved);
      } catch {
        // Fallback: apply system theme if storage read fails
        if (cancelled) return;
        const resolved = resolveTheme('system');
        setResolvedTheme(resolved);
        applyTheme(resolved);
      }
    }

    loadAndApply();
    return () => { cancelled = true; };
  }, []);

  // -------------------------------------------------------------------------
  // Listen for OS-level color-scheme changes when mode is 'system'
  // -------------------------------------------------------------------------
  useEffect(() => {
    // Clean up previous listener
    const prevMq = mediaQueryRef.current;
    if (prevMq) {
      mediaQueryRef.current = null;
    }

    if (themePreference !== 'system') return;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQueryRef.current = mq;

    function handleChange(e: MediaQueryListEvent) {
      const resolved: 'light' | 'dark' = e.matches ? 'dark' : 'light';
      setResolvedTheme(resolved);
      applyTheme(resolved);
    }

    mq.addEventListener('change', handleChange);

    return () => {
      mq.removeEventListener('change', handleChange);
      mediaQueryRef.current = null;
    };
  }, [themePreference]);

  // -------------------------------------------------------------------------
  // Setter: update preference, persist, and apply immediately
  // -------------------------------------------------------------------------
  const setThemePreference = useCallback((theme: ThemePreference) => {
    setThemePreferenceState(theme);

    const resolved = resolveTheme(theme);
    setResolvedTheme(resolved);
    applyTheme(resolved);

    // Persist to IndexedDB (fire-and-forget)
    saveAppPreferences({ theme }).catch(() => {
      // Storage write failed - theme is still applied in-memory for this session
    });
  }, []);

  return { themePreference, resolvedTheme, setThemePreference };
}
