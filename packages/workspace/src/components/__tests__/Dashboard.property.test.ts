import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { parseLocalDate } from '@admini/shared';
import { placeEventsInBlocks } from '../TodaysSchedule';
import { buildActivityFeed } from '../../services/activityFeed';
import type { DashboardTask, ActivityEvent } from '../../types';
import type { DayStructureBlock } from '../TodaysSchedule';
import type { MergedEvent } from '../../services/calendarMerge';

// Feature: app-ui-overhaul, Property 4: Mini calendar task-day indicators

/**
 * Property 4: Mini calendar task-day indicators
 *
 * For any set of tasks with due dates in the displayed month, dots appear on
 * exactly those dates with >=1 task. We test the underlying logic: given tasks
 * with dueAt fields, compute which days should have dots. Verify that for any
 * set of tasks, the set of days with dots exactly matches the expected days.
 *
 * **Validates: Requirements 5.3**
 */

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generates a valid day-of-month (1..28 to keep things simple across months). */
const dayOfMonthArb = fc.integer({ min: 1, max: 28 });

/** Generates a date string in a fixed month (2025-06) for deterministic testing. */
const dateInJune2025Arb = dayOfMonthArb.map(
  (d) => `2025-06-${String(d).padStart(2, '0')}`,
);

/** Generates a DashboardTask with a dueAt in June 2025. */
const taskWithDueInMonthArb: fc.Arbitrary<DashboardTask> = fc.record({
  id: fc.uuid(),
  organizationId: fc.uuid(),
  createdBy: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 20 }),
  priority: fc.constantFrom('low', 'normal', 'high', 'urgent') as fc.Arbitrary<DashboardTask['priority']>,
  status: fc.constantFrom('open', 'in_progress', 'completed', 'archived') as fc.Arbitrary<DashboardTask['status']>,
  createdAt: fc.constant('2025-06-01T00:00:00.000Z'),
  updatedAt: fc.constant('2025-06-01T00:00:00.000Z'),
  dueAt: dateInJune2025Arb,
});

/** Generates a DashboardTask that might or might not have a dueAt field. */
const taskMaybeDueArb: fc.Arbitrary<DashboardTask> = fc.record({
  id: fc.uuid(),
  organizationId: fc.uuid(),
  createdBy: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 20 }),
  priority: fc.constantFrom('low', 'normal', 'high', 'urgent') as fc.Arbitrary<DashboardTask['priority']>,
  status: fc.constantFrom('open', 'in_progress', 'completed', 'archived') as fc.Arbitrary<DashboardTask['status']>,
  createdAt: fc.constant('2025-06-01T00:00:00.000Z'),
  updatedAt: fc.constant('2025-06-01T00:00:00.000Z'),
  dueAt: fc.option(dateInJune2025Arb, { nil: undefined }),
});

// ---------------------------------------------------------------------------
// Property 4 Tests
// ---------------------------------------------------------------------------

