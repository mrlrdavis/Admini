/**
 * App Preferences Storage
 *
 * Local-only preferences stored in IndexedDB.
 * These are NOT server-synced - they stay on the device.
 *
 * Falls back to localStorage when IndexedDB is unavailable
 * (e.g., some private browsing modes).
 */

export interface AppPreferencesData {
  theme: 'light' | 'dark' | 'system';
  defaultTab: string;
  compactMode: boolean;
  taskRecommendationsEnabled: boolean;
}

/** @deprecated Use AppPreferencesData instead */
export type AppPreferences = AppPreferencesData;

export const DEFAULT_PREFERENCES: AppPreferencesData = {
  theme: 'system',
  defaultTab: 'capture',
  compactMode: false,
  taskRecommendationsEnabled: true,
};

const DB_NAME = 'admini-app-prefs';
const DB_VERSION = 1;
const STORE_NAME = 'preferences';
const PREFS_KEY = 'app-prefs';
const LS_KEY = 'admini_app_preferences';

// ---------------------------------------------------------------------------
// IndexedDB helpers
// ---------------------------------------------------------------------------

function isIndexedDBAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

function openPreferencesDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ---------------------------------------------------------------------------
// localStorage fallback helpers
// ---------------------------------------------------------------------------

function getFromLocalStorage(): Partial<AppPreferencesData> | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Partial<AppPreferencesData>) : null;
  } catch {
    return null;
  }
}

function saveToLocalStorage(prefs: AppPreferencesData): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(prefs));
  } catch {
    // Storage quota exceeded or localStorage blocked - silently ignore
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Retrieve stored app preferences, falling back to defaults for any missing fields.
 * Uses IndexedDB as primary store; falls back to localStorage if unavailable.
 */
export async function getAppPreferences(): Promise<AppPreferencesData> {
  if (!isIndexedDBAvailable()) {
    const stored = getFromLocalStorage();
    return { ...DEFAULT_PREFERENCES, ...stored };
  }

  try {
    const db = await openPreferencesDb();
    const stored = await new Promise<Partial<AppPreferencesData> | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(PREFS_KEY);
      request.onsuccess = () => {
        const result = request.result as { key: string; value: Partial<AppPreferencesData> } | undefined;
        resolve(result?.value ?? null);
      };
      request.onerror = () => reject(request.error);
    });
    db.close();

    return { ...DEFAULT_PREFERENCES, ...stored };
  } catch {
    // IndexedDB failed at runtime - fall back to localStorage
    const stored = getFromLocalStorage();
    return { ...DEFAULT_PREFERENCES, ...stored };
  }
}

/**
 * Merge partial preferences with existing stored preferences and save.
 * Uses IndexedDB as primary store; falls back to localStorage if unavailable.
 */
export async function saveAppPreferences(prefs: Partial<AppPreferencesData>): Promise<void> {
  if (!isIndexedDBAvailable()) {
    const current = getFromLocalStorage();
    const merged: AppPreferencesData = { ...DEFAULT_PREFERENCES, ...current, ...prefs };
    saveToLocalStorage(merged);
    return;
  }

  try {
    const db = await openPreferencesDb();

    // Read current value to merge
    const current = await new Promise<Partial<AppPreferencesData> | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(PREFS_KEY);
      request.onsuccess = () => {
        const result = request.result as { key: string; value: Partial<AppPreferencesData> } | undefined;
        resolve(result?.value ?? null);
      };
      request.onerror = () => reject(request.error);
    });

    const merged: AppPreferencesData = { ...DEFAULT_PREFERENCES, ...current, ...prefs };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ key: PREFS_KEY, value: merged });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    db.close();
  } catch {
    // IndexedDB failed at runtime - fall back to localStorage
    const current = getFromLocalStorage();
    const merged: AppPreferencesData = { ...DEFAULT_PREFERENCES, ...current, ...prefs };
    saveToLocalStorage(merged);
  }
}
