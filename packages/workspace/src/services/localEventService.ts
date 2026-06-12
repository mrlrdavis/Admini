/**
 * Local Event Service
 *
 * CRUD operations for locally-created calendar events (not from Google Calendar).
 * Events are persisted in localStorage under a consistent key.
 *
 * If localStorage is unavailable (e.g., private browsing), the service degrades
 * gracefully - reads return empty arrays, writes are no-ops.
 */

import type { LocalEvent } from './calendarMerge';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** localStorage key used to persist local events. */
export const LOCAL_EVENTS_STORAGE_KEY = 'admini:local-events';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function readEvents(): LocalEvent[] {
  try {
    const raw = localStorage.getItem(LOCAL_EVENTS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LocalEvent[];
  } catch {
    return [];
  }
}

function writeEvents(events: LocalEvent[]): void {
  try {
    localStorage.setItem(LOCAL_EVENTS_STORAGE_KEY, JSON.stringify(events));
  } catch {
    // localStorage unavailable or quota exceeded - silently ignore
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Retrieve all stored local events. Returns an empty array on failure. */
export function getLocalEvents(): LocalEvent[] {
  return readEvents();
}

/** Create a new local event. Returns the created event with a generated ID. */
export function createLocalEvent(event: Omit<LocalEvent, 'id'>): LocalEvent {
  const newEvent: LocalEvent = {
    id: crypto.randomUUID(),
    ...event,
  };
  const events = readEvents();
  events.push(newEvent);
  writeEvents(events);
  return newEvent;
}

/**
 * Update an existing local event by replacing it with the provided event data.
 * Returns the updated event.
 * Throws if the event ID is not found.
 */
export function updateLocalEvent(event: LocalEvent): LocalEvent {
  const events = readEvents();
  const index = events.findIndex((e) => e.id === event.id);
  if (index === -1) {
    throw new Error(`Local event not found: ${event.id}`);
  }
  events[index] = event;
  writeEvents(events);
  return event;
}

/**
 * Delete a local event by ID.
 * No-op if the event does not exist.
 */
export function deleteLocalEvent(eventId: string): void {
  const events = readEvents();
  const filtered = events.filter((e) => e.id !== eventId);
  writeEvents(filtered);
}

// ---------------------------------------------------------------------------
// Legacy aliases (backward compatibility)
// ---------------------------------------------------------------------------

/** @deprecated Use getLocalEvents() */
export const getAll = getLocalEvents;

/** @deprecated Use createLocalEvent() */
export const create = createLocalEvent;

/** @deprecated Use deleteLocalEvent() */
export function deleteEvent(id: string): boolean {
  const events = readEvents();
  const index = events.findIndex((e) => e.id === id);
  if (index === -1) return false;
  events.splice(index, 1);
  writeEvents(events);
  return true;
}

/** @deprecated Use updateLocalEvent() */
export function update(
  id: string,
  updates: Partial<Omit<LocalEvent, 'id'>>,
): LocalEvent | null {
  const events = readEvents();
  const index = events.findIndex((e) => e.id === id);
  if (index === -1) return null;
  const existing = events[index]!;
  const updated: LocalEvent = { ...existing, ...updates };
  events[index] = updated;
  writeEvents(events);
  return updated;
}
