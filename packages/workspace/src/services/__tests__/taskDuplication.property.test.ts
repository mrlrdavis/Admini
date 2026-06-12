/**
 * Property-based tests for Task Duplication (Algorithm 3)
 *
 * Feature: app-ui-overhaul, Task Duplication invariants
 *
 * For any source task, duplicateTask produces a clone where:
 * - clone.id !== source.id
 * - all subtask IDs differ from source
 * - clone.status === 'open'
 * - all subtask.completed === false
 * - preserved fields match source
 *
 * Tests the `duplicateTask` function from
 * `packages/workspace/src/services/taskDuplication.ts`
 *
 * **Validates: Algorithm 3 invariants**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { duplicateTask } from '../taskDuplication';
import type { TaskWithSubtasks, TaskService, Subtask } from '../taskDuplication';

// ---------------------------------------------------------------------------
// Mock TaskService
// ---------------------------------------------------------------------------

/** A mock TaskService that simply returns the task it receives (identity persist). */
const mockTaskService: TaskService = {
  create: async (task: TaskWithSubtasks): Promise<TaskWithSubtasks> => task,
};

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generate a valid ISO datetime string. */
const isoDateTimeArb: fc.Arbitrary<string> = fc
  .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
  .map((d) => d.toISOString());

/** Generate a Subtask. */
const subtaskArb: fc.Arbitrary<Subtask> = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 50 }),
  completed: fc.boolean(),
  dueAt: fc.option(isoDateTimeArb, { nil: undefined }),
});

/** Generate a TaskWithSubtasks (source task). */
const taskWithSubtasksArb: fc.Arbitrary<TaskWithSubtasks> = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: undefined }),
  priority: fc.constantFrom('low', 'normal', 'high', 'urgent'),
  status: fc.constantFrom('open', 'in_progress', 'completed', 'archived'),
  category: fc.option(
    fc.record({
      id: fc.string({ minLength: 1, maxLength: 20 }),
      label: fc.string({ minLength: 1, maxLength: 30 }),
      color: fc.constantFrom('orange', 'yellow', 'green', 'red'),
    }),
    { nil: undefined },
  ),
  dueAt: fc.option(isoDateTimeArb, { nil: undefined }),
  assignee: fc.option(fc.uuid(), { nil: undefined }),
  completedAt: fc.option(isoDateTimeArb, { nil: undefined }),
  createdAt: isoDateTimeArb,
  updatedAt: isoDateTimeArb,
  staleDays: fc.option(fc.nat({ max: 365 }), { nil: undefined }),
  blockReason: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
  subtasks: fc.array(subtaskArb, { minLength: 0, maxLength: 10 }),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Task Duplication invariants', () => {
  // Feature: app-ui-overhaul, Task Duplication invariants

  it('clone.id !== source.id', async () => {
    await fc.assert(
      fc.asyncProperty(taskWithSubtasksArb, async (sourceTask) => {
        const clone = await duplicateTask(sourceTask, mockTaskService);
        expect(clone.id).not.toBe(sourceTask.id);
      }),
      { numRuns: 100 },
    );
  });

  it('all subtask IDs differ from source subtask IDs', async () => {
    await fc.assert(
      fc.asyncProperty(taskWithSubtasksArb, async (sourceTask) => {
        const clone = await duplicateTask(sourceTask, mockTaskService);

        const sourceSubtaskIds = new Set(sourceTask.subtasks.map((s) => s.id));
        for (const subtask of clone.subtasks) {
          expect(sourceSubtaskIds.has(subtask.id)).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('clone.status === "open"', async () => {
    await fc.assert(
      fc.asyncProperty(taskWithSubtasksArb, async (sourceTask) => {
        const clone = await duplicateTask(sourceTask, mockTaskService);
        expect(clone.status).toBe('open');
      }),
      { numRuns: 100 },
    );
  });

  it('all subtask.completed === false', async () => {
    await fc.assert(
      fc.asyncProperty(taskWithSubtasksArb, async (sourceTask) => {
        const clone = await duplicateTask(sourceTask, mockTaskService);

        for (const subtask of clone.subtasks) {
          expect(subtask.completed).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('preserved fields match source (title, description, priority, category, dueAt, assignee)', async () => {
    await fc.assert(
      fc.asyncProperty(taskWithSubtasksArb, async (sourceTask) => {
        const clone = await duplicateTask(sourceTask, mockTaskService);

        expect(clone.title).toBe(sourceTask.title);
        expect(clone.description).toBe(sourceTask.description);
        expect(clone.priority).toBe(sourceTask.priority);
        expect(clone.dueAt).toBe(sourceTask.dueAt);
        expect(clone.assignee).toBe(sourceTask.assignee);

        // Category deep equals
        if (sourceTask.category) {
          expect(clone.category).toEqual(sourceTask.category);
        } else {
          expect(clone.category).toBeUndefined();
        }
      }),
      { numRuns: 100 },
    );
  });

  it('reset fields are correctly set (completedAt, staleDays, blockReason)', async () => {
    await fc.assert(
      fc.asyncProperty(taskWithSubtasksArb, async (sourceTask) => {
        const clone = await duplicateTask(sourceTask, mockTaskService);

        expect(clone.completedAt).toBeUndefined();
        expect(clone.staleDays).toBe(0);
        expect(clone.blockReason).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });

  it('subtask count is preserved', async () => {
    await fc.assert(
      fc.asyncProperty(taskWithSubtasksArb, async (sourceTask) => {
        const clone = await duplicateTask(sourceTask, mockTaskService);
        expect(clone.subtasks.length).toBe(sourceTask.subtasks.length);
      }),
      { numRuns: 100 },
    );
  });

  it('all clone subtask IDs are unique among themselves', async () => {
    await fc.assert(
      fc.asyncProperty(taskWithSubtasksArb, async (sourceTask) => {
        const clone = await duplicateTask(sourceTask, mockTaskService);

        const cloneSubtaskIds = clone.subtasks.map((s) => s.id);
        const uniqueIds = new Set(cloneSubtaskIds);
        expect(cloneSubtaskIds.length).toBe(uniqueIds.size);
      }),
      { numRuns: 100 },
    );
  });
});
