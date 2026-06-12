/**
 * Property-based tests for Activity Feed Ordering and Capping (Algorithm 2)
 *
 * Feature: app-ui-overhaul, Property 8 (extended for algorithms): Activity feed ordering and limit
 *
 * For any list of activity events and tasks, buildActivityFeed returns at most
 * 7 items sorted non-increasing by createdAt. If syncEvents is non-empty, no
 * task-derived items appear.
 *
 * **Validates: Requirements 7.1**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { buildActivityFeed } from '../activityFeed';
import type { ActivityEvent, DashboardTask } from '../../types';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generate a valid ISO datetime string. */
const isoDateTimeArb: fc.Arbitrary<string> = fc
  .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
  .map((d) => d.toISOString());

/** Generate an ActivityEvent. */
const activityEventArb: fc.Arbitrary<ActivityEvent> = fc.record({
  id: fc.uuid(),
  organizationId: fc.uuid(),
  actorId: fc.uuid(),
  entityType: fc.constantFrom('task', 'capture', 'note', 'observation'),
  entityId: fc.uuid(),
  action: fc.constantFrom('created', 'updated', 'completed', 'deleted'),
  createdAt: isoDateTimeArb,
});

/** Generate a DashboardTask. */
const dashboardTaskArb: fc.Arbitrary<DashboardTask> = fc.record({
  id: fc.uuid(),
  organizationId: fc.uuid(),
  createdBy: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 50 }),
  priority: fc.constantFrom('low', 'normal', 'high', 'urgent'),
  status: fc.constantFrom('open', 'in_progress', 'completed', 'archived'),
  createdAt: isoDateTimeArb,
  updatedAt: isoDateTimeArb,
});

/** Generate an array of ActivityEvents. */
const syncEventsArb: fc.Arbitrary<ActivityEvent[]> = fc.array(activityEventArb, {
  minLength: 0,
  maxLength: 20,
});

/** Generate a non-empty array of ActivityEvents. */
const nonEmptySyncEventsArb: fc.Arbitrary<ActivityEvent[]> = fc.array(activityEventArb, {
  minLength: 1,
  maxLength: 20,
});

/** Generate an array of DashboardTasks. */
const tasksArb: fc.Arbitrary<DashboardTask[]> = fc.array(dashboardTaskArb, {
  minLength: 0,
  maxLength: 20,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Property 8 (extended): Activity feed ordering and limit', () => {
  // Feature: app-ui-overhaul, Property 8: Activity feed ordering and limit

  it('buildActivityFeed returns at most 7 items', () => {
    fc.assert(
      fc.property(syncEventsArb, tasksArb, (syncEvents, tasks) => {
        const result = buildActivityFeed(syncEvents, tasks);
        expect(result.length).toBeLessThanOrEqual(7);
      }),
      { numRuns: 100 },
    );
  });

  it('result is sorted in non-increasing order by createdAt', () => {
    fc.assert(
      fc.property(syncEventsArb, tasksArb, (syncEvents, tasks) => {
        const result = buildActivityFeed(syncEvents, tasks);

        for (let i = 1; i < result.length; i++) {
          // Non-increasing: each item's createdAt <= previous item's createdAt
          expect(result[i].createdAt.localeCompare(result[i - 1].createdAt)).toBeLessThanOrEqual(0);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('when syncEvents is non-empty, no task-derived items appear in result', () => {
    fc.assert(
      fc.property(nonEmptySyncEventsArb, tasksArb, (syncEvents, tasks) => {
        const result = buildActivityFeed(syncEvents, tasks);

        // Task-derived items have IDs starting with 'task-'
        for (const item of result) {
          expect(item.id.startsWith('task-')).toBe(false);
        }

        // Additionally, all result items should be from the syncEvents source
        const syncEventIds = new Set(syncEvents.map((e) => e.id));
        for (const item of result) {
          expect(syncEventIds.has(item.id)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('when syncEvents is empty, result items are derived from tasks', () => {
    fc.assert(
      fc.property(tasksArb, (tasks) => {
        const result = buildActivityFeed([], tasks);

        // All result items should be task-derived (id starts with 'task-')
        for (const item of result) {
          expect(item.id.startsWith('task-')).toBe(true);
        }

        // Result length should be at most min(tasks.length, 7)
        expect(result.length).toBeLessThanOrEqual(Math.min(tasks.length, 7));
      }),
      { numRuns: 100 },
    );
  });

  it('result length is min(source.length, 7)', () => {
    fc.assert(
      fc.property(syncEventsArb, tasksArb, (syncEvents, tasks) => {
        const result = buildActivityFeed(syncEvents, tasks);

        const sourceLength = syncEvents.length > 0 ? syncEvents.length : tasks.length;
        expect(result.length).toBe(Math.min(sourceLength, 7));
      }),
      { numRuns: 100 },
    );
  });
});
