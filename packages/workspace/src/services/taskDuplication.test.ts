/**
 * Unit tests for Task Duplication Service (Algorithm 3)
 *
 * Tests the duplicateTask function to ensure correct field copying,
 * field resetting, and persistence behavior.
 */

import { describe, it, expect, vi } from 'vitest';
import { duplicateTask, type TaskWithSubtasks, type TaskService } from './taskDuplication';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function createSourceTask(overrides: Partial<TaskWithSubtasks> = {}): TaskWithSubtasks {
  return {
    id: 'source-id-123',
    title: 'Complete quarterly report',
    description: 'Compile all department data into the quarterly report',
    priority: 'high',
    status: 'completed',
    category: { id: 'compliance', label: 'Compliance', color: 'orange' },
    dueAt: '2024-03-15T00:00:00.000Z',
    assignee: 'user-456',
    completedAt: '2024-03-14T10:30:00.000Z',
    createdAt: '2024-02-01T08:00:00.000Z',
    updatedAt: '2024-03-14T10:30:00.000Z',
    staleDays: 5,
    blockReason: 'Waiting on finance team',
    subtasks: [
      { id: 'sub-1', title: 'Gather data', completed: true, dueAt: '2024-03-10' },
      { id: 'sub-2', title: 'Write summary', completed: true },
      { id: 'sub-3', title: 'Get approval', completed: false, dueAt: '2024-03-14' },
    ],
    ...overrides,
  };
}

