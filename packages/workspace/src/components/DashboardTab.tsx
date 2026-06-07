// ---------------------------------------------------------------------------
// DashboardTab - Native React implementation of the Dashboard view
// ---------------------------------------------------------------------------
// Requirements: 2.1, 2.4, 7.1

import { useCallback, useEffect, useMemo, useState } from 'react';
import { KPICard, SkeletonCard } from '@admini/ui';
import {
  getTasks,
  getActivityEvents,
  getDashboardKPIs,
  sortByUrgency,
} from '../services/dashboardService';
import type { DashboardTask, ActivityEvent, DashboardKPIs } from '../types';

// Re-export sortByUrgency for testing and backward compatibility
export { sortByUrgency } from '../services/dashboardService';

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
        <SkeletonCard height={80} />
        <SkeletonCard height={160} />
        <SkeletonCard height={120} />
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
        <header className="dashboard-tab__section-header">
          <h2>Priority Queue</h2>
          <button type="button" className="dashboard-tab__section-link">View all</button>
        </header>
        {priorityQueue.length === 0 ? (
          <p className="dashboard-tab__empty">No open tasks</p>
        ) : (
          <ul className="dashboard-tab__task-list">
            {priorityQueue.map((task) => (
              <li key={task.id} className="dashboard-tab__task-item ws-press-feedback" data-priority={task.priority}>
                <span className="dashboard-tab__task-title">{task.title}</span>
                <span className="dashboard-tab__task-priority">{task.priority}</span>
                <div className="dashboard-tab__task-meta">
                  {task.dueAt && (
                    <span className="dashboard-tab__task-due">
                      Due {new Date(task.dueAt).toLocaleDateString()}
                    </span>
                  )}
                  <span className="dashboard-tab__task-source" aria-label="source">📋</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Activity Feed */}
      <section className="dashboard-tab__activity-feed">
        <header className="dashboard-tab__section-header">
          <h2>Activity Feed</h2>
          <button type="button" className="dashboard-tab__section-link">View all</button>
        </header>
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
        <header className="dashboard-tab__section-header">
          <h2>Next Pulse</h2>
          <button type="button" className="dashboard-tab__section-link">View all</button>
        </header>
        {kpis?.nextPulseAt ? (
          <div className="dashboard-tab__countdown-card">
            <span className="dashboard-tab__countdown-icon" aria-hidden="true">?</span>
            <div className="dashboard-tab__countdown-info">
              <span className="dashboard-tab__countdown-label">Next Pulse</span>
              <span className="dashboard-tab__countdown-value">
                {formatCountdown(kpis.nextPulseAt)}
              </span>
            </div>
          </div>
        ) : (
          <p className="dashboard-tab__empty">No pulse scheduled</p>
        )}
      </section>
    </div>
  );
}
