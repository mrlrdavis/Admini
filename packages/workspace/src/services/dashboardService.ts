import { getClient } from './getClient';
import type { DashboardTask, ActivityEvent, DashboardKPIs } from '../types';

// ---------------------------------------------------------------------------
// Internal DB row types
// ---------------------------------------------------------------------------

/** Raw row shape returned by the tasks table. */
type DbTask = {
  id: string;
  organization_id: string;
  created_by: string;
  title: string;
  description: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'completed' | 'archived';
  due_at: string | null;
  created_at: string;
  updated_at: string;
  assigned_to: string | null;
  category?: string | null;
};

/** Raw row shape returned by the sync_events table (activity feed source). */
type DbSyncEvent = {
  id: string;
  organization_id: string;
  actor_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Typed error thrown by dashboard service functions. */
export class DashboardServiceError extends Error {
  public readonly code: string;

  constructor(message: string, code = 'DASHBOARD_SERVICE_ERROR') {
    super(message);
    this.name = 'DashboardServiceError';
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Priority weight for sort ordering (higher = more urgent). */
const PRIORITY_WEIGHT: Record<DashboardTask['priority'], number> = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
};

export function mapTask(row: DbTask): DashboardTask {
  return {
    id: row.id,
    organizationId: row.organization_id,
    createdBy: row.created_by,
    title: row.title,
    description: row.description ?? undefined,
    priority: row.priority,
    status: row.status,
    dueAt: row.due_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    assignedTo: row.assigned_to ?? undefined,
    category: row.category ?? undefined,
  };
}

export function mapSyncEvent(row: DbSyncEvent): ActivityEvent {
  return {
    id: row.id,
    organizationId: row.organization_id,
    actorId: row.actor_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    createdAt: row.created_at,
  };
}

/** Returns the start of the current ISO week (Monday 00:00 UTC). */
function startOfCurrentWeek(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sun, 1 = Mon, ...
  const diff = day === 0 ? 6 : day - 1; // days since Monday
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString();
}

// ---------------------------------------------------------------------------
// Sort Comparator
// ---------------------------------------------------------------------------

/**
 * Sort comparator for DashboardTask[].
 * Orders by priority descending (urgent > high > normal > low),
 * then by dueAt ascending (earliest due first; tasks without dueAt sort last).
 *
 * Requirements: 3.5, 10.5
 */
export function sortByUrgency(a: DashboardTask, b: DashboardTask): number {
  // Higher priority first
  const priorityDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
  if (priorityDiff !== 0) return priorityDiff;

  // Earlier due date first; undefined dueAt sorts to the end
  if (a.dueAt && b.dueAt) {
    return a.dueAt < b.dueAt ? -1 : a.dueAt > b.dueAt ? 1 : 0;
  }
  if (a.dueAt && !b.dueAt) return -1;
  if (!a.dueAt && b.dueAt) return 1;

  return 0;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetches all non-archived tasks for the current user's organization.
 * Tasks are returned in reverse chronological order (newest first).
 *
 * Requirements: 3.2, 3.3, 3.5
 */
export async function getTasks(): Promise<DashboardTask[]> {
  const client = getClient();

  const baseCols = 'id, organization_id, created_by, title, description, priority, status, due_at, created_at, updated_at';
  try {
    // Try with category; if the column is missing (migration not applied), retry without it.
    let { data, error } = await client
      .from('tasks')
      .select(baseCols + ', category')
      
      .order('created_at', { ascending: false })
      .returns<DbTask[]>();

    if (error && /category/i.test(error.message || '')) {
      ({ data, error } = await client
        .from('tasks')
        .select(baseCols)
        .neq('status', 'archived')
        .order('created_at', { ascending: false })
        .returns<DbTask[]>());
    }

    if (error) {
      throw new DashboardServiceError(error.message, error.code);
    }

    return (data ?? []).map(mapTask);
  } catch (err) {
    if (err instanceof DashboardServiceError) throw err;
    throw new DashboardServiceError(
      err instanceof Error ? err.message : 'Failed to fetch tasks.',
      'FETCH_TASKS_ERROR',
    );
  }
}

/**
 * Fetches recent activity events (sync_events) for the current user's organization.
 * Events are returned in reverse chronological order (most recent first), limited to 50.
 *
 * Requirements: 3.4
 */
export async function getActivityEvents(): Promise<ActivityEvent[]> {
  const client = getClient();

  try {
    const { data, error } = await client
      .from('sync_events')
      .select('id, organization_id, actor_id, entity_type, entity_id, action, created_at')
      .order('created_at', { ascending: false })
      .limit(50)
      .returns<DbSyncEvent[]>();

    if (error) {
      throw new DashboardServiceError(error.message, error.code);
    }

    return (data ?? []).map(mapSyncEvent);
  } catch (err) {
    if (err instanceof DashboardServiceError) throw err;
    throw new DashboardServiceError(
      err instanceof Error ? err.message : 'Failed to fetch activity events.',
      'FETCH_EVENTS_ERROR',
    );
  }
}

/**
 * Computes dashboard KPI metrics from task data:
 * - openTasks: count of tasks with status 'open' or 'in_progress'
 * - completedThisWeek: tasks completed since start of current week
 * - overdueTasks: open/in_progress tasks whose due_at is in the past
 * - nextPulseAt: placeholder for pulse countdown (null until pulse scheduling is implemented)
 *
 * Requirements: 3.2, 3.5, 3.6
 */
export async function getDashboardKPIs(): Promise<DashboardKPIs> {
  const client = getClient();

  try {
    const now = new Date().toISOString();
    const weekStart = startOfCurrentWeek();

    // Fetch open/in_progress tasks count
    const { count: openCount, error: openError } = await client
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .in('status', ['open', 'in_progress']);

    if (openError) {
      throw new DashboardServiceError(openError.message, openError.code);
    }

    // Fetch completed this week
    const { count: completedCount, error: completedError } = await client
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('updated_at', weekStart);

    if (completedError) {
      throw new DashboardServiceError(completedError.message, completedError.code);
    }

    // Fetch overdue tasks (open/in_progress with due_at in the past)
    const { count: overdueCount, error: overdueError } = await client
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .in('status', ['open', 'in_progress'])
      .lt('due_at', now);

    if (overdueError) {
      throw new DashboardServiceError(overdueError.message, overdueError.code);
    }

    return {
      openTasks: openCount ?? 0,
      completedThisWeek: completedCount ?? 0,
      overdueTasks: overdueCount ?? 0,
      nextPulseAt: null, // Pulse scheduling not yet implemented
    };
  } catch (err) {
    if (err instanceof DashboardServiceError) throw err;
    throw new DashboardServiceError(
      err instanceof Error ? err.message : 'Failed to compute dashboard KPIs.',
      'FETCH_KPIS_ERROR',
    );
  }
}