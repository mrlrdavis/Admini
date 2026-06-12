import type { ActivityEvent, DashboardTask } from '../types';

/**
 * Derives an ActivityEvent from a DashboardTask.
 * Used as a fallback when no sync events are available.
 */
export function deriveActivityFromTask(task: DashboardTask): ActivityEvent {
  return {
    id: `task-${task.id}`,
    organizationId: task.organizationId,
    actorId: task.createdBy,
    entityType: 'task',
    entityId: task.id,
    action: 'created',
    createdAt: task.createdAt,
  };
}

/**
 * Builds an activity feed following Algorithm 2: Activity Feed Ordering and Capping.
 *
 * Steps:
 * 1. If syncEvents.length > 0: source = syncEvents
 *    Else: source = tasks.map(t => deriveActivityFromTask(t))
 * 2. Sort source by createdAt descending (stable sort, ties broken by ID ascending)
 * 3. Slice to first 7 items
 * 4. Return sliced array
 *
 * Invariants:
 * - result.length <= 7
 * - result is sorted in strictly non-increasing order by createdAt
 * - If syncEvents is non-empty, no task-derived items appear in result
 */
export function buildActivityFeed(
  syncEvents: ActivityEvent[],
  tasks: DashboardTask[],
): ActivityEvent[] {
  const source: ActivityEvent[] =
    syncEvents.length > 0
      ? [...syncEvents]
      : tasks.map((t) => deriveActivityFromTask(t));

  source.sort((a, b) => {
    // Sort by createdAt descending
    const dateComparison = b.createdAt.localeCompare(a.createdAt);
    if (dateComparison !== 0) return dateComparison;
    // Ties broken by ID ascending
    return a.id.localeCompare(b.id);
  });

  return source.slice(0, 7);
}
