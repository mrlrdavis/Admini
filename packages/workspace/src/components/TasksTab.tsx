// ---------------------------------------------------------------------------
// TasksTab - Native React implementation of the Tasks view
// ---------------------------------------------------------------------------
// Full task list with filtering, priority indicators, and add FAB.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SkeletonCard } from '@admini/ui';
import { getTasks } from '../services/dashboardService';
import type { DashboardTask } from '../types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TasksTabProps {}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TaskFilter = 'all' | 'today' | 'this-week' | 'delegated';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function isThisWeek(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return d >= monday && d <= sunday;
}

// ---------------------------------------------------------------------------
// Empty state messages per filter
// ---------------------------------------------------------------------------

const emptyStateContent: Record<TaskFilter, { title: string; desc: string }> = {
  all: {
    title: 'No tasks yet',
    desc: 'Tasks you create or are assigned will appear here.',
  },
  today: {
    title: 'No tasks today',
    desc: 'Nothing due today. Enjoy the breathing room.',
  },
  'this-week': {
    title: 'No tasks this week',
    desc: 'Your week is clear. Time to plan ahead.',
  },
  delegated: {
    title: 'No delegated tasks',
    desc: 'Tasks you delegate to others will show up here.',
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TasksTab(_props: TasksTabProps) {
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  // Track indicator position via refs on each pill
  const filterRefs = useRef<Record<TaskFilter, HTMLButtonElement | null>>({
    all: null,
    today: null,
    'this-week': null,
    delegated: null,
  });
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const el = filterRefs.current[filter];
    if (el) {
      setIndicatorStyle({ left: el.offsetLeft, width: el.offsetWidth });
    }
  }, [filter]);

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTasks();
      setTasks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // -------------------------------------------------------------------------
  // Filtering
  // -------------------------------------------------------------------------

  const filteredTasks = useMemo(() => {
    switch (filter) {
      case 'today':
        return tasks.filter((t) => t.dueAt && isToday(t.dueAt));
      case 'this-week':
        return tasks.filter((t) => t.dueAt && isThisWeek(t.dueAt));
      case 'delegated':
        // Placeholder: in future, filter by assigned-to !== current user
        return tasks.filter((t) => t.status === 'in_progress');
      default:
        return tasks;
    }
  }, [tasks, filter]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="tasks-tab tasks-tab--loading" aria-busy="true">
        <SkeletonCard height={40} />
        <SkeletonCard height={72} />
        <SkeletonCard height={72} />
        <SkeletonCard height={72} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="tasks-tab tasks-tab--error" role="alert">
        <div className="tasks-tab__error-banner">
          <p>{error}</p>
          <button type="button" className="tasks-tab__retry-btn" onClick={fetchData}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const filters: { id: TaskFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'today', label: 'Today' },
    { id: 'this-week', label: 'This Week' },
    { id: 'delegated', label: 'Delegated' },
  ];

  const emptyContent = emptyStateContent[filter];

  return (
    <div className="tasks-tab">
      {/* Header */}
      <header className="tasks-tab__header">
        <h1 className="tasks-tab__title">Tasks</h1>
      </header>

      {/* Filter Pills */}
      <div className="tasks-tab__filters">
        {filters.map((f) => (
          <button
            key={f.id}
            ref={(el) => { filterRefs.current[f.id] = el; }}
            type="button"
            className={`tasks-tab__filter-pill ${filter === f.id ? 'tasks-tab__filter-pill--active' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
        <span
          className="tasks-tab__filter-indicator"
          style={{ left: indicatorStyle.left, width: indicatorStyle.width }}
        />
      </div>

      {/* Task List */}
      <section className="tasks-tab__list-section">
        {filteredTasks.length === 0 ? (
          <div className="tasks-tab__empty-state">
            <p className="tasks-tab__empty-title">{emptyContent.title}</p>
            <p className="tasks-tab__empty-desc">{emptyContent.desc}</p>
          </div>
        ) : (
          <ul className="tasks-tab__task-list">
            {filteredTasks.map((task) => (
              <li key={task.id} className="tasks-tab__task-card" data-priority={task.priority}>
                <div className="tasks-tab__task-header">
                  <span className="tasks-tab__task-title">{task.title}</span>
                  <span className="tasks-tab__priority-pill">{task.priority}</span>
                </div>
                <div className="tasks-tab__task-meta">
                  {task.dueAt && (
                    <span className="tasks-tab__due-date">
                      Due {new Date(task.dueAt).toLocaleDateString()}
                    </span>
                  )}
                  <span className={`tasks-tab__status tasks-tab__status--${task.status}`}>
                    {task.status.replace('_', ' ')}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Add Task Form */}
      {showAddForm && (
        <div className="tasks-tab__add-form">
          <input
            type="text"
            className="tasks-tab__add-input"
            placeholder="What needs to be done?"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newTaskTitle.trim()) {
                const newTask: DashboardTask = {
                  id: Date.now().toString(),
                  title: newTaskTitle.trim(),
                  priority: 'normal',
                  status: 'open',
                  dueAt: undefined,
                  createdAt: new Date().toISOString(),
                  organizationId: '',
                  createdBy: '',
                  updatedAt: new Date().toISOString(),
                  };
                setTasks((prev) => [newTask, ...prev]);
                setNewTaskTitle('');
                setShowAddForm(false);
              }
            }}
            autoFocus
          />
          <button
            type="button"
            className="tasks-tab__add-btn"
            disabled={!newTaskTitle.trim()}
            onClick={() => {
              if (!newTaskTitle.trim()) return;
              const newTask: DashboardTask = {
                id: Date.now().toString(),
                title: newTaskTitle.trim(),
                priority: 'normal',
                status: 'open',
                dueAt: undefined,
                createdAt: new Date().toISOString(),
                organizationId: '',
                createdBy: '',
                updatedAt: new Date().toISOString(),
              };
              setTasks((prev) => [newTask, ...prev]);
              setNewTaskTitle('');
              setShowAddForm(false);
            }}
          >
            Add
          </button>
        </div>
      )}

      {/* FAB */}
      <button
        type="button"
        className="tasks-tab__fab"
        aria-label="Add task"
        onClick={() => setShowAddForm(!showAddForm)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="24" height="24">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}