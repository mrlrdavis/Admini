export type AdminiRole = 'admin' | 'staff' | 'viewer';
export type AppSurface = 'desktop' | 'mobile';
export type RetentionKind = 'captures' | 'tasks' | 'observations';

export const RETENTION_DAYS: Record<RetentionKind, number> = {
  captures: 90,
  tasks: 365,
  observations: 1095
};

export type Organization = {
  id: string;
  name: string;
  createdAt: string;
};

export type Profile = {
  id: string;
  organizationId: string;
  email: string;
  displayName: string;
  role: AdminiRole;
};

export type CaptureStatus = 'queued' | 'synced' | 'failed';
export type TaskStatus = 'open' | 'in_progress' | 'completed' | 'archived';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export type Capture = {
  id: string;
  organizationId: string;
  createdBy: string;
  source: AppSurface;
  mode: 'voice' | 'tap' | 'typed';
  redactedText: string;
  tokenCount: number;
  status: CaptureStatus;
  createdAt: string;
};

export type Task = {
  id: string;
  organizationId: string;
  createdBy: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type CaptureTaskLink = {
  captureId: string;
  taskId: string;
};

export type IntegrationProvider =
  | 'schoology'
  | 'infinite_campus'
  | 'google_workspace'
  | 'apple_school_manager'
  | 'microsoft_365';
export type IntegrationStatus = 'not_configured' | 'mock' | 'connected' | 'error';

export type IntegrationConnection = {
  id: string;
  organizationId: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type IntegrationAuthMode = 'oauth' | 'sso' | 'api_key' | 'manual_import';

export type IntegrationCatalogItem = {
  provider: IntegrationProvider;
  name: string;
  category: 'sis' | 'lms' | 'identity' | 'productivity';
  description: string;
  authModes: IntegrationAuthMode[];
  scopes: string[];
  persistenceTargets: Array<'indexeddb' | 'supabase' | 'worker_secret'>;
};

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export type SyncQueueItem = {
  id: string;
  entityType: 'capture' | 'task';
  payload: unknown;
  attempts: number;
  createdAt: string;
  lastAttemptAt?: string;
};

export function nowIso(): string {
  return new Date().toISOString();
}

export function createClientId(prefix: string): string {
  const randomId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  return `${prefix}_${randomId}`;
}

export function openSyncQueueDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('admini_sync_queue', 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueueSyncItem(item: Omit<SyncQueueItem, 'attempts' | 'createdAt'>): Promise<void> {
  const db = await openSyncQueueDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('queue', 'readwrite');
    tx.objectStore('queue').put({
      ...item,
      attempts: 0,
      createdAt: nowIso()
    } satisfies SyncQueueItem);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function listSyncQueueItems(): Promise<SyncQueueItem[]> {
  const db = await openSyncQueueDb();
  const items = await new Promise<SyncQueueItem[]>((resolve, reject) => {
    const tx = db.transaction('queue', 'readonly');
    const request = tx.objectStore('queue').getAll();
    request.onsuccess = () => resolve(request.result as SyncQueueItem[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return items;
}

export { clearAdminiBrowserState, createIndexedDbStorage } from './browser-storage';
