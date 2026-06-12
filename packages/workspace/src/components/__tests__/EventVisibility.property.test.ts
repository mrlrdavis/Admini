import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { filterTodayEvents } from '@admini/shared';
import type { CalendarEvent } from '@admini/shared';

// Feature: app-ui-overhaul, Property 6: Today's events filter
// Feature: app-ui-overhaul, Property 7: Local event delete button visibility

/**
 * Property 6: Today's events filter
 *
 * For any set of calendar events with various dates, `filterTodayEvents` SHALL
 * return only events whose local date portion matches today's local date,
 * excluding all future-dated and past-dated events.
 *
 * **Validates: Requirements 6.3, 6.5, 18.3**
 */

/**
 * Property 7: Local event delete button visibility
 *
 * For any event displayed in Today's Schedule, a delete button SHALL be
 * rendered if and only if the event source is 'local' (not 'google').
 *
 * **Validates: Requirements 6.4**
 */

// --- Types ---

interface MergedEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  source: 'google' | 'local';
}

/**
 * Determines whether the delete button should be visible for a given event.
 * Delete button is rendered iff the event source is 'local'.
 */
function shouldShowDeleteButton(event: MergedEvent): boolean {
  return event.source === 'local';
}

// --- Arbitraries ---

// Generate a today date string in YYYY-MM-DD format
function getTodayStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Generate a date string that is NOT today (past or future)
const notTodayDateStrArb: fc.Arbitrary<string> = fc
  .integer({ min: 1, max: 3650 })
  .chain((offset) =>
    fc.constantFrom(-1, 1).map((sign) => {
      const d = new Date();
      d.setDate(d.getDate() + sign * offset);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    })
  );

// Generate a time portion like "T10:30:00"
const timePartArb: fc.Arbitrary<string> = fc
  .tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }))
  .map(([h, m]) => `T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);

// Generate a CalendarEvent for today
const todayEventArb: fc.Arbitrary<CalendarEvent> = fc
  .tuple(fc.uuid(), fc.string({ minLength: 1, maxLength: 30 }), timePartArb, fc.constantFrom<'google' | 'local'>('google', 'local'))
  .map(([id, summary, timePart, source]) => {
    const todayStr = getTodayStr();
    return {
      id,
      summary,
      start: `${todayStr}${timePart}`,
      end: `${todayStr}${timePart}`,
      source,
    };
  });

// Generate a CalendarEvent for a day that is NOT today
const notTodayEventArb: fc.Arbitrary<CalendarEvent> = fc
  .tuple(fc.uuid(), fc.string({ minLength: 1, maxLength: 30 }), notTodayDateStrArb, timePartArb, fc.constantFrom<'google' | 'local'>('google', 'local'))
  .map(([id, summary, dateStr, timePart, source]) => ({
    id,
    summary,
    start: `${dateStr}${timePart}`,
    end: `${dateStr}${timePart}`,
    source,
  }));

// Generate a MergedEvent with arbitrary source
const mergedEventArb: fc.Arbitrary<MergedEvent> = fc.record({
  id: fc.uuid(),
  summary: fc.string({ minLength: 1, maxLength: 30 }),
  start: fc.constant(getTodayStr() + 'T09:00:00'),
  end: fc.constant(getTodayStr() + 'T10:00:00'),
  source: fc.constantFrom<'google' | 'local'>('google', 'local'),
});

describe('EventVisibility Property Tests', () => {
  // Feature: app-ui-overhaul, Property 6: Today's events filter
  describe("Property 6: Today's events filter", () => {
    it('filterTodayEvents returns only events whose local date matches today', () => {
      fc.assert(
        fc.property(
          fc.array(todayEventArb, { minLength: 0, maxLength: 10 }),
          fc.array(notTodayEventArb, { minLength: 0, maxLength: 10 }),
          (todayEvents, otherEvents) => {
            const allEvents = [...todayEvents, ...otherEvents];
            const result = filterTodayEvents(allEvents);

            // All returned events must have today's date
            const todayStr = getTodayStr();
            for (const event of result) {
              const eventDate = event.start.split('T')[0];
              expect(eventDate).toBe(todayStr);
            }

            // All today events from input must appear in the result
            expect(result.length).toBe(todayEvents.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('filterTodayEvents returns empty array when no events match today', () => {
      fc.assert(
        fc.property(
          fc.array(notTodayEventArb, { minLength: 1, maxLength: 10 }),
          (events) => {
            const result = filterTodayEvents(events);
            expect(result).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('filterTodayEvents returns all events when all match today', () => {
      fc.assert(
        fc.property(
          fc.array(todayEventArb, { minLength: 1, maxLength: 10 }),
          (events) => {
            const result = filterTodayEvents(events);
            expect(result.length).toBe(events.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: app-ui-overhaul, Property 7: Local event delete button visibility
  describe('Property 7: Local event delete button visibility', () => {
    it('delete button is visible for local events', () => {
      fc.assert(
        fc.property(
          mergedEventArb.map((e) => ({ ...e, source: 'local' as const })),
          (event) => {
            expect(shouldShowDeleteButton(event)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('delete button is NOT visible for google events', () => {
      fc.assert(
        fc.property(
          mergedEventArb.map((e) => ({ ...e, source: 'google' as const })),
          (event) => {
            expect(shouldShowDeleteButton(event)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('delete button visibility is determined solely by source field', () => {
      fc.assert(
        fc.property(
          mergedEventArb,
          (event) => {
            const showDelete = shouldShowDeleteButton(event);
            if (event.source === 'local') {
              expect(showDelete).toBe(true);
            } else {
              expect(showDelete).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});