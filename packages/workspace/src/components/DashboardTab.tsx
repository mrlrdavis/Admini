// ---------------------------------------------------------------------------
// DashboardTab - Native React implementation of the Dashboard view
// ---------------------------------------------------------------------------
// Requirements: 2.1, 2.4, 7.1

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SkeletonCard } from '@admini/ui';
import {
  getTasks,
  getActivityEvents,
  getDashboardKPIs,
  sortByUrgency,
} from '../services/dashboardService';
import type { DashboardTask, ActivityEvent, DashboardKPIs } from '../types';
import { RecommendationsWidget } from './RecommendationsWidget';
import { getTodayCalendarEvents, type CalendarEvent } from '../services/googleIntegrationService';
import {
  parseLocalDate as parseLocalDateShared,
  getTimeGreeting as getTimeGreetingShared,
  filterTodayEvents,
  defaultRegistry,
  formatActivityAction as formatActivityActionShared,
} from '@admini/shared';
import { getLocalEvents, createLocalEvent } from '../services/localEventService';
import { mergeEvents } from '../services/calendarMerge';
import { buildActivityFeed } from '../services/activityFeed';
import { BADGE_DEFINITIONS } from './BadgesPanel';

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
 * Delegates to @admini/shared. Kept exported for backward compatibility.
 */
export function getTimeGreeting(): string {
  return getTimeGreetingShared();
}

// parseLocalDate is now imported from @admini/shared (as parseLocalDateShared).
// Local alias for use in this file:
const parseLocalDate = parseLocalDateShared;



// formatActivityAction is now imported from @admini/shared (as formatActivityActionShared).
// Local alias for use in this file:
const formatActivityAction = formatActivityActionShared;

/** Maps a category label to its pill CSS modifier (data-driven, lowercased). */
function categoryClass(category?: string): string {
  if (!category) return 'dashboard-tab__category-pill--default';
  const key = category.toLowerCase();
  const known = ['compliance','students','academic','hr','finance','comms','operations'];
  return known.includes(key) ? 'dashboard-tab__category-pill--' + key : 'dashboard-tab__category-pill--default';
}

