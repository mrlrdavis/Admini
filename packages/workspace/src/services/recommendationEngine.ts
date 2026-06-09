/**
 * RecommendationEngine
 *
 * Orchestrates recommendation generation by:
 *  - Fetching and limiting context (50 most-recent captures, 20 most-recent meeting notes)
 *  - Delegating to the active RecommendationProvider
 *  - Deduplicating against existing task titles (case-insensitive substring match)
 *  - Filtering dismissed recommendations within a 7-day cooldown window
 *  - Capping results at 5
 *  - Persisting HandledRecommendation records in IndexedDB
 *  - Enforcing a 5-second timeout on provider calls
 *
 * Requirements: 1.1, 1.5, 1.6, 2.1, 2.2, 2.3, 7.1, 8.2
 */

import {
  type Recommendation,
  type RecommendationContext,
  type RecommendationProvider,
  type HandledRecommendation,
  type Capture,
  type MeetingNote,
  nowIso,
  mapSupabaseError,
} from '@admini/shared';
import { getClient } from './getClient';
import { ruleBasedProvider } from './ruleBasedProvider';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_CAPTURES = 50;
const MAX_MEETING_NOTES = 20;
const MAX_RESULTS = 5;
const PROVIDER_TIMEOUT_MS = 5_000;
const DISMISS_COOLDOWN_DAYS = 7;

// ---------------------------------------------------------------------------
// IndexedDB for HandledRecommendations
// ---------------------------------------------------------------------------

const HANDLED_DB_NAME = 'admini_recommendations';
const HANDLED_DB_VERSION = 1;
const HANDLED_STORE = 'handled_recommendations';

function openHandledDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(HANDLED_DB_NAME, HANDLED_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(HANDLED_STORE)) {
        db.createObjectStore(HANDLED_STORE, { keyPath: 'recommendationId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function persistHandled(record: HandledRecommendation): Promise<void> {
  try {
    const db = await openHandledDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(HANDLED_STORE, 'readwrite');
      tx.objectStore(HANDLED_STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // IndexedDB unavailable (e.g. private browsing) -- fall back to in-memory only
  }
}

async function loadHandled(): Promise<HandledRecommendation[]> {
  try {
    const db = await openHandledDb();
    const records = await new Promise<HandledRecommendation[]>((resolve, reject) => {
      const tx = db.transaction(HANDLED_STORE, 'readonly');
      const request = tx.objectStore(HANDLED_STORE).getAll();
      request.onsuccess = () => resolve(request.result as HandledRecommendation[]);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return records;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Internal DB row types
// ---------------------------------------------------------------------------

interface DbCapture {
  id: string;
  redacted_text: string;
  mode: string;
  status: string;
  created_at: string;
}

interface DbMeetingNote {
  id: string;
  title: string;
  body: string;
  attendees: string[];
  created_at: string;
  updated_at: string;
  created_by: string;
}

interface DbTaskTitle {
  title: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Provider timed out after ${ms}ms`)),
        ms,
      ),
    ),
  ]);
}

function isDuplicateOfExistingTask(
  candidate: string,
  existingTitles: string[],
): boolean {
  const lower = candidate.toLowerCase();
  return existingTitles.some((existing) => {
    const existingLower = existing.toLowerCase();
    return lower.includes(existingLower) || existingLower.includes(lower);
  });
}

function isWithinCooldown(handledAt: string): boolean {
  const handledMs = new Date(handledAt).getTime();
  const cooldownMs = DISMISS_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - handledMs < cooldownMs;
}

// ---------------------------------------------------------------------------
// RecommendationEngineImpl
// ---------------------------------------------------------------------------

class RecommendationEngineImpl {
  private provider: RecommendationProvider;
  private cache = new Map<string, Recommendation[]>();
  private handledMap = new Map<string, HandledRecommendation>();

  constructor(provider: RecommendationProvider) {
    this.provider = provider;
    void this.hydrateHandledMap();
  }

  private async hydrateHandledMap(): Promise<void> {
    const records = await loadHandled();
    for (const r of records) {
      this.handledMap.set(r.recommendationId, r);
    }
  }

  async getRecommendations(userId: string, orgId: string): Promise<Recommendation[]> {
    const cacheKey = `${userId}:${orgId}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    const results = await this.generateRecommendations(userId, orgId);
    this.cache.set(cacheKey, results);
    return results;
  }

  async markHandled(
    recommendationId: string,
    action: 'accepted' | 'dismissed',
  ): Promise<void> {
    const record: HandledRecommendation = {
      recommendationId,
      action,
      handledAt: nowIso(),
    };
    this.handledMap.set(recommendationId, record);
    this.cache.clear();
    await persistHandled(record);
  }

  async refreshRecommendations(userId: string, orgId: string): Promise<Recommendation[]> {
    const cacheKey = `${userId}:${orgId}`;
    this.cache.delete(cacheKey);
    const results = await this.generateRecommendations(userId, orgId);
    this.cache.set(cacheKey, results);
    return results;
  }

  private async generateRecommendations(
    userId: string,
    orgId: string,
  ): Promise<Recommendation[]> {
    const client = getClient();

    // 1. Fetch up to MAX_CAPTURES most-recent captures (Requirement 1.6)
    const { data: captureRows, error: captureError } = await client
      .from('captures')
      .select('id, redacted_text, mode, status, created_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(MAX_CAPTURES)
      .returns<DbCapture[]>();

    if (captureError) throw new Error(mapSupabaseError(captureError));

    const recentCaptures: Capture[] = (captureRows ?? []).map((row) => ({
      id: row.id,
      organizationId: orgId,
      createdBy: userId,
      source: 'desktop' as const,
      mode: row.mode as Capture['mode'],
      redactedText: row.redacted_text,
      tokenCount: 0,
      status: row.status as Capture['status'],
      createdAt: row.created_at,
    }));

    // 2. Fetch up to MAX_MEETING_NOTES most-recent meeting notes (Requirement 1.6)
    const { data: noteRows, error: noteError } = await client
      .from('meeting_notes')
      .select('id, title, body, attendees, created_at, updated_at, created_by')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(MAX_MEETING_NOTES)
      .returns<DbMeetingNote[]>();

    if (noteError) throw new Error(mapSupabaseError(noteError));

    const recentMeetingNotes: MeetingNote[] = (noteRows ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body || '',
      attendees: row.attendees || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
    }));

    // 3. Fetch existing task titles for deduplication (Requirements 2.1, 2.2)
    const { data: taskRows, error: taskError } = await client
      .from('tasks')
      .select('title')
      .eq('organization_id', orgId)
      .neq('status', 'archived')
      .returns<DbTaskTitle[]>();

    if (taskError) throw new Error(mapSupabaseError(taskError));

    const existingTaskTitles: string[] = (taskRows ?? []).map((r) => r.title);

    // 4. Collect dismissed IDs still within cooldown window (Requirement 2.3)
    const dismissedWithinCooldown: string[] = [];
    for (const [id, record] of this.handledMap) {
      if (record.action === 'dismissed' && isWithinCooldown(record.handledAt)) {
        dismissedWithinCooldown.push(id);
      }
    }

    // 5. Build provider context
    const context: RecommendationContext = {
      userId,
      organizationId: orgId,
      recentCaptures,
      recentMeetingNotes,
      existingTaskTitles,
      dismissedRecommendationIds: dismissedWithinCooldown,
      maxResults: MAX_RESULTS,
    };

    // 6. Call provider with 5-second timeout (Requirement 8.2)
    let providerResults: Recommendation[];
    try {
      providerResults = await withTimeout(
        this.provider.generateRecommendations(context),
        PROVIDER_TIMEOUT_MS,
      );
    } catch {
      // Timeout or provider error -- return empty list
      return [];
    }

    // 7. Post-process: filter handled + deduplicate against tasks + cap
    //    (Requirements 1.5, 2.1, 2.2, 2.3)
    const filtered: Recommendation[] = [];
    for (const rec of providerResults) {
      if (filtered.length >= MAX_RESULTS) break;

      // Skip if already handled (accepted, or dismissed within cooldown)
      const handled = this.handledMap.get(rec.id);
      if (handled) {
        if (handled.action === 'accepted') continue;
        if (handled.action === 'dismissed' && isWithinCooldown(handled.handledAt)) continue;
      }

      // Skip duplicates against existing tasks
      if (isDuplicateOfExistingTask(rec.title, existingTaskTitles)) continue;

      filtered.push(rec);
    }

    return filtered;
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const recommendationEngine = new RecommendationEngineImpl(ruleBasedProvider);