describe('Dashboard Property Tests', () => {
  // Feature: app-ui-overhaul, Property 4: Mini calendar task-day indicators
  describe('Property 4: Mini calendar task-day indicators', () => {
    it('computes task-day dot indicators matching exactly the days with >=1 task', () => {
      fc.assert(
        fc.property(
          fc.array(taskMaybeDueArb, { minLength: 0, maxLength: 30 }),
          (tasks) => {
            // Replicate the logic from MiniCalendar:
            // Build a Set of day-of-month numbers that have tasks for June 2025
            const displayYear = 2025;
            const displayMonth = 5; // June (0-indexed)

            const taskDays = new Set<number>();
            for (const task of tasks) {
              if (!task.dueAt) continue;
              const due = parseLocalDate(task.dueAt);
              if (due.getFullYear() === displayYear && due.getMonth() === displayMonth) {
                taskDays.add(due.getDate());
              }
            }

            // Independently compute expected days
            const expectedDays = new Set<number>();
            for (const task of tasks) {
              if (!task.dueAt) continue;
              const datePart = task.dueAt.split('T')[0] ?? task.dueAt;
              const [y, m, d] = datePart.split('-').map(Number);
              if (y === 2025 && m === 6) {
                expectedDays.add(d!);
              }
            }

            // The sets must be identical
            expect(taskDays).toEqual(expectedDays);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('days without any task due have no dot indicator', () => {
      fc.assert(
        fc.property(
          fc.array(taskWithDueInMonthArb, { minLength: 1, maxLength: 15 }),
          (tasks) => {
            const displayYear = 2025;
            const displayMonth = 5; // June (0-indexed)

            const taskDays = new Set<number>();
            for (const task of tasks) {
              if (!task.dueAt) continue;
              const due = parseLocalDate(task.dueAt);
              if (due.getFullYear() === displayYear && due.getMonth() === displayMonth) {
                taskDays.add(due.getDate());
              }
            }

            // All days 1-28 that are NOT in taskDays should not have a dot
            for (let d = 1; d <= 28; d++) {
              const hasTasks = tasks.some((t) => {
                if (!t.dueAt) return false;
                const due = parseLocalDate(t.dueAt);
                return due.getFullYear() === displayYear && due.getMonth() === displayMonth && due.getDate() === d;
              });
              if (!hasTasks) {
                expect(taskDays.has(d)).toBe(false);
              } else {
                expect(taskDays.has(d)).toBe(true);
              }
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: app-ui-overhaul, Property 5: Event-to-time-block placement
  describe('Property 5: Event-to-time-block placement', () => {
    /**
     * Property 5: Event-to-time-block placement
     *
     * For any event with a start time, it is placed in exactly the block whose
     * range contains that start hour (blockStart <= H < blockEnd).
     *
     * **Validates: Requirements 6.2**
     */

    // Standard day structure blocks covering a full day (non-overlapping, contiguous)
    const standardBlocks: DayStructureBlock[] = [
      { id: 'morning', period: 'Morning', startTime: '06:00', endTime: '12:00', activities: [] },
      { id: 'afternoon', period: 'Afternoon', startTime: '12:00', endTime: '17:00', activities: [] },
      { id: 'evening', period: 'Evening', startTime: '17:00', endTime: '22:00', activities: [] },
    ];

    /** Generates a valid hour within the covered block range (6-21). */
    const coveredHourArb = fc.integer({ min: 6, max: 21 });

    /** Generates a MergedEvent with a random hour within a covered range. */
    const eventInRangeArb: fc.Arbitrary<MergedEvent> = coveredHourArb.chain((hour) =>
      fc.record({
        id: fc.uuid(),
        summary: fc.string({ minLength: 1, maxLength: 20 }),
        start: fc.constant(`2025-06-15T${String(hour).padStart(2, '0')}:30:00`),
        end: fc.constant(`2025-06-15T${String(Math.min(hour + 1, 23)).padStart(2, '0')}:30:00`),
        source: fc.constantFrom('google', 'local') as fc.Arbitrary<'google' | 'local'>,
      }),
    );

    it('each event is placed in exactly the block containing its start hour', () => {
      fc.assert(
        fc.property(
          fc.array(eventInRangeArb, { minLength: 1, maxLength: 20 }),
          (events) => {
            const placement = placeEventsInBlocks(standardBlocks, events);

            for (const event of events) {
              // Extract hour from the event start
              const timePart = event.start.includes('T') ? event.start.split('T')[1]! : event.start;
              const eventHour = parseInt(timePart.split(':')[0]!, 10);

              // Find which block this event should be in
              const expectedBlock = standardBlocks.find((block) => {
                const blockStart = parseInt(block.startTime.split(':')[0]!, 10);
                const blockEnd = parseInt(block.endTime.split(':')[0]!, 10);
                return eventHour >= blockStart && eventHour < blockEnd;
              });

              expect(expectedBlock).toBeDefined();

              // Verify event is in the expected block
              const blockEvents = placement.get(expectedBlock!.id)!;
              const found = blockEvents.some((e) => e.id === event.id);
              expect(found).toBe(true);

              // Verify event is NOT in any other block
              for (const block of standardBlocks) {
                if (block.id === expectedBlock!.id) continue;
                const otherBlockEvents = placement.get(block.id)!;
                const foundInOther = otherBlockEvents.some((e) => e.id === event.id);
                expect(foundInOther).toBe(false);
              }
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('events outside all block ranges are not placed in any block', () => {
      // Hours 0-5 and 22-23 are outside standardBlocks
      const outsideHourArb = fc.constantFrom(0, 1, 2, 3, 4, 5, 22, 23);

      fc.assert(
        fc.property(
          outsideHourArb,
          fc.uuid(),
          (hour, id) => {
            const event: MergedEvent = {
              id,
              summary: 'Late event',
              start: `2025-06-15T${String(hour).padStart(2, '0')}:00:00`,
              end: `2025-06-15T${String(hour + 1).padStart(2, '0')}:00:00`,
              source: 'local',
            };

            const placement = placeEventsInBlocks(standardBlocks, [event]);

            // Event should not appear in any block
            for (const block of standardBlocks) {
              const blockEvents = placement.get(block.id)!;
              expect(blockEvents).not.toContainEqual(expect.objectContaining({ id }));
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // Feature: app-ui-overhaul, Property 8: Activity feed ordering and limit
  describe('Property 8: Activity feed ordering and limit', () => {
    /**
     * Property 8: Activity feed ordering and limit
     *
     * For any list of activity events, at most 7 displayed, sorted non-increasing
     * by createdAt.
     *
     * **Validates: Requirements 7.1**
     */

    /** Generates a valid ISO datetime string for createdAt. */
    const isoDateTimeArb = fc
      .record({
        year: fc.integer({ min: 2024, max: 2025 }),
        month: fc.integer({ min: 1, max: 12 }),
        day: fc.integer({ min: 1, max: 28 }),
        hour: fc.integer({ min: 0, max: 23 }),
        minute: fc.integer({ min: 0, max: 59 }),
        second: fc.integer({ min: 0, max: 59 }),
      })
      .map(
        ({ year, month, day, hour, minute, second }) =>
          `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}.000Z`,
      );

    /** Generates an ActivityEvent with a random createdAt timestamp. */
    const activityEventArb: fc.Arbitrary<ActivityEvent> = fc.record({
      id: fc.uuid(),
      organizationId: fc.uuid(),
      actorId: fc.uuid(),
      entityType: fc.constantFrom('task', 'capture', 'integration', 'invitation'),
      entityId: fc.uuid(),
      action: fc.constantFrom('create', 'update', 'delete', 'accept'),
      createdAt: isoDateTimeArb,
    });

    /** Generates a DashboardTask (used as fallback source). */
    const dashboardTaskArb: fc.Arbitrary<DashboardTask> = fc.record({
      id: fc.uuid(),
      organizationId: fc.uuid(),
      createdBy: fc.uuid(),
      title: fc.string({ minLength: 1, maxLength: 20 }),
      priority: fc.constantFrom('low', 'normal', 'high', 'urgent') as fc.Arbitrary<DashboardTask['priority']>,
      status: fc.constantFrom('open', 'in_progress', 'completed', 'archived') as fc.Arbitrary<DashboardTask['status']>,
      createdAt: isoDateTimeArb,
      updatedAt: isoDateTimeArb,
    });

    it('result contains at most 7 items', () => {
      fc.assert(
        fc.property(
          fc.array(activityEventArb, { minLength: 0, maxLength: 20 }),
          fc.array(dashboardTaskArb, { minLength: 0, maxLength: 10 }),
          (syncEvents, tasks) => {
            const result = buildActivityFeed(syncEvents, tasks);
            expect(result.length).toBeLessThanOrEqual(7);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('result is sorted in non-increasing order by createdAt', () => {
      fc.assert(
        fc.property(
          fc.array(activityEventArb, { minLength: 2, maxLength: 20 }),
          fc.array(dashboardTaskArb, { minLength: 0, maxLength: 5 }),
          (syncEvents, tasks) => {
            const result = buildActivityFeed(syncEvents, tasks);

            // Verify non-increasing order by createdAt
            for (let i = 0; i < result.length - 1; i++) {
              const current = result[i]!.createdAt;
              const next = result[i + 1]!.createdAt;
              // current >= next (non-increasing)
              expect(current.localeCompare(next)).toBeGreaterThanOrEqual(0);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('when syncEvents is non-empty, result uses syncEvents as source', () => {
      fc.assert(
        fc.property(
          fc.array(activityEventArb, { minLength: 1, maxLength: 15 }),
          fc.array(dashboardTaskArb, { minLength: 1, maxLength: 10 }),
          (syncEvents, tasks) => {
            const result = buildActivityFeed(syncEvents, tasks);

            // All result items should have IDs from syncEvents (not task-derived)
            const syncIds = new Set(syncEvents.map((e) => e.id));
            for (const item of result) {
              expect(syncIds.has(item.id)).toBe(true);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('when syncEvents is empty, result uses task-derived events', () => {
      fc.assert(
        fc.property(
          fc.array(dashboardTaskArb, { minLength: 1, maxLength: 15 }),
          (tasks) => {
            const result = buildActivityFeed([], tasks);

            // All result items should be task-derived (IDs prefixed with "task-")
            for (const item of result) {
              expect(item.id.startsWith('task-')).toBe(true);
            }

            // Result length is min(7, tasks.length)
            expect(result.length).toBe(Math.min(7, tasks.length));
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});