/**
 * Integration Status Storage
 *
 * Stores integration connection statuses in IndexedDB.
 * Actual OAuth/API key connections are out of scope - this tracks
 * which integrations the user has "connected" locally.
 *
 * Falls back to localStorage when IndexedDB is unavailable.
 */

import type { IntegrationProvider, IntegrationStatus } from '@admini/shared';

export interface IntegrationConnectionStatus {
  provider: IntegrationProvider;
  status: IntegrationStatus;
  connectedAt?: string;
}

const DB_NAME = 'admini-integrations';
const DB_VERSION = 1;
const STORE_NAME = 'connections';
const LS_KEY = 'admini_integration_statuses';

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

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'provider' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ---------------------------------------------------------------------------
// localStorage fallback helpers
// ---------------------------------------------------------------------------

function getFromLocalStorage(): IntegrationConnectionStatus[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as IntegrationConnectionStatus[]) : [];
  } catch {
    return [];
  }
}

function saveToLocalStorage(statuses: IntegrationConnectionStatus[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(statuses));
  } catch {
    // Storage quota exceeded or localStorage blocked - silently ignore
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load all integration connection statuses from storage.
 */
export async function loadIntegrationStatuses(): Promise<IntegrationConnectionStatus[]> {
  if (!isIndexedDBAvailable()) {
    return getFromLocalStorage();
  }

  try {
    const db = await openDb();
    const statuses = await new Promise<IntegrationConnectionStatus[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result as IntegrationConnectionStatus[]);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return statuses;
  } catch {
    return getFromLocalStorage();
  }
}

/**
 * Save a single integration's connection status.
 */
export async function saveIntegrationStatus(entry: IntegrationConnectionStatus): Promise<void> {
  if (!isIndexedDBAvailable()) {
    const current = getFromLocalStorage();
    const idx = current.findIndex((c) => c.provider === entry.provider);
    if (idx >= 0) {
      current[idx] = entry;
    } else {
      current.push(entry);
    }
    saveToLocalStorage(current);
    return;
  }

  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Fallback to localStorage
    const current = getFromLocalStorage();
    const idx = current.findIndex((c) => c.provider === entry.provider);
    if (idx >= 0) {
      current[idx] = entry;
    } else {
      current.push(entry);
    }
    saveToLocalStorage(current);
  }
}

/**
 * Remove an integration's connection status (disconnect).
 */
export async function removeIntegrationStatus(provider: IntegrationProvider): Promise<void> {
  if (!isIndexedDBAvailable()) {
    const current = getFromLocalStorage().filter((c) => c.provider !== provider);
    saveToLocalStorage(current);
    return;
  }

  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(provider);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    const current = getFromLocalStorage().filter((c) => c.provider !== provider);
    saveToLocalStorage(current);
  }
}
