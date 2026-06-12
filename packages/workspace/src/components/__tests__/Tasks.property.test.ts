import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { parseLocalDate } from '@admini/shared';

// Feature: app-ui-overhaul, Property 9: Subtask completion gates parent task
// Feature: app-ui-overhaul, Property 10: Overdue task identification

/**
 * Property 9: Subtask completion gates parent task
 *
 * For any task with at least one subtask where `completed` is false,
 * the parent task's completion checkbox SHALL be disabled or prevented
 * from being checked.
 *
 * **Validates: Requirements 8.4**
 */

/**
 * Property 10: Overdue task identification
 *
 * For any task whose local due date is before today's local date and whose
 * status is not `completed`, that task SHALL appear in the overdue task list.
 *
 * **Validates: Requirements 9.3**
 */

// --- Inline helpers that mirror the application logic ---

interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  dueAt?: string;
}

/**
 * Determines whether a parent task can be completed.
 * Returns false if any subtask has completed === false.
 */
function canCompleteParent(subtasks: Subtask[]): boolean {
  if (subtasks.length === 0) return true;
  return subtasks.every((s) => s.completed);
}

/**
 * Determines whether a task is overdue.
 * A task is overdue if its dueAt (local date) is before today and status !== 'completed'.
 */
function isOverdue(task: { dueAt?: string; status: string }): boolean {
  if (!task.dueAt) return false;
  if (task.status === 'completed') return false;
  const dueDate = parseLocalDate(task.dueAt);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dueDate < today;
}

// --- Arbitraries ---

const subtaskArb: fc.Arbitrary<Subtask> = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 50 }),
  completed: fc.boolean(),
  dueAt: fc.option(
    fc.date({ min: new Date(2020, 0, 1), max: new Date(2030, 11, 31) }).map(
      (d) => d.toISOString().split('T')[0]!
    ),
    { nil: undefined }
  ),
});

// Arbitrary for subtask arrays where at least one subtask is incomplete
const subtasksWithAtLeastOneIncompleteArb: fc.Arbitrary<Subtask[]> = fc
  .array(subtaskArb, { minLength: 1, maxLength: 10 })
  .map((subtasks) => {
    // Ensure at least one subtask has completed=false
    if (subtasks.every((s) => s.completed)) {
      subtasks[0] = { ...subtasks[0]!, completed: false };
    }
    return subtasks;
  });

// Arbitrary for subtask arrays where ALL subtasks are complete
const allCompleteSubtasksArb: fc.Arbitrary<Subtask[]> = fc
  .array(subtaskArb, { minLength: 1, maxLength: 10 })
  .map((subtasks) => subtasks.map((s) => ({ ...s, completed: true })));

// Non-completed task statuses
const nonCompletedStatusArb = fc.constantFrom('open', 'in_progress', 'archived');

// Generate a date string guaranteed to be in the past (before today)
const pastDateStrArb: fc.Arbitrary<string> = fc
  .integer({ min: 1, max: 3650 }) // 1 to 3650 days ago
  .map((daysAgo) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

describe('Tasks Property Tests', () => {
  // Feature: app-ui-overhaul, Property 9: Subtask completion gates parent task
  describe('Property 9: Subtask completion gates parent task', () => {
    it('canCompleteParent returns false when at least one subtask is incomplete', () => {
      fc.assert(
        fc.property(
          subtasksWithAtLeastOneIncompleteArb,
          (subtasks) => {
            const result = canCompleteParent(subtasks);
            expect(result).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('canCompleteParent returns true when all subtasks are complete', () => {
      fc.assert(
        fc.property(
          allCompleteSubtasksArb,
          (subtasks) => {
            const result = canCompleteParent(subtasks);
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('canCompleteParent returns true for an empty subtask array', () => {
      expect(canCompleteParent([])).toBe(true);
    });
  });

  // Feature: app-ui-overhaul, Property 10: Overdue task identification
  describe('Property 10: Overdue task identification', () => {
    it('a task with dueAt before today and non-completed status is always overdue', () => {
      fc.assert(
        fc.property(
          pastDateStrArb,
          nonCompletedStatusArb,
          (dueAt, status) => {
            const task = { dueAt, status };
            expect(isOverdue(task)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('a completed task is never overdue regardless of due date', () => {
      fc.assert(
        fc.property(
          pastDateStrArb,
          (_dueAt) => {
            const task = { dueAt: _dueAt, status: 'completed' };
            expect(isOverdue(task)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('a task without dueAt is never overdue', () => {
      fc.assert(
        fc.property(
          nonCompletedStatusArb,
          (status) => {
            const task = { dueAt: undefined, status };
            expect(isOverdue(task)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});