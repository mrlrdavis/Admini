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
import { RecommendationsWidget } from './RecommendationsWidget';
// BadgesSection and BadgesPanel removed - replaced with compact achievement indicator

// Re-export sortByUrgency for testing and backward compatibility
export { sortByUrgency } from '../services/dashboardService';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DashboardTabProps {
  userName: string;
  userId?: string;
  organizationId?: string;
  onNavigateToTab?: (tabId: string) => void;
  onTabChange?: (tabId: string) => void;
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
 * Formats an activity event into a human-readable action string.
 */
function formatActivityAction(event: ActivityEvent): string {
  const entityLabel = event.entityType === 'capture' ? 'capture'
    : event.entityType === 'task' ? 'task'
    : event.entityType === 'integration' ? 'integration'
    : event.entityType === 'invitation' ? 'invitation'
    : event.entityType;

  const actionLabel = event.action === 'create' ? 'Created'
    : event.action === 'update' ? 'Updated'
    : event.action === 'delete' ? 'Deleted'
    : event.action === 'accept' ? 'Accepted'
    : event.action;

  return `${actionLabel} a ${entityLabel}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DashboardTab({ userName, userId, organizationId, onNavigateToTab, onTabChange }: DashboardTabProps) {
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [unlockedCount, setUnlockedCount] = useState(0);
  const totalBadges = 9; // total badge count

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

  useEffect(() => {
    try {
      const raw = localStorage.getItem('admini_badges');
      const badges = raw ? JSON.parse(raw) : {};
      setUnlockedCount(Object.keys(badges).length);
    } catch { /* ignore */ }
  }, []);

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

  /** Generate activity items from tasks (assigned tasks, completed tasks) */
  const taskActivity = useMemo(() => {
    return tasks
      .filter(t => t.assignedTo || t.status === 'completed')
      .slice(0, 10)
      .map(t => ({
        id: 'task-' + t.id,
        action: t.status === 'completed' ? 'completed' : 'assigned',
        entityType: 'task',
        entityId: t.id,
        createdAt: t.updatedAt || t.createdAt,
        detail: t.status === 'completed'
          ? `"${t.title}" was completed`
          : `"${t.title}" assigned to ${t.assignedTo}`,
      }));
  }, [tasks]);

  /** Combined activity: real events + task-derived activity, sorted reverse-chronologically */
  const allActivity = useMemo(() => {
    return [
      ...sortedEvents.map(e => ({
        id: e.id,
        detail: `${formatActivityAction(e)}`,
        createdAt: e.createdAt,
      })),
      ...taskActivity.map(a => ({
        id: a.id,
        detail: a.detail,
        createdAt: a.createdAt,
      })),
    ].sort((a, b) => b.createdAt > a.createdAt ? 1 : -1).slice(0, 10);
  }, [sortedEvents, taskActivity]);

  /** Events to display: first 3 by default, up to 20 when expanded. */
  const visibleEvents = useMemo(
    () => showAllEvents ? sortedEvents.slice(0, 20) : sortedEvents.slice(0, 3),
    [sortedEvents, showAllEvents],
  );

  // Suppress unused variable warnings - kept for backward compatibility
  void visibleEvents;
  void allActivity;
  void onNavigateToTab;

  /** Generate activity items from tasks when no sync_events exist */
  const taskActivityFallback = useMemo(() => {
    if (sortedEvents.length > 0) return [];
    return tasks
      .slice(0, 5)
      .map((t) => ({
        id: t.id,
        action: t.assignedTo ? `Task assigned to ${t.assignedTo}` : `Task created`,
        detail: t.title,
        time: t.createdAt,
      }));
  }, [tasks, sortedEvents]);

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

      {/* Quick Actions */}
      <div className="dashboard-tab__quick-actions">
        <button type="button" className="dashboard-tab__quick-btn" onClick={() => onTabChange?.('capture')}>
          <span>{'\uD83C\uDFA4'}</span> Voice
        </button>
        <button type="button" className="dashboard-tab__quick-btn" onClick={() => onTabChange?.('capture')}>
          <span>{'\uD83D\uDC46'}</span> Tap
        </button>
        <button type="button" className="dashboard-tab__quick-btn" onClick={() => onTabChange?.('tasks')}>
          <span>{'\u2795'}</span> Task
        </button>
      </div>

      {/* KPI Cards */}
      <section className="dashboard-tab__kpis">
        <KPICard label="Tasks" value={kpis?.openTasks ?? 0} />
        <KPICard label="Completed" value={kpis?.completedThisWeek ?? 0} />
        <KPICard label="Overdue" value={kpis?.overdueTasks ?? 0} />
      </section>
      {/* Task Recommendations - below KPI cards (Requirements: 3.1, 3.4) */}
      {userId && organizationId && (
        <RecommendationsWidget userId={userId} organizationId={organizationId} />
      )}

      {/* Achievement Progress - compact with explanation */}
      <div className="dashboard-tab__achievement-compact">
        <span className="dashboard-tab__achievement-icon">{'\u2B50'}</span>
        <div className="dashboard-tab__achievement-info">
          <span className="dashboard-tab__achievement-progress">Level {Math.floor(unlockedCount / 2) + 1}</span>
          <span className="dashboard-tab__achievement-explainer">
            {unlockedCount}/{totalBadges} achievements earned - complete tasks and use features to level up
          </span>
        </div>
        <div className="dashboard-tab__achievement-bar">
          <div className="dashboard-tab__achievement-fill" style={{ width: (unlockedCount / totalBadges * 100) + '%' }} />
        </div>
      </div>

      {/* High Priority */}
      <section className="dashboard-tab__priority-queue">
        <header className="dashboard-tab__section-header">
          <h2>High Priority</h2>
          <button type="button" className="dashboard-tab__section-link" onClick={() => onTabChange?.('tasks')}>
            View all
          </button>
        </header>
        {priorityQueue.filter(t => t.priority === 'urgent' || t.priority === 'high').length === 0 ? (
          <p className="dashboard-tab__empty">No high priority tasks</p>
        ) : (
          <ul className="dashboard-tab__task-list">
            {priorityQueue.filter(t => t.priority === 'urgent' || t.priority === 'high').slice(0, 5).map((task) => (
              <li key={task.id} className="dashboard-tab__task-item ws-press-feedback" data-priority={task.priority}>
                <span className="dashboard-tab__task-title">{task.title}</span>
                <span className="dashboard-tab__task-priority">{task.priority}</span>
                <div className="dashboard-tab__task-meta">
                  {task.dueAt && (
                    <span className="dashboard-tab__task-due">
                      Due {new Date(task.dueAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Due Today */}
      <section className="dashboard-tab__priority-queue">
        <header className="dashboard-tab__section-header">
          <h2>Due Today</h2>
        </header>
        {(() => {
          const today = new Date().toDateString();
          const dueToday = tasks.filter(t => t.status !== 'completed' && t.dueAt && new Date(t.dueAt).toDateString() === today);
          if (dueToday.length === 0) return <p className="dashboard-tab__empty">Nothing due today</p>;
          return (
            <ul className="dashboard-tab__task-list">
              {dueToday.map((task) => (
                <li key={task.id} className="dashboard-tab__task-item ws-press-feedback" data-priority={task.priority}>
                  <span className="dashboard-tab__task-title">{task.title}</span>
                  <span className="dashboard-tab__task-priority">{task.priority}</span>
                </li>
              ))}
            </ul>
          );
        })()}
      </section>

      {/* Coming Due */}
      <section className="dashboard-tab__priority-queue">
        <header className="dashboard-tab__section-header">
          <h2>Coming Due</h2>
        </header>
        {(() => {
          const now = new Date();
          const in3Days = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3);
          const comingDue = tasks.filter(t => {
            if (t.status === 'completed' || !t.dueAt) return false;
            const due = new Date(t.dueAt);
            return due > now && due <= in3Days;
          });
          if (comingDue.length === 0) return <p className="dashboard-tab__empty">Nothing coming due soon</p>;
          return (
            <ul className="dashboard-tab__task-list">
              {comingDue.map((task) => (
                <li key={task.id} className="dashboard-tab__task-item ws-press-feedback" data-priority={task.priority}>
                  <span className="dashboard-tab__task-title">{task.title}</span>
                  <span className="dashboard-tab__task-due">
                    Due {new Date(task.dueAt!).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                </li>
              ))}
            </ul>
          );
        })()}
      </section>

      {/* Day's Schedule */}
      <section className="dashboard-tab__day-schedule">
        <header className="dashboard-tab__section-header">
          <h2>Today's Schedule</h2>
          <button type="button" className="dashboard-tab__section-link" onClick={() => onTabChange?.('pulse')}>
            Edit
          </button>
        </header>
        {(() => {
          const DAY_STRUCTURE_KEY = 'admini_day_structure';
          let dayBlocks: { period: string; time: string; activities: { label: string; type: string }[] }[] = [];
          try {
            const saved = localStorage.getItem(DAY_STRUCTURE_KEY);
            if (saved) {
              dayBlocks = JSON.parse(saved);
            }
          } catch {}
          if (dayBlocks.length === 0) {
            dayBlocks = [
              { period: 'Morning', time: '8:00 AM - 12:00 PM', activities: [{ label: 'Deep work', type: 'focus' }] },
              { period: 'Afternoon', time: '12:00 PM - 4:00 PM', activities: [{ label: 'Team sync', type: 'meetings' }] },
              { period: 'End of Day', time: '4:00 PM - 5:00 PM', activities: [{ label: 'Wrap-up', type: 'wrap-up' }] },
            ];
          }
          return (
            <div className="dashboard-tab__schedule-blocks">
              {dayBlocks.map((block) => (
                <div key={block.period} className="dashboard-tab__schedule-block">
                  <span className="dashboard-tab__schedule-period">{block.period}</span>
                  <span className="dashboard-tab__schedule-time">{block.time}</span>
                  <div className="dashboard-tab__schedule-activities">
                    {block.activities.map((a) => (
                      <span key={a.label} className="dashboard-tab__schedule-activity">{a.label}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </section>

      {/* Activity Feed */}
      <section className="dashboard-tab__activity-feed">
        <header className="dashboard-tab__section-header">
          <h2>Activity Feed</h2>
          <button type="button" className="dashboard-tab__section-link" onClick={() => onTabChange?.('tasks')}>
            View all
          </button>
        </header>
        {sortedEvents.length === 0 && taskActivityFallback.length === 0 ? (
          <p className="dashboard-tab__empty">No recent activity</p>
        ) : sortedEvents.length > 0 ? (
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
        ) : (
          <ul className="dashboard-tab__event-list">
            {taskActivityFallback.map((item) => (
              <li key={item.id} className="dashboard-tab__event-item">
                <span className="dashboard-tab__event-action">{item.action}</span>
                <span className="dashboard-tab__event-detail">{item.detail}</span>
                <span className="dashboard-tab__event-time">
                  {new Date(item.time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>


    </div>
  );
}
