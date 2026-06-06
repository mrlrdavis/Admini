// ---------------------------------------------------------------------------
// DashboardTab - Native React implementation of the Dashboard view
// ---------------------------------------------------------------------------
// Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7

import { useCallback, useEffect, useMemo, useState } from 'react';
import { KPICard } from '@admini/ui';
import {
  getTasks,
  getActivityEvents,
  getDashboardKPIs,
} from '../services/dashboardService';
import type { DashboardTask, ActivityEvent, DashboardKPIs } from '../services/dashboardService';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DashboardTabProps {
  userName: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a time-appropriate greeting based on the current hour.
 * 5-11: Good morning
 * 12-17: Good afternoon
 * 18-4: Good evening
 */
export function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour <= 11) return 'Good morning';
  if (hour >= 12 && hour <= 17) return 'Good afternoon';
  return 'Good evening';
}

/** Priority urgency weight - higher number = more urgent. */
const PRIORITY_WEIGHT: Record<DashboardTask['priority'], number> = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
};

/**
 * Sorts open tasks by urgency descending (urgent > high > normal > low),
 * with ties broken by dueAt ascending (earliest due first, no-due-date last).
 */
export function sortByUrgency(a: DashboardTask, b: DashboardTask): number {
  const weightDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
  if (weightDiff !== 0) return weightDiff;

  // Ties broken by dueAt ascending - tasks without a due date sort last.
  const aDue = a.dueAt ?? '';
  const bDue = b.dueAt ?? '';
  if (!aDue && !bDue) return 0;
  if (!aDue) return 1;
  if (!bDue) return -1;
  return aDue < bDue ? -1 : aDue > bDue ? 1 : 0;
}

/**
 * Computes a human-readable countdown string from now to a target ISO date.
 */
function formatCountdown(targetIso: string): string {
  const now = Date.now();
  const target = new Date(targetIso).getTime();
  const diffMs = target - now;

  if (diffMs <= 0) return 'Now';

  const minutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DashboardTab({ userName }: DashboardTabProps) {
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tasksData, eventsData, kpisData] = await Promise.all([
        getTasks(),
        getActivityEvents(),
        getDashboardKPIs(),
      ]);
      setTasks(tasksData);
      setEvents(eventsData);
      setKpis(kpisData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // -------------------------------------------------------------------------
  // Computed data
  // -------------------------------------------------------------------------

  /** Open tasks sorted by urgency for the priority queue. */
  const priorityQueue = useMemo(
    () => tasks.filter((t) => t.status === 'open').sort(sortByUrgency),
    [tasks],
  );

  /** Activity events sorted in reverse chronological order. */
  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => (b.createdAt > a.createdAt ? 1 : b.createdAt < a.createdAt ? -1 : 0)),
    [events],
  );

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="dashboard-tab dashboard-tab--loading" aria-busy="true">
        <p>Loading dashboard...</p>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

  if (error) {
    return (
      <div className="dashboard-tab dashboard-tab--error" role="alert">
        <div className="dashboard-tab__error-banner">
          <p>{error}</p>
          <button
            type="button"
            className="dashboard-tab__retry-btn"
            onClick={fetchData}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="dashboard-tab">
      {/* Greeting */}
      <section className="dashboard-tab__greeting">
        <h1>{getTimeGreeting()}, {userName}</h1>
      </section>

      {/* KPI Cards */}
      <section className="dashboard-tab__kpis">
        <KPICard label="Tasks" value={kpis?.openTasks ?? 0} />
        <KPICard label="Completed" value={kpis?.completedThisWeek ?? 0} />
        <KPICard label="Overdue" value={kpis?.overdueTasks ?? 0} />
      </section>

      {/* Priority Queue */}
      <section className="dashboard-tab__priority-queue">
        <h2>Priority Queue</h2>
        {priorityQueue.length === 0 ? (
          <p className="dashboard-tab__empty">No open tasks</p>
        ) : (
          <ul className="dashboard-tab__task-list">
            {priorityQueue.map((task) => (
              <li key={task.id} className="dashboard-tab__task-item" data-priority={task.priority}>
                <span className="dashboard-tab__task-title">{task.title}</span>
                <span className="dashboard-tab__task-priority">{task.priority}</span>
                {task.dueAt && (
                  <span className="dashboard-tab__task-due">
                    Due: {new Date(task.dueAt).toLocaleDateString()}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Activity Feed */}
      <section className="dashboard-tab__activity-feed">
        <h2>Activity Feed</h2>
        {sortedEvents.length === 0 ? (
          <p className="dashboard-tab__empty">No recent activity</p>
        ) : (
          <ul className="dashboard-tab__event-list">
            {sortedEvents.map((event) => (
              <li key={event.id} className="dashboard-tab__event-item">
                <span className="dashboard-tab__event-action">
                  {event.action} ({event.entityType})
                </span>
                <span className="dashboard-tab__event-time">
                  {new Date(event.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Pulse Countdown */}
      <section className="dashboard-tab__pulse-countdown">
        <h2>Next Pulse</h2>
        {kpis?.nextPulseAt ? (
          <p className="dashboard-tab__countdown-value">
            {formatCountdown(kpis.nextPulseAt)}
          </p>
        ) : (
          <p className="dashboard-tab__empty">No pulse scheduled</p>
        )}
      </section>
    </div>
  );
}