/** Computes days since a task was last updated (live, never hardcoded). */
function computeStaleDays(updatedAt?: string): number {
  if (!updatedAt) return 0;
  const diff = Date.now() - new Date(updatedAt).getTime();
  return Math.max(0, Math.floor(diff / 86400000));
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
  const [showAchievements, setShowAchievements] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [dashCalMonth, setDashCalMonth] = useState(new Date());
  const [unlockedCount, setUnlockedCount] = useState(0);
  const [dayBlocks, setDayBlocks] = useState<{period:string;time:string;activities:{label:string;type:string}[]}[]>([]);
  const [scheduleEditing, setScheduleEditing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [widgetView, setWidgetView] = useState<'progress' | 'type'>('progress');

  useEffect(() => {
    try {
      const s = localStorage.getItem('admini_day_structure');
      if (s) setDayBlocks(JSON.parse(s));
      else setDayBlocks([
        { period: 'Morning', time: '8:00 AM - 12:00 PM', activities: [{ label: 'Deep work', type: 'focus' }] },
        { period: 'Afternoon', time: '12:00 PM - 4:00 PM', activities: [{ label: 'Team sync', type: 'meetings' }] },
        { period: 'End of Day', time: '4:00 PM - 5:00 PM', activities: [{ label: 'Wrap-up', type: 'wrap-up' }] },
      ]);
    } catch { /* ignore */ }
    try { setLastSync(localStorage.getItem('admini_last_calendar_sync')); } catch { /* ignore */ }
  }, []);

  function persistDayBlocks(next: {period:string;time:string;activities:{label:string;type:string}[]}[]) {
    setDayBlocks(next);
    try { localStorage.setItem('admini_day_structure', JSON.stringify(next)); } catch { /* ignore */ }
  }

  function renameActivity(blockIdx: number, actIdx: number) {
    const current = dayBlocks[blockIdx]?.activities[actIdx]?.label || '';
    const next = prompt('Activity label:', current);
    if (next === null) return;
    persistDayBlocks(dayBlocks.map((b, i) => i !== blockIdx ? b : { ...b, activities: b.activities.map((a, j) => j !== actIdx ? a : { ...a, label: next.trim() || a.label }) }));
  }

  function addActivity(blockIdx: number) {
    const label = prompt('New activity label:');
    if (!label || !label.trim()) return;
    persistDayBlocks(dayBlocks.map((b, i) => i !== blockIdx ? b : { ...b, activities: [...b.activities, { label: label.trim(), type: 'custom' }] }));
  }

  function removeActivity(blockIdx: number, actIdx: number) {
    persistDayBlocks(dayBlocks.map((b, i) => i !== blockIdx ? b : { ...b, activities: b.activities.filter((_, j) => j !== actIdx) }));
  }

  async function handleCalendarSync() {
    setSyncing(true);
    try {
      const localEvents = getLocalEvents();
      const googleEvents = await getTodayCalendarEvents().catch(() => []);
      const merged = mergeEvents(googleEvents, localEvents);
      setCalendarEvents(filterTodayEvents(merged) as CalendarEvent[]);
      const ts = new Date().toISOString();
      localStorage.setItem('admini_last_calendar_sync', ts);
      setLastSync(ts);
    } finally {
      setSyncing(false);
    }
  }
  const totalBadges = BADGE_DEFINITIONS.length; // total badge count
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
    const localEvents = getLocalEvents();
    getTodayCalendarEvents().then(googleEvents => {
      const merged = mergeEvents(googleEvents, localEvents);
      const todayEvents = filterTodayEvents(merged);
      setCalendarEvents(todayEvents as CalendarEvent[]);
    }).catch(() => {
      // Google fetch failed - degrade gracefully with local events only
      const merged = mergeEvents([], localEvents);
      const todayEvents = filterTodayEvents(merged);
      setCalendarEvents(todayEvents as CalendarEvent[]);
    });
  }, []);

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


  /** Activity feed built using buildActivityFeed from the activityFeed service. */
  const activityFeedItems = useMemo(
    () => buildActivityFeed(events, tasks),
    [events, tasks],
  );

  /** Events to display: first 3 by default, up to 20 when expanded. */
  const visibleEvents = useMemo(
    () => showAllEvents ? sortedEvents.slice(0, 20) : sortedEvents.slice(0, 3),
    [sortedEvents, showAllEvents],
  );

  // Suppress unused variable warnings - kept for backward compatibility
  void visibleEvents;
  void onNavigateToTab;
  void defaultRegistry;
  void dashCalMonth;
  void kpis;

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


  // Computed: task groups
  const blockedTasks = tasks.filter(t => t.status === 'archived');
  const highPriorityTasks = priorityQueue.filter(t => t.priority === 'urgent' || t.priority === 'high');
  const todayStr = new Date().toDateString();
  const dueTodayTasks = tasks.filter(t => t.status !== 'completed' && t.dueAt && parseLocalDate(t.dueAt).toDateString() === todayStr);
  const nowDate = new Date();
  const in7Days = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate() + 7);
  const comingDueTasks = tasks.filter(t => {
    if (t.status === 'completed' || !t.dueAt) return false;
    const due = parseLocalDate(t.dueAt);
    return due > nowDate && due <= in7Days;
  });
  const inProgressTasks = tasks.filter(t => t.status === 'in-progress');
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const normalPriorityTasks = tasks.filter(t => t.status === 'open' && (!t.priority || t.priority === 'normal'));
  const lowPriorityTasks = tasks.filter(t => t.status === 'open' && t.priority === 'low');

  /** Navigate to tasks tab with a filter preset */
  function navigateWithFilter(filter: { type: string; value: string }) {
    localStorage.setItem('admini_tasks_filter', JSON.stringify(filter));
    onTabChange?.('tasks');
  }
  return (
    <div className="dashboard-tab dashboard-tab--two-col">
      {/* Top Bar */}
      <header className="dashboard-tab__topbar">
        <h1 className="dashboard-tab__greeting-text">{getTimeGreeting()}, <strong>{userName}</strong></h1>
        <div className="dashboard-tab__level-badge" onClick={() => setShowAchievements(true)}>
          <span className="dashboard-tab__level-icon">🏆</span>
          <span className="dashboard-tab__level-num">Level {Math.floor(unlockedCount / 2) + 1}</span>
          <span className="dashboard-tab__level-sub">{unlockedCount}/{totalBadges} badges</span>
        </div>
      </header>

      {/* Two Column Layout */}
      <div className="dashboard-tab__columns">
        {/* LEFT: Task sections */}
        <div className="dashboard-tab__left">
          {/* Progress/Type Toggle */}
          <div className="dashboard-tab__widget-toggle">
            <button type="button" className={'dashboard-tab__toggle-btn' + (widgetView === 'progress' ? ' dashboard-tab__toggle-btn--active' : '')} onClick={() => setWidgetView('progress')}>Progress</button>
            <button type="button" className={'dashboard-tab__toggle-btn' + (widgetView === 'type' ? ' dashboard-tab__toggle-btn--active' : '')} onClick={() => setWidgetView('type')}>Type</button>
          </div>

          {widgetView === 'progress' && (
            <>
              <section className="dashboard-tab__section dashboard-tab__section--due-today">
                <div className="dashboard-tab__section-header" onClick={() => navigateWithFilter({type: 'progress', value: 'due'})}><span className="dashboard-tab__section-icon">⏱</span><h2 className="dashboard-tab__section-title dashboard-tab__section-title--due-today">Due Today</h2><span className="dashboard-tab__section-count">{dueTodayTasks.length}</span></div>
                {dueTodayTasks.length === 0 ? <p className="dashboard-tab__empty">Nothing due today</p> : (
                  <ul className="dashboard-tab__task-list">
                    {dueTodayTasks.map(task => (
                      <li key={task.id} className="dashboard-tab__task-item" onClick={() => { localStorage.setItem('admini_expand_task', task.id); onTabChange?.('tasks'); }}>
                        <div className="dashboard-tab__task-left">
                          <span className="dashboard-tab__task-title">{task.title}</span>
                          {task.category && <span className={'dashboard-tab__category-pill ' + categoryClass(task.category)}>{task.category}</span>}
                        </div>
                        <span className="dashboard-tab__task-due">{task.dueAt ? parseLocalDate(task.dueAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}) : ''}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="dashboard-tab__section dashboard-tab__section--coming-due">
                <div className="dashboard-tab__section-header" onClick={() => navigateWithFilter({type: 'progress', value: 'coming-due'})}><span className="dashboard-tab__section-icon">📅</span><h2 className="dashboard-tab__section-title dashboard-tab__section-title--coming">Coming Due</h2><span className="dashboard-tab__section-count">{comingDueTasks.length}</span></div>
                {comingDueTasks.length === 0 ? <p className="dashboard-tab__empty">Nothing coming due</p> : (
                  <ul className="dashboard-tab__task-list">
                    {comingDueTasks.slice(0, 5).map(task => (
                      <li key={task.id} className="dashboard-tab__task-item" onClick={() => { localStorage.setItem('admini_expand_task', task.id); onTabChange?.('tasks'); }}>
                        <div className="dashboard-tab__task-left">
                          <span className="dashboard-tab__task-title">{task.title}</span>
                          {task.category && <span className={'dashboard-tab__category-pill ' + categoryClass(task.category)}>{task.category}</span>}
                        </div>
                        <span className="dashboard-tab__task-due">{parseLocalDate(task.dueAt!).toLocaleDateString(undefined, {month:'short',day:'numeric'})}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="dashboard-tab__section dashboard-tab__section--in-progress">
                <div className="dashboard-tab__section-header" onClick={() => navigateWithFilter({type: 'progress', value: 'in-progress'})}><span className="dashboard-tab__section-icon">⏳</span><h2 className="dashboard-tab__section-title dashboard-tab__section-title--in-progress">In Progress</h2><span className="dashboard-tab__section-count">{inProgressTasks.length}</span></div>
                {inProgressTasks.length === 0 ? <p className="dashboard-tab__empty">No tasks in progress</p> : (
                  <ul className="dashboard-tab__task-list">
                    {inProgressTasks.slice(0, 5).map(task => (
                      <li key={task.id} className="dashboard-tab__task-item" onClick={() => { localStorage.setItem('admini_expand_task', task.id); onTabChange?.('tasks'); }}>
                        <div className="dashboard-tab__task-left">
                          <span className="dashboard-tab__task-title">{task.title}</span>
                          {task.category && <span className={'dashboard-tab__category-pill ' + categoryClass(task.category)}>{task.category}</span>}
                        </div>
                        <span className="dashboard-tab__task-due">{task.dueAt ? parseLocalDate(task.dueAt).toLocaleDateString(undefined, {month:'short',day:'numeric'}) : ''}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="dashboard-tab__section dashboard-tab__section--blocked">
                <div className="dashboard-tab__section-header" onClick={() => navigateWithFilter({type: 'progress', value: 'blocked'})}><span className="dashboard-tab__section-icon">🚫</span><h2 className="dashboard-tab__section-title dashboard-tab__section-title--blocked">Blocked Tasks</h2><span className="dashboard-tab__section-count">{blockedTasks.length}</span></div>
                {blockedTasks.length === 0 ? <p className="dashboard-tab__empty">No blocked tasks</p> : (
                  <ul className="dashboard-tab__task-list">
                    {blockedTasks.slice(0, 5).map(task => (
                      <li key={task.id} className="dashboard-tab__task-item dashboard-tab__task-item--blocked" onClick={() => { localStorage.setItem('admini_expand_task', task.id); onTabChange?.('tasks'); }}>
                        <div className="dashboard-tab__task-left">
                          <span className="dashboard-tab__task-title">{task.title}</span>
                          <div className="dashboard-tab__task-meta">
                            {task.category && <span className={'dashboard-tab__category-pill ' + categoryClass(task.category)}>{task.category}</span>}
                            <span className="dashboard-tab__block-reason">⚠ {task.description || 'Blocked'}</span>
                          </div>
                        </div>
                        <span className="dashboard-tab__stale-badge">{computeStaleDays(task.updatedAt)}d stale</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="dashboard-tab__section dashboard-tab__section--completed">
                <div className="dashboard-tab__section-header" onClick={() => navigateWithFilter({type: 'progress', value: 'completed'})}><span className="dashboard-tab__section-icon">✓</span><h2 className="dashboard-tab__section-title dashboard-tab__section-title--completed">Completed</h2><span className="dashboard-tab__section-count">{completedTasks.length}</span></div>
                {completedTasks.length === 0 ? <p className="dashboard-tab__empty">No completed tasks</p> : (
                  <ul className="dashboard-tab__task-list">
                    {completedTasks.slice(0, 5).map(task => (
                      <li key={task.id} className="dashboard-tab__task-item" onClick={() => { localStorage.setItem('admini_expand_task', task.id); onTabChange?.('tasks'); }}>
                        <div className="dashboard-tab__task-left">
                          <span className="dashboard-tab__task-title">{task.title}</span>
                          {task.category && <span className={'dashboard-tab__category-pill ' + categoryClass(task.category)}>{task.category}</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}