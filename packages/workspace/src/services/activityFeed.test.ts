import { describe, it, expect } from 'vitest';
import { buildActivityFeed, deriveActivityFromTask } from './activityFeed';
import type { ActivityEvent, DashboardTask } from '../types';

function makeEvent(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id: 'evt-1',
    organizationId: 'org-1',
    actorId: 'user-1',
    entityType: 'task',
    entityId: 'task-1',
    action: 'created',
    createdAt: '2024-01-15T10:00:00.000Z',
    ...overrides,
  };
}

function makeTask(overrides: Partial<DashboardTask> = {}): DashboardTask {
  return {
    id: 'task-1',
    organizationId: 'org-1',
    createdBy: 'user-1',
    title: 'Test Task',
    priority: 'normal',
    status: 'open',
    createdAt: '2024-01-15T10:00:00.000Z',
    updatedAt: '2024-01-15T10:00:00.000Z',
    ...overrides,
  };
}

describe('deriveActivityFromTask', () => {
  it('derives an ActivityEvent with task- prefixed id', () => {
    const task = makeTask({ id: 'abc-123' });
    const event = deriveActivityFromTask(task);

    expect(event.id).toBe('task-abc-123');
    expect(event.organizationId).toBe(task.organizationId);
    expect(event.actorId).toBe(task.createdBy);
    expect(event.entityType).toBe('task');
    expect(event.entityId).toBe(task.id);
    expect(event.action).toBe('created');
    expect(event.createdAt).toBe(task.createdAt);
  });
});

describe('buildActivityFeed', () => {
  it('uses syncEvents when non-empty', () => {
    const syncEvents = [makeEvent({ id: 'sync-1' })];
    const tasks = [makeTask({ id: 'task-1' })];
    const result = buildActivityFeed(syncEvents, tasks);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('sync-1');
  });

  it('falls back to task-derived events when syncEvents is empty', () => {
    const tasks = [makeTask({ id: 'task-1' }), makeTask({ id: 'task-2' })];
    const result = buildActivityFeed([], tasks);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('task-task-1');
    expect(result[1].id).toBe('task-task-2');
  });

  it('sorts by createdAt descending', () => {
    const syncEvents = [
      makeEvent({ id: 'evt-1', createdAt: '2024-01-10T10:00:00.000Z' }),
      makeEvent({ id: 'evt-2', createdAt: '2024-01-15T10:00:00.000Z' }),
      makeEvent({ id: 'evt-3', createdAt: '2024-01-12T10:00:00.000Z' }),
    ];
    const result = buildActivityFeed(syncEvents, []);
    expect(result[0].id).toBe('evt-2');
    expect(result[1].id).toBe('evt-3');
    expect(result[2].id).toBe('evt-1');
  });

  it('breaks ties by ID ascending', () => {
    const syncEvents = [
      makeEvent({ id: 'c-event', createdAt: '2024-01-15T10:00:00.000Z' }),
      makeEvent({ id: 'a-event', createdAt: '2024-01-15T10:00:00.000Z' }),
      makeEvent({ id: 'b-event', createdAt: '2024-01-15T10:00:00.000Z' }),
    ];
    const result = buildActivityFeed(syncEvents, []);
    expect(result[0].id).toBe('a-event');
    expect(result[1].id).toBe('b-event');
    expect(result[2].id).toBe('c-event');
  });

  it('caps result at 7 items', () => {
    const syncEvents: ActivityEvent[] = [];
    for (let i = 0; i < 15; i++) {
      syncEvents.push(makeEvent({
        id: 'evt-' + String(i).padStart(2, '0'),
        createdAt: '2024-01-' + String(i + 1).padStart(2, '0') + 'T10:00:00.000Z',
      }));
    }
    const result = buildActivityFeed(syncEvents, []);
    expect(result).toHaveLength(7);
  });

  it('returns fewer than 7 items if source has fewer', () => {
    const syncEvents = [
      makeEvent({ id: 'evt-1', createdAt: '2024-01-15T10:00:00.000Z' }),
      makeEvent({ id: 'evt-2', createdAt: '2024-01-14T10:00:00.000Z' }),
    ];
    const result = buildActivityFeed(syncEvents, []);
    expect(result).toHaveLength(2);
  });

  it('returns empty array when both inputs are empty', () => {
    const result = buildActivityFeed([], []);
    expect(result).toHaveLength(0);
  });

  it('does not mutate the original syncEvents array', () => {
    const syncEvents = [
      makeEvent({ id: 'evt-1', createdAt: '2024-01-10T10:00:00.000Z' }),
      makeEvent({ id: 'evt-2', createdAt: '2024-01-15T10:00:00.000Z' }),
    ];
    const originalOrder = syncEvents.map((e) => e.id);
    buildActivityFeed(syncEvents, []);
    expect(syncEvents.map((e) => e.id)).toEqual(originalOrder);
  });
});