function createMockTaskService(): TaskService {
  return {
    create: vi.fn(async (task: TaskWithSubtasks) => task),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('duplicateTask', () => {
  describe('field copying (preserved as-is)', () => {
    it('preserves title from source task', async () => {
      const source = createSourceTask();
      const service = createMockTaskService();

      const result = await duplicateTask(source, service);

      expect(result.title).toBe(source.title);
    });

    it('preserves description from source task', async () => {
      const source = createSourceTask();
      const service = createMockTaskService();

      const result = await duplicateTask(source, service);

      expect(result.description).toBe(source.description);
    });

    it('preserves priority from source task', async () => {
      const source = createSourceTask();
      const service = createMockTaskService();

      const result = await duplicateTask(source, service);

      expect(result.priority).toBe(source.priority);
    });

    it('preserves category from source task', async () => {
      const source = createSourceTask();
      const service = createMockTaskService();

      const result = await duplicateTask(source, service);

      expect(result.category).toEqual(source.category);
    });

    it('preserves dueAt from source task', async () => {
      const source = createSourceTask();
      const service = createMockTaskService();

      const result = await duplicateTask(source, service);

      expect(result.dueAt).toBe(source.dueAt);
    });

    it('preserves assignee from source task', async () => {
      const source = createSourceTask();
      const service = createMockTaskService();

      const result = await duplicateTask(source, service);

      expect(result.assignee).toBe(source.assignee);
    });

    it('preserves subtask titles from source task', async () => {
      const source = createSourceTask();
      const service = createMockTaskService();

      const result = await duplicateTask(source, service);

      const sourceTitles = source.subtasks.map((s) => s.title);
      const resultTitles = result.subtasks.map((s) => s.title);
      expect(resultTitles).toEqual(sourceTitles);
    });

    it('preserves subtask dueAt from source task', async () => {
      const source = createSourceTask();
      const service = createMockTaskService();

      const result = await duplicateTask(source, service);

      const sourceDueAts = source.subtasks.map((s) => s.dueAt);
      const resultDueAts = result.subtasks.map((s) => s.dueAt);
      expect(resultDueAts).toEqual(sourceDueAts);
    });
  });

  describe('field resetting', () => {
    it('generates a new id different from source', async () => {
      const source = createSourceTask();
      const service = createMockTaskService();

      const result = await duplicateTask(source, service);

      expect(result.id).not.toBe(source.id);
      expect(result.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('resets status to open', async () => {
      const source = createSourceTask({ status: 'completed' });
      const service = createMockTaskService();

      const result = await duplicateTask(source, service);

      expect(result.status).toBe('open');
    });

    it('resets completedAt to undefined', async () => {
      const source = createSourceTask({ completedAt: '2024-03-14T10:30:00.000Z' });
      const service = createMockTaskService();

      const result = await duplicateTask(source, service);

      expect(result.completedAt).toBeUndefined();
    });

    it('resets createdAt to current timestamp', async () => {
      const before = new Date().toISOString();
      const source = createSourceTask();
      const service = createMockTaskService();

      const result = await duplicateTask(source, service);
      const after = new Date().toISOString();

      expect(result.createdAt).not.toBe(source.createdAt);
      expect(result.createdAt >= before).toBe(true);
      expect(result.createdAt <= after).toBe(true);
    });

    it('resets updatedAt to current timestamp', async () => {
      const before = new Date().toISOString();
      const source = createSourceTask();
      const service = createMockTaskService();

      const result = await duplicateTask(source, service);
      const after = new Date().toISOString();

      expect(result.updatedAt).not.toBe(source.updatedAt);
      expect(result.updatedAt >= before).toBe(true);
      expect(result.updatedAt <= after).toBe(true);
    });

    it('sets createdAt and updatedAt to the same value', async () => {
      const source = createSourceTask();
      const service = createMockTaskService();

      const result = await duplicateTask(source, service);

      expect(result.createdAt).toBe(result.updatedAt);
    });

    it('resets staleDays to 0', async () => {
      const source = createSourceTask({ staleDays: 42 });
      const service = createMockTaskService();

      const result = await duplicateTask(source, service);

      expect(result.staleDays).toBe(0);
    });

    it('resets blockReason to undefined', async () => {
      const source = createSourceTask({ blockReason: 'Waiting on approval' });
      const service = createMockTaskService();

      const result = await duplicateTask(source, service);

      expect(result.blockReason).toBeUndefined();
    });

    it('generates new IDs for all subtasks', async () => {
      const source = createSourceTask();
      const service = createMockTaskService();

      const result = await duplicateTask(source, service);

      const sourceIds = new Set(source.subtasks.map((s) => s.id));
      for (const subtask of result.subtasks) {
        expect(sourceIds.has(subtask.id)).toBe(false);
        expect(subtask.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        );
      }
    });

    it('generates unique IDs for each subtask', async () => {
      const source = createSourceTask();
      const service = createMockTaskService();

      const result = await duplicateTask(source, service);

      const ids = result.subtasks.map((s) => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('resets all subtask completed flags to false', async () => {
      const source = createSourceTask({
        subtasks: [
          { id: 'sub-1', title: 'Done task', completed: true },
          { id: 'sub-2', title: 'Also done', completed: true },
          { id: 'sub-3', title: 'Not done', completed: false },
        ],
      });
      const service = createMockTaskService();

      const result = await duplicateTask(source, service);

      for (const subtask of result.subtasks) {
        expect(subtask.completed).toBe(false);
      }
    });
  });

  describe('persistence', () => {
    it('calls taskService.create with the cloned task', async () => {
      const source = createSourceTask();
      const service = createMockTaskService();

      await duplicateTask(source, service);

      expect(service.create).toHaveBeenCalledTimes(1);
      const createdTask = (service.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(createdTask.id).not.toBe(source.id);
      expect(createdTask.status).toBe('open');
    });

    it('returns the result from taskService.create', async () => {
      const source = createSourceTask();
      const persistedTask: TaskWithSubtasks = {
        ...source,
        id: 'persisted-id',
        status: 'open',
        subtasks: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const service: TaskService = {
        create: vi.fn(async () => persistedTask),
      };

      const result = await duplicateTask(source, service);

      expect(result).toBe(persistedTask);
    });
  });

  describe('immutability', () => {
    it('does not mutate the source task', async () => {
      const source = createSourceTask();
      const originalId = source.id;
      const originalStatus = source.status;
      const originalSubtaskIds = source.subtasks.map((s) => s.id);
      const service = createMockTaskService();

      await duplicateTask(source, service);

      expect(source.id).toBe(originalId);
      expect(source.status).toBe(originalStatus);
      expect(source.subtasks.map((s) => s.id)).toEqual(originalSubtaskIds);
    });
  });

  describe('edge cases', () => {
    it('handles task with no subtasks', async () => {
      const source = createSourceTask({ subtasks: [] });
      const service = createMockTaskService();

      const result = await duplicateTask(source, service);

      expect(result.subtasks).toEqual([]);
      expect(result.id).not.toBe(source.id);
      expect(result.status).toBe('open');
    });

    it('handles task with undefined optional fields', async () => {
      const source = createSourceTask({
        description: undefined,
        category: undefined,
        dueAt: undefined,
        assignee: undefined,
        completedAt: undefined,
        staleDays: undefined,
        blockReason: undefined,
      });
      const service = createMockTaskService();

      const result = await duplicateTask(source, service);

      expect(result.description).toBeUndefined();
      expect(result.category).toBeUndefined();
      expect(result.dueAt).toBeUndefined();
      expect(result.assignee).toBeUndefined();
      expect(result.completedAt).toBeUndefined();
      expect(result.staleDays).toBe(0);
      expect(result.blockReason).toBeUndefined();
    });

    it('handles task with many subtasks', async () => {
      const manySubtasks = Array.from({ length: 20 }, (_, i) => ({
        id: `sub-${i}`,
        title: `Subtask ${i}`,
        completed: i % 2 === 0,
      }));
      const source = createSourceTask({ subtasks: manySubtasks });
      const service = createMockTaskService();

      const result = await duplicateTask(source, service);

      expect(result.subtasks.length).toBe(20);
      for (const subtask of result.subtasks) {
        expect(subtask.completed).toBe(false);
      }
      // All IDs should be unique
      const allIds = new Set(result.subtasks.map((s) => s.id));
      expect(allIds.size).toBe(20);
    });
  });
});
