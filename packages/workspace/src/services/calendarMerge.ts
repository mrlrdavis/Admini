/**
 * Calendar Event Merging Service
 *
 * Implements Algorithm 1: Event Merging (Google Calendar + Local Events)
 * Merges Google Calendar events with locally-created events, giving local
 * events priority when IDs conflict. Returns a sorted, deduplicated array.
 */

import type { CalendarEvent } from './googleIntegrationService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A locally-created calendar event (stored in localStorage or Supabase). */
export interface LocalEvent {
  id: string;
  summary: string;
  start: string; // ISO date or datetime
  end: string;
}

/** A merged event with source attribution. */
export interface MergedEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  source: 'google' | 'local';
}

// ---------------------------------------------------------------------------
// Algorithm 1: Event Merging
// ---------------------------------------------------------------------------

/**
 * Merge Google Calendar events with local events.
 *
 * Steps:
 *  1. Create a Map keyed by event ID
 *  2. Insert local events first (local has priority)
 *  3. Insert Google events only if their ID is not already present
 *  4. Collect all map values
 *  5. Sort ascending by start using localeCompare (stable sort)
 *  6. Return sorted array
 *
 * Invariants:
 *  - result.length === number of unique IDs across both inputs
 *  - No two items share the same ID
 *  - Result is sorted ascending by start time
 */
export function mergeEvents(
  googleEvents: CalendarEvent[],
  localEvents: LocalEvent[],
): MergedEvent[] {
  // Step 1: Create map keyed by event ID
  const map = new Map<string, MergedEvent>();

  // Step 2: Insert local events (local events have priority)
  for (const event of localEvents) {
    map.set(event.id, {
      id: event.id,
      summary: event.summary,
      start: event.start,
      end: event.end,
      source: 'local',
    });
  }

  // Step 3: Insert Google events only if ID not already present
  for (const event of googleEvents) {
    if (!map.has(event.id)) {
      map.set(event.id, {
        id: event.id,
        summary: event.summary,
        start: event.start,
        end: event.end,
        source: 'google',
      });
    }
    // If map already contains this ID, skip (local takes precedence)
  }

  // Step 4: Collect all map values into an array
  const merged = Array.from(map.values());

  // Step 5: Sort by start ascending using localeCompare (stable sort)
  merged.sort((a, b) => a.start.localeCompare(b.start));

  // Step 6: Return sorted array
  return merged;
}
