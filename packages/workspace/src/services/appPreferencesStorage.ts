/**
 * App Preferences Storage
 *
 * Local-only preferences stored in IndexedDB.
 * These are NOT server-synced — they stay on the device.
 */

export interface AppPreferences {
  theme: 'light' | 'dark' | 'system';
  defaultTab: string;
  compactMode: boolean;
}

const DEFAULT_PREFERENCES: AppPreferences = {
  theme: 'system',
  defaultTab: 'dashboard',
  compactMode: false,
};

const DB_NAME = 'admini_app_preferences';
const DB_VERSION = 1;
const STORE_NAME = 'preferences';
const PREFS_KEY = 'app_preferences';

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

/**
 * Retrieve stored app preferences, falling back to defaults for any missing fields.
 */
export async function getAppPreferences(): Promise<AppPreferences> {
  try {
    const db = await openPreferencesDb();
    const stored = await new Promise<Partial<AppPreferences> | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(PREFS_KEY);
      request.onsuccess = () => {
        const result = request.result as { key: string; value: Partial<AppPreferences> } | undefined;
        resolve(result?.value ?? null);
      };
      request.onerror = () => reject(request.error);
    });
    db.close();

    return { ...DEFAULT_PREFERENCES, ...stored };
  } catch {
    // If IndexedDB is unavailable (e.g., private browsing), return defaults
    return { ...DEFAULT_PREFERENCES };
  }
}

/**
 * Merge partial preferences with existing stored preferences and save.
 */
export async function saveAppPreferences(prefs: Partial<AppPreferences>): Promise<void> {
  const db = await openPreferencesDb();

  // Read current value to merge
  const current = await new Promise<Partial<AppPreferences> | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(PREFS_KEY);
    request.onsuccess = () => {
      const result = request.result as { key: string; value: Partial<AppPreferences> } | undefined;
      resolve(result?.value ?? null);
    };
    request.onerror = () => reject(request.error);
  });

  const merged: AppPreferences = { ...DEFAULT_PREFERENCES, ...current, ...prefs };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ key: PREFS_KEY, value: merged });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  db.close();
}
