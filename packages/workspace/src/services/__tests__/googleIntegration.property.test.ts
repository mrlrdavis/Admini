/**
 * Property-based tests for Calendar Event Merging (Algorithm 1)
 *
 * Feature: app-ui-overhaul, Property 11: Event merge completeness
 *
 * For any set of Google Calendar events and local events, the merged result
 * SHALL contain every event from both sources with the combined length equal
 * to the count of unique IDs (no items lost or duplicated). Also verify:
 * result sorted ascending by start, no duplicate IDs, local events take
 * priority when IDs conflict.
 *
 * **Validates: Requirements 13.2**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { mergeEvents } from '../calendarMerge';
import type { LocalEvent } from '../calendarMerge';
import type { CalendarEvent } from '../googleIntegrationService';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generate a valid ISO datetime string for use as event start/end. */
const isoDateTimeArb: fc.Arbitrary<string> = fc
  .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
  .map((d) => d.toISOString());

/** Generate a CalendarEvent (Google Calendar event). */
const calendarEventArb: fc.Arbitrary<CalendarEvent> = fc.record({
  id: fc.uuid(),
  summary: fc.string({ minLength: 1, maxLength: 50 }),
  start: isoDateTimeArb,
  end: isoDateTimeArb,
});

/** Generate a LocalEvent. */
const localEventArb: fc.Arbitrary<LocalEvent> = fc.record({
  id: fc.uuid(),
  summary: fc.string({ minLength: 1, maxLength: 50 }),
  start: isoDateTimeArb,
  end: isoDateTimeArb,
});

/** Generate an array of CalendarEvents. */
const googleEventsArb: fc.Arbitrary<CalendarEvent[]> = fc.array(calendarEventArb, {
  minLength: 0,
  maxLength: 20,
});

/** Generate an array of LocalEvents. */
const localEventsArb: fc.Arbitrary<LocalEvent[]> = fc.array(localEventArb, {
  minLength: 0,
  maxLength: 20,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Property 11: Event merge completeness', () => {
  // Feature: app-ui-overhaul, Property 11: Event merge completeness

  it('merged result length equals the count of unique IDs across both inputs', () => {
    fc.assert(
      fc.property(googleEventsArb, localEventsArb, (googleEvents, localEvents) => {
        const result = mergeEvents(googleEvents, localEvents);

        // Compute unique IDs across both inputs
        const allIds = new Set<string>();
        for (const e of localEvents) allIds.add(e.id);
        for (const e of googleEvents) allIds.add(e.id);

        expect(result.length).toBe(allIds.size);
      }),
      { numRuns: 100 },
    );
  });

  it('merged result contains no duplicate IDs', () => {
    fc.assert(
      fc.property(googleEventsArb, localEventsArb, (googleEvents, localEvents) => {
        const result = mergeEvents(googleEvents, localEvents);

        const ids = result.map((e) => e.id);
        const uniqueIds = new Set(ids);
        expect(ids.length).toBe(uniqueIds.size);
      }),
      { numRuns: 100 },
    );
  });

  it('merged result is sorted ascending by start time', () => {
    fc.assert(
      fc.property(googleEventsArb, localEventsArb, (googleEvents, localEvents) => {
        const result = mergeEvents(googleEvents, localEvents);

        for (let i = 1; i < result.length; i++) {
          expect(result[i].start.localeCompare(result[i - 1].start)).toBeGreaterThanOrEqual(0);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('local events take priority when IDs conflict', () => {
    // Generate events with overlapping IDs to specifically test priority
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
        fc.array(isoDateTimeArb, { minLength: 1, maxLength: 10 }),
        (sharedIds, times) => {
          // Create local and google events sharing some IDs
          const localEvents: LocalEvent[] = sharedIds.map((id, i) => ({
            id,
            summary: `local-${id}`,
            start: times[i % times.length],
            end: times[i % times.length],
          }));

          const googleEvents: CalendarEvent[] = sharedIds.map((id, i) => ({
            id,
            summary: `google-${id}`,
            start: times[(i + 1) % times.length],
            end: times[(i + 1) % times.length],
          }));

          const result = mergeEvents(googleEvents, localEvents);

          // For each shared ID, the result should have source='local'
          for (const id of sharedIds) {
            const merged = result.find((e) => e.id === id);
            expect(merged).toBeDefined();
            expect(merged!.source).toBe('local');
            expect(merged!.summary).toBe(`local-${id}`);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('every event from both sources appears in the merged result (no items lost)', () => {
    fc.assert(
      fc.property(googleEventsArb, localEventsArb, (googleEvents, localEvents) => {
        const result = mergeEvents(googleEvents, localEvents);
        const resultIds = new Set(result.map((e) => e.id));

        // Every local event ID must appear
        for (const e of localEvents) {
          expect(resultIds.has(e.id)).toBe(true);
        }

        // Every google event ID must appear
        for (const e of googleEvents) {
          expect(resultIds.has(e.id)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});
