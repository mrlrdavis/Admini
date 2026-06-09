export type AdminiRole = 'admin' | 'principal' | 'teacher' | 'staff';
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
  | 'google_classroom'
  | 'email'
  | 'calendar';

// Soft-deprecation: providers that may still exist in DB records
export type DeprecatedIntegrationProvider = 'schoology' | 'infinite_campus';

// Union of all known providers (current + deprecated) for DB queries
export type AnyIntegrationProvider = IntegrationProvider | DeprecatedIntegrationProvider;

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


// ---------------------------------------------------------------------------
// Meeting Notes
// ---------------------------------------------------------------------------

export type MeetingNote = {
  id: string;
  title: string;
  body: string;
  attendees: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
};

// ---------------------------------------------------------------------------
// Task Recommendations
// ---------------------------------------------------------------------------

export type RecommendationSource = 'capture' | 'meeting_note' | 'calendar_event' | 'pulse';

export type Recommendation = {
  id: string;
  title: string;
  description?: string;
  sourceType: RecommendationSource;
  sourceId: string;
  sourceExcerpt: string;
  confidence: number; // 0.0 - 1.0
  suggestedPriority: TaskPriority;
  createdAt: string;
};

export type RecommendationContext = {
  userId: string;
  organizationId: string;
  recentCaptures: Capture[];
  recentMeetingNotes: MeetingNote[];
  existingTaskTitles: string[];
  dismissedRecommendationIds: string[];
  maxResults: number;
};

export type HandledRecommendation = {
  recommendationId: string;
  action: 'accepted' | 'dismissed';
  handledAt: string;
};

export interface RecommendationProvider {
  generateRecommendations(context: RecommendationContext): Promise<Recommendation[]>;
}

export { clearAdminiBrowserState, createIndexedDbStorage } from './browser-storage';
export { mapSupabaseError, withFriendlyError } from './supabase-errors';
export type { SupabaseErrorLike } from './supabase-errors';
