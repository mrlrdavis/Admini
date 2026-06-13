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

export function getTimeGreeting(): string {
  return getTimeGreetingShared();
}

const parseLocalDate = parseLocalDateShared;
const formatActivityAction = formatActivityActionShared;

function categoryClass(category?: string): string {
  if (!category) return 'dashboard-tab__category-pill--default';
  const key = category.toLowerCase();
  const known = ['compliance','students','academic','hr','finance','comms','operations'];
  return known.includes(key) ? 'dashboard-tab__category-pill--' + key : 'dashboard-tab__category-pill--default';
}

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
  const [widgetView, setWidgetView] = useState<'progress' | 'priority'>('progress');

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
  const totalBadges = BADGE_DEFINITIONS.length;
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

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const localEvents = getLocalEvents();
    getTodayCalendarEvents().then(googleEvents => {
      const merged = mergeEvents(googleEvents, localEvents);
      const todayEvents = filterTodayEvents(merged);
      setCalendarEvents(todayEvents as CalendarEvent[]);
    }).catch(() => {
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

  const priorityQueue = useMemo(() => tasks.filter((t) => t.status === 'open').sort(sortByUrgency), [tasks]);
  const sortedEvents = useMemo(() => [...events].sort((a, b) => (b.createdAt > a.createdAt ? 1 : b.createdAt < a.createdAt ? -1 : 0)), [events]);
  const activityFeedItems = useMemo(() => buildActivityFeed(events, tasks), [events, tasks]);
  const visibleEvents = useMemo(() => showAllEvents ? sortedEvents.slice(0, 20) : sortedEvents.slice(0, 3), [sortedEvents, showAllEvents]);

  void visibleEvents; void onNavigateToTab; void defaultRegistry; void dashCalMonth; void kpis;

  if (loading) {
    return (
      <div className="dashboard-tab dashboard-tab--loading" aria-busy="true">
        <SkeletonCard height={80} />
        <SkeletonCard height={160} />
        <SkeletonCard height={120} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-tab dashboard-tab--error" role="alert">
        <div className="dashboard-tab__error-banner">
          <p>{error}</p>
          <button type="button" className="dashboard-tab__retry-btn" onClick={fetchData}>Retry</button>
        </div>
      </div>
    );
  }
  // Computed task groups
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
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const normalPriorityTasks = tasks.filter(t => t.status === 'open' && (!t.priority || t.priority === 'normal'));
  const lowPriorityTasks = tasks.filter(t => t.status === 'open' && t.priority === 'low');

  return (
    <div className="dashboard-tab dashboard-tab--two-col">
      {/* Top Bar - NO quick actions here */}
      <header className="dashboard-tab__topbar">
        <h1 className="dashboard-tab__greeting-text">{getTimeGreeting()}, <strong>{userName}</strong></h1>
        <div className="dashboard-tab__level-badge" onClick={() => setShowAchievements(true)}>
          <span className="dashboard-tab__level-icon">??</span>
          <span className="dashboard-tab__level-num">Level {Math.floor(unlockedCount / 2) + 1}</span>
          <span className="dashboard-tab__level-sub">{unlockedCount}/{totalBadges} badges</span>
        </div>
      </header>

      {/* Two Column Layout */}
      <div className="dashboard-tab__columns">
        {/* LEFT: Task sections */}
        <div className="dashboard-tab__left">
          <div className="dashboard-tab__widget-toggle">
            <button className={'dashboard-tab__toggle-btn' + (widgetView === 'progress' ? ' dashboard-tab__toggle-btn--active' : '')} onClick={() => setWidgetView('progress')}>Progress</button>
            <button className={'dashboard-tab__toggle-btn' + (widgetView === 'priority' ? ' dashboard-tab__toggle-btn--active' : '')} onClick={() => setWidgetView('priority')}>Priority</button>
          </div>
          {widgetView === 'progress' && (
            <>          <section className="dashboard-tab__section dashboard-tab__section--due-today">
            <div className="dashboard-tab__section-header" onClick={() => { localStorage.setItem('admini_task_filter', 'due'); onTabChange?.('tasks'); }}><span className="dashboard-tab__section-icon">📅</span><h2 className="dashboard-tab__section-title dashboard-tab__section-title--due-today">Due Today</h2><span className="dashboard-tab__section-count">{dueTodayTasks.length}</span></div>
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
            <div className="dashboard-tab__section-header" onClick={() => { localStorage.setItem('admini_task_filter', 'coming-due'); onTabChange?.('tasks'); }}><span className="dashboard-tab__section-icon">📆</span><h2 className="dashboard-tab__section-title dashboard-tab__section-title--coming">Coming Due</h2><span className="dashboard-tab__section-count">{comingDueTasks.length}</span></div>
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

          <section className="dashboard-tab__section dashboard-tab__section--blocked">
            <div className="dashboard-tab__section-header" onClick={() => { localStorage.setItem('admini_task_filter', 'blocked'); onTabChange?.('tasks'); }}><span className="dashboard-tab__section-icon">🚫</span><h2 className="dashboard-tab__section-title dashboard-tab__section-title--blocked">Blocked Tasks</h2><span className="dashboard-tab__section-count">{blockedTasks.length}</span></div>
            {blockedTasks.length === 0 ? <p className="dashboard-tab__empty">No blocked tasks</p> : (
              <ul className="dashboard-tab__task-list">
                {blockedTasks.slice(0, 5).map(task => (
                  <li key={task.id} className="dashboard-tab__task-item dashboard-tab__task-item--blocked" onClick={() => { localStorage.setItem('admini_expand_task', task.id); onTabChange?.('tasks'); }}>
                    <div className="dashboard-tab__task-left">
                      <span className="dashboard-tab__task-title">{task.title}</span>
                      <div className="dashboard-tab__task-meta">
                        {task.category && <span className={'dashboard-tab__category-pill ' + categoryClass(task.category)}>{task.category}</span>}
                        <span className="dashboard-tab__block-reason">🚫 {task.blockReason || 'Blocked'}</span>
                      </div>
                    </div>
                    <span className="dashboard-tab__stale-badge">{computeStaleDays(task.updatedAt)}d stale</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="dashboard-tab__section dashboard-tab__section--in-progress">
            <div className="dashboard-tab__section-header" onClick={() => { localStorage.setItem('admini_task_filter', 'in-progress'); onTabChange?.('tasks'); }}><span className="dashboard-tab__section-icon">🔄</span><h2 className="dashboard-tab__section-title dashboard-tab__section-title--in-progress">In Progress</h2><span className="dashboard-tab__section-count">{inProgressTasks.length}</span></div>
            {inProgressTasks.length === 0 ? <p className="dashboard-tab__empty">No in-progress tasks</p> : (
              <ul className="dashboard-tab__task-list">
                {inProgressTasks.slice(0, 5).map(task => (
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

          <section className="dashboard-tab__section dashboard-tab__section--completed">
            <div className="dashboard-tab__section-header" onClick={() => { localStorage.setItem('admini_task_filter', 'completed'); onTabChange?.('tasks'); }}><span className="dashboard-tab__section-icon">✅</span><h2 className="dashboard-tab__section-title dashboard-tab__section-title--completed">Completed</h2><span className="dashboard-tab__section-count">{completedTasks.length}</span></div>
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

          {widgetView === 'priority' && (
            <>
          <section className="dashboard-tab__section dashboard-tab__section--high-priority">
            <div className="dashboard-tab__section-header" onClick={() => { localStorage.setItem('admini_task_filter', 'high'); onTabChange?.('tasks'); }}><span className="dashboard-tab__section-icon">🔥</span><h2 className="dashboard-tab__section-title dashboard-tab__section-title--high">High Priority</h2><span className="dashboard-tab__section-count">{highPriorityTasks.length}</span></div>
            {highPriorityTasks.length === 0 ? <p className="dashboard-tab__empty">No high priority tasks</p> : (
              <ul className="dashboard-tab__task-list">
                {highPriorityTasks.slice(0, 5).map(task => (
                  <li key={task.id} className="dashboard-tab__task-item" onClick={() => { localStorage.setItem('admini_expand_task', task.id); onTabChange?.('tasks'); }}>
                    <div className="dashboard-tab__task-left">
                      <span className="dashboard-tab__task-title">{task.title}</span>
                      {task.category && <span className={'dashboard-tab__category-pill ' + categoryClass(task.category)}>{task.category}</span>}
                    </div>
                    <span className={'dashboard-tab__task-due' + (task.dueAt && parseLocalDate(task.dueAt).toDateString() === todayStr ? ' dashboard-tab__task-due--today' : '')}>{task.dueAt && parseLocalDate(task.dueAt).toDateString() === todayStr ? 'Today' : task.dueAt ? parseLocalDate(task.dueAt).toLocaleDateString(undefined, {month:'short',day:'numeric'}) : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="dashboard-tab__section dashboard-tab__section--normal">
            <div className="dashboard-tab__section-header" onClick={() => { localStorage.setItem('admini_task_filter', 'normal'); onTabChange?.('tasks'); }}><span className="dashboard-tab__section-icon">📋</span><h2 className="dashboard-tab__section-title dashboard-tab__section-title--normal">Normal Priority</h2><span className="dashboard-tab__section-count">{normalPriorityTasks.length}</span></div>
            {normalPriorityTasks.length === 0 ? <p className="dashboard-tab__empty">No normal priority tasks</p> : (
              <ul className="dashboard-tab__task-list">
                {normalPriorityTasks.slice(0, 5).map(task => (
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

          <section className="dashboard-tab__section dashboard-tab__section--low">
            <div className="dashboard-tab__section-header" onClick={() => { localStorage.setItem('admini_task_filter', 'low'); onTabChange?.('tasks'); }}><span className="dashboard-tab__section-icon">📝</span><h2 className="dashboard-tab__section-title dashboard-tab__section-title--low">Low Priority</h2><span className="dashboard-tab__section-count">{lowPriorityTasks.length}</span></div>
            {lowPriorityTasks.length === 0 ? <p className="dashboard-tab__empty">No low priority tasks</p> : (
              <ul className="dashboard-tab__task-list">
                {lowPriorityTasks.slice(0, 5).map(task => (
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

          {userId && organizationId && (
            <section className="dashboard-tab__section dashboard-tab__section--suggested">
              <div className="dashboard-tab__section-header"><span className="dashboard-tab__section-icon">💡</span><h2 className="dashboard-tab__section-title dashboard-tab__section-title--suggested">Suggested Tasks</h2></div>
              <RecommendationsWidget userId={userId} organizationId={organizationId} />
            </section>
          )}
        </div>
        {/* RIGHT: Calendar + Quick Actions + Schedule + Activity */}
        <div className="dashboard-tab__right">
          <div className="dashboard-tab__qa-cal-row">
          <section className="dashboard-tab__card dashboard-tab__card--calendar">
            <div className="dashboard-tab__mini-cal-header">
              <button type="button" className="dashboard-tab__mini-cal-nav" onClick={()=>setDashCalMonth(new Date(dashCalMonth.getFullYear(),dashCalMonth.getMonth()-1,1))} aria-label="Previous month">‹</button>
              <span className="dashboard-tab__mini-cal-month">{dashCalMonth.toLocaleDateString(undefined, {month:'long',year:'numeric'})}</span>
              <button type="button" className="dashboard-tab__mini-cal-nav" onClick={()=>setDashCalMonth(new Date(dashCalMonth.getFullYear(),dashCalMonth.getMonth()+1,1))} aria-label="Next month">›</button>
            </div>
            <div className="dashboard-tab__mini-cal-grid">
              {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <span key={d} className="dashboard-tab__mini-cal-dow">{d}</span>)}
              {(() => {
                const n = dashCalMonth;
                const first = new Date(n.getFullYear(), n.getMonth(), 1);
                const offset = first.getDay();
                const dim = new Date(n.getFullYear(), n.getMonth()+1, 0).getDate();
                const todayDate = new Date();
                const cells: React.ReactNode[] = [];
                for (let i=0; i<offset; i++) cells.push(<span key={'e'+i} />);
                for (let d=1; d<=dim; d++) {
                  const dt = new Date(n.getFullYear(), n.getMonth(), d);
                  const isToday = d === todayDate.getDate() && n.getMonth() === todayDate.getMonth() && n.getFullYear() === todayDate.getFullYear();
                  const hasTasks = tasks.some(t => t.dueAt && parseLocalDate(t.dueAt).toDateString() === dt.toDateString());
                  cells.push(<span key={d} className={'dashboard-tab__mini-cal-date' + (isToday ? ' --today' : '') + (hasTasks ? ' --has-tasks' : '')} onClick={hasTasks ? () => { localStorage.setItem('admini_task_filter', 'due'); onTabChange?.('tasks'); } : undefined}>{d}</span>);
                }
                return cells;
              })()}
            </div>
          </section>

          <section className="dashboard-tab__card dashboard-tab__card--quick-actions">
            <h2 className="dashboard-tab__feed-header">? Quick Actions</h2>
            <div className="dashboard-tab__quick-actions-widget">
              <button type="button" className="dashboard-tab__qa-widget-btn" onClick={() => onTabChange?.('capture')}>
                <span className="dashboard-tab__qa-widget-icon">??</span>
                <span className="dashboard-tab__qa-widget-label">Record Capture</span>
              </button>
              <button type="button" className="dashboard-tab__qa-widget-btn" onClick={() => { localStorage.setItem('admini_capture_mode', 'tap'); onTabChange?.('capture'); }}>
                <span className="dashboard-tab__qa-widget-icon">??</span>
                <span className="dashboard-tab__qa-widget-label">Quick Tap</span>
              </button>
              <button type="button" className="dashboard-tab__qa-widget-btn" onClick={() => { localStorage.setItem('admini_tasks_view', 'calendar'); onTabChange?.('tasks'); }}>
                <span className="dashboard-tab__qa-widget-icon">??</span>
                <span className="dashboard-tab__qa-widget-label">Task Calendar</span>
              </button>
              <button type="button" className="dashboard-tab__qa-widget-btn" onClick={() => onTabChange?.('admin')}>
                <span className="dashboard-tab__qa-widget-icon">??</span>
                <span className="dashboard-tab__qa-widget-label">Update Roster</span>
              </button>
            </div>
          </section>
          </div>
          <div className="dashboard-tab__schedule-activity-row">
          <section className="dashboard-tab__card dashboard-tab__card--schedule">
            <div className="dashboard-tab__schedule-hdr">
              <h2 className="dashboard-tab__schedule-title">?? Today's Schedule <span className="dashboard-tab__schedule-date">?? {new Date().toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}</span></h2>
              <div className="dashboard-tab__schedule-actions">
                <button type="button" className="dashboard-tab__sync-btn" onClick={handleCalendarSync} disabled={syncing} title="Sync with Google Calendar">{syncing ? 'Syncing...' : '?? Sync'}</button>
                <button type="button" className="dashboard-tab__sync-btn" onClick={() => { const summary = prompt('Event for today:'); if (!summary || !summary.trim()) return; const time = prompt('Time (HH:MM, optional):') || ''; const today = new Date().toISOString().split('T')[0]; const start = time ? today + 'T' + time + ':00' : today + 'T09:00:00'; const end = time ? today + 'T' + time + ':00' : today + 'T10:00:00'; const ev = createLocalEvent({ summary: summary.trim(), start, end }); setCalendarEvents(prev => [...prev, ev]); }} title="Add event for today">+ Add</button>
                <button type="button" className="dashboard-tab__edit-link" onClick={() => setScheduleEditing(v => !v)}>{scheduleEditing ? 'Done' : 'Edit'}</button>
              </div>
            </div>
            {lastSync && <div className="dashboard-tab__sync-time">Last synced {(() => { const d = Date.now() - new Date(lastSync).getTime(); const m = Math.floor(d/60000); if (m < 1) return 'just now'; if (m < 60) return m + 'm ago'; const h = Math.floor(m/60); if (h < 24) return h + 'h ago'; return new Date(lastSync).toLocaleDateString(); })()}</div>}
            {dayBlocks.map((block, blockIdx) => (
              <div key={block.period} className="dashboard-tab__sched-block">
                <div className="dashboard-tab__sched-period">
                  <span className="dashboard-tab__sched-period-name">{block.period}</span>
                  <span className="dashboard-tab__sched-period-time">{block.time}</span>
                  {block.activities.map((a, actIdx) => (
                    <span key={actIdx} className="dashboard-tab__sched-chip">
                      {scheduleEditing ? (
                        <>
                          <span onClick={() => renameActivity(blockIdx, actIdx)} style={{cursor:'pointer'}}>{a.label}</span>
                          <button type="button" className="dashboard-tab__sched-chip-edit" onClick={() => removeActivity(blockIdx, actIdx)} aria-label={'Remove ' + a.label}>×</button>
                        </>
                      ) : a.label}
                    </span>
                  ))}
                  {scheduleEditing && <button type="button" className="dashboard-tab__sched-add" onClick={() => addActivity(blockIdx)}>+ activity</button>}
                </div>
                {calendarEvents.filter(ev => {
                  if(!ev.start) return false;
                  const h = new Date(ev.start).getHours();
                  if(block.period==='Morning') return h>=8&&h<12;
                  if(block.period==='Afternoon') return h>=12&&h<16;
                  return h>=16;
                }).map(ev => (
                  <div key={ev.id} className="dashboard-tab__sched-event">
                    <span className="dashboard-tab__sched-check" />
                    <span className="dashboard-tab__sched-event-time">{new Date(ev.start).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</span>
                    <span className="dashboard-tab__sched-event-title">{ev.summary}</span>
                    {ev.id && !ev.id.startsWith('google') ? <button type="button" onClick={(e)=>{e.stopPropagation();const stored=JSON.parse(localStorage.getItem('admini_local_events')||'[]');const filtered=stored.filter((s:any)=>s.id!==ev.id);localStorage.setItem('admini_local_events',JSON.stringify(filtered));setCalendarEvents(prev=>prev.filter(x=>x.id!==ev.id));}} className="dashboard-tab__sched-event-delete">?</button> : null}
                  </div>
                ))}
              </div>
            ))}
          </section>
          <section className="dashboard-tab__card dashboard-tab__card--activity">
            <h2 className="dashboard-tab__feed-header">?? Activity Feed</h2>
            <ul className="dashboard-tab__feed-list">
              {activityFeedItems.map(ev => (
                <li key={ev.id} className="dashboard-tab__feed-item">
                  {(() => { const t = ev.entityType; const a = ev.action; let cls = 'dashboard-tab__feed-icon--default'; let icon = '??'; if (t === 'capture') { cls = 'dashboard-tab__feed-icon--capture-voice'; icon = '??'; } else if (t === 'tap_capture') { cls = 'dashboard-tab__feed-icon--capture-tap'; icon = '??'; } else if (t === 'observation') { cls = 'dashboard-tab__feed-icon--observation'; icon = '??'; } else if (t === 'note' || t === 'meeting_note') { cls = 'dashboard-tab__feed-icon--note'; icon = '??'; } else if (t === 'achievement' || t === 'badge') { cls = 'dashboard-tab__feed-icon--achievement'; icon = '??'; } else if (t === 'task') { if (a === 'create' || a === 'created') { cls = 'dashboard-tab__feed-icon--task-create'; icon = '?'; } else if (a === 'complete' || a === 'completed') { cls = 'dashboard-tab__feed-icon--task-complete'; icon = '?'; } else { cls = 'dashboard-tab__feed-icon--task-create'; icon = '??'; } } return <span className={'dashboard-tab__feed-icon ' + cls}>{icon}</span>; })()}
                  <div className="dashboard-tab__feed-body">
                    <span className="dashboard-tab__feed-title">{(() => { const t = tasks.find(tk => tk.id === ev.entityId); if (t) return (ev.action === 'create' || ev.action === 'created' ? '' : 'Completed: ') + t.title; if (ev.entityType === 'capture') return 'Voice capture: ' + ev.entityId.substring(0,20); return formatActivityAction(ev); })()}</span>
                    <span className="dashboard-tab__feed-time">{(() => { const diff = Date.now() - new Date(ev.createdAt).getTime(); const mins = Math.floor(diff/60000); if (mins < 60) return mins + ' minutes ago'; const hrs = Math.floor(mins/60); if (hrs < 24) return hrs + ' hours ago'; return new Date(ev.createdAt).toLocaleString(undefined,{weekday:'short',hour:'numeric',minute:'2-digit'}); })()}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
          </div>
        </div>
      </div>      {showAchievements && (
        <div className="dashboard-tab__achievements-overlay" onClick={() => setShowAchievements(false)}>
          <div className="dashboard-tab__achievements-modal" onClick={e => e.stopPropagation()}>
            <div className="dashboard-tab__achievements-header">
              <div>
                <h2 className="dashboard-tab__achievements-title">Achievements</h2>
                <p className="dashboard-tab__achievements-sub">Level {Math.floor(unlockedCount / 2) + 1} • {unlockedCount} of {totalBadges} earned</p>
              </div>
              <button type="button" className="dashboard-tab__achievements-close" onClick={() => setShowAchievements(false)}>×</button>
            </div>
            <div className="dashboard-tab__achievements-bar"><div className="dashboard-tab__achievements-fill" style={{ width: (unlockedCount / totalBadges * 100) + '%' }} /></div>
            {(() => {
              const earnedMap = JSON.parse(localStorage.getItem('admini_badges') || '{}') || {};
              const earned = BADGE_DEFINITIONS.filter(d => earnedMap[d.id]);
              const locked = BADGE_DEFINITIONS.filter(d => !earnedMap[d.id]);
              return (
                <>
                  {earned.length > 0 && (
                    <div>
                      <h3 className="dashboard-tab__achievements-section-title">Earned</h3>
                      {earned.map(d => (
                        <div key={d.id} className="dashboard-tab__achievement-row dashboard-tab__achievement-row--earned">
                          <span className="dashboard-tab__achievement-badge-icon">{d.emoji}</span>
                          <div className="dashboard-tab__achievement-info"><strong>{d.label}</strong><span>{d.description}</span></div>
                          <span className="dashboard-tab__achievement-date">Earned {new Date(earnedMap[d.id]).toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {locked.length > 0 && (
                    <div>
                      <h3 className="dashboard-tab__achievements-section-title">Locked</h3>
                      {locked.map(d => (
                        <div key={d.id} className="dashboard-tab__achievement-row dashboard-tab__achievement-row--locked">
                          <span className="dashboard-tab__achievement-badge-icon">{d.emoji}</span>
                          <div className="dashboard-tab__achievement-info"><strong>{d.label}</strong><span>{d.description}</span></div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
