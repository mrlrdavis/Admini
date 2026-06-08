// ---------------------------------------------------------------------------
// TasksTab - Native React implementation of the Tasks view
// ---------------------------------------------------------------------------
// Full task list with filtering, priority indicators, enhanced add form,
// smart date display, and Supabase persistence.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SkeletonCard } from '@admini/ui';
import { getTasks } from '../services/dashboardService';
import { getClient } from '../services/getClient';
import type { DashboardTask } from '../types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TasksTabProps {
  userId?: string;
  organizationId?: string;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TaskFilter = 'all' | 'today' | 'this-week' | 'delegated';
type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

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

/**
 * Smart date formatter:
 * - Today: "Today"
 * - Tomorrow: "Tomorrow"
 * - Within current Mon-Sun week: day name (e.g. "Wednesday")
 * - Otherwise: "Jun 15" style
 */
export function formatSmartDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();

  // Normalize to midnight for comparison
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (target.getTime() === today.getTime()) return 'Today';
  if (target.getTime() === tomorrow.getTime()) return 'Tomorrow';

  // Check if within current week (Mon-Sun)
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  if (target >= monday && target <= sunday) {
    return target.toLocaleDateString('en-US', { weekday: 'long' });
  }

  // Default: "Jun 15" style
  return target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

export function TasksTab({ userId, organizationId }: TasksTabProps) {
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [showAddForm, setShowAddForm] = useState(false);

  // Enhanced form state
  const [formTitle, setFormTitle] = useState('');
  const [formAssignedTo, setFormAssignedTo] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formPriority, setFormPriority] = useState<TaskPriority>('normal');
  const [submitting, setSubmitting] = useState(false);

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
  // Form helpers
  // -------------------------------------------------------------------------

  function resetForm() {
    setFormTitle('');
    setFormAssignedTo('');
    setFormNotes('');
    setFormDueDate('');
    setFormPriority('normal');
  }

  async function handleSubmitTask() {
    if (!formTitle.trim()) return;
    setSubmitting(true);

    const dueAt = formDueDate ? new Date(formDueDate + 'T00:00:00').toISOString() : undefined;

    // Attempt persistence to Supabase
    if (userId && organizationId) {
      try {
        const client = getClient();
        const insertPayload: Record<string, unknown> = {
          organization_id: organizationId,
          created_by: userId,
          title: formTitle.trim(),
          description: formNotes.trim() || null,
          priority: formPriority,
          status: 'open',
          due_at: dueAt || null,
          assigned_to: formAssignedTo.trim() || null,
        };

        const { data, error: insertError } = await client
          .from('tasks')
          .insert(insertPayload)
          .select()
          .single();

        if (insertError) throw insertError;

        // Map returned row into DashboardTask shape
        const newTask: DashboardTask = {
          id: data.id,
          organizationId: data.organization_id,
          createdBy: data.created_by,
          title: data.title,
          description: data.description ?? undefined,
          priority: data.priority,
          status: data.status,
          dueAt: data.due_at ?? undefined,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          assignedTo: data.assigned_to ?? undefined,
        };
        setTasks((prev) => [newTask, ...prev]);
      } catch {
        // Fall back to local-only on persistence failure
        const localTask: DashboardTask = {
          id: Date.now().toString(),
          title: formTitle.trim(),
          description: formNotes.trim() || undefined,
          priority: formPriority,
          status: 'open',
          dueAt: dueAt,
          createdAt: new Date().toISOString(),
          organizationId: organizationId,
          createdBy: userId,
          updatedAt: new Date().toISOString(),
          assignedTo: formAssignedTo.trim() || undefined,
        };
        setTasks((prev) => [localTask, ...prev]);
      }
    } else {
      // No auth context - local only
      const localTask: DashboardTask = {
        id: Date.now().toString(),
        title: formTitle.trim(),
        description: formNotes.trim() || undefined,
        priority: formPriority,
        status: 'open',
        dueAt: dueAt,
        createdAt: new Date().toISOString(),
        organizationId: organizationId ?? '',
        createdBy: userId ?? '',
        updatedAt: new Date().toISOString(),
        assignedTo: formAssignedTo.trim() || undefined,
      };
      setTasks((prev) => [localTask, ...prev]);
    }

    resetForm();
    setShowAddForm(false);
    setSubmitting(false);
  }

  // -------------------------------------------------------------------------
  // Task completion toggle
  // -------------------------------------------------------------------------

  async function handleToggleComplete(taskId: string) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const newStatus = task.status === 'completed' ? 'open' : 'completed';
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));

    try {
      const client = getClient();
      await client.from('tasks').update({ status: newStatus }).eq('id', taskId);
    } catch {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: task.status } : t));
    }
  }

  // -------------------------------------------------------------------------
  // Task edit handler
  // -------------------------------------------------------------------------

  function handleEditTask(task: DashboardTask) {
    setFormTitle(task.title);
    setFormAssignedTo(task.assignedTo || '');
    setFormNotes(task.description || '');
    setFormDueDate(task.dueAt ? task.dueAt.split('T')[0] ?? '' : '');
    setFormPriority((task.priority as TaskPriority) || 'normal');
    setShowAddForm(true);
  }

  // -------------------------------------------------------------------------
  // Expanded task state (for truncation toggle)
  // -------------------------------------------------------------------------

  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());

  function toggleTaskExpand(taskId: string) {
    setExpandedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }

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
        return tasks.filter((t) => Boolean(t.assignedTo));
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

  const priorities: { value: TaskPriority; label: string }[] = [
    { value: 'low', label: 'Low' },
    { value: 'normal', label: 'Normal' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
  ];

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
            {filteredTasks.map((task) => {
              const isExpanded = expandedTaskIds.has(task.id);
              const isTruncatable = task.title.length > 60 || !!task.description;
              return (
              <li key={task.id} className="tasks-tab__task-card" data-priority={task.priority} data-status={task.status}>
                <div className="tasks-tab__task-header">
                  <button
                    type="button"
                    className={`tasks-tab__checkbox ${task.status === 'completed' ? 'tasks-tab__checkbox--checked' : ''}`}
                    onClick={(e) => { e.stopPropagation(); handleToggleComplete(task.id); }}
                    aria-label={task.status === 'completed' ? 'Mark incomplete' : 'Mark complete'}
                  >
                    {task.status === 'completed' ? '\u2713' : ''}
                  </button>
                  <span className={`tasks-tab__task-title ${!isExpanded ? 'tasks-tab__task-title--truncated' : ''}`}>{task.title}</span>
                  <button
                    type="button"
                    className="tasks-tab__edit-btn"
                    onClick={(e) => { e.stopPropagation(); handleEditTask(task); }}
                    aria-label="Edit task"
                  >
                    &#9998;
                  </button>
                  <span className="tasks-tab__priority-pill">{task.priority}</span>
                </div>
                {isExpanded && task.description && (
                  <p className="tasks-tab__task-description">{task.description}</p>
                )}
                {isTruncatable && (
                  <button
                    type="button"
                    className="tasks-tab__expand-btn"
                    onClick={() => toggleTaskExpand(task.id)}
                  >
                    {isExpanded ? 'show less' : 'show more'}
                  </button>
                )}
                <div className="tasks-tab__task-meta">
                  {task.dueAt && (
                    <span className="tasks-tab__due-date">
                      Due {formatSmartDate(task.dueAt)}
                    </span>
                  )}
                  {task.assignedTo && (
                    <span className="tasks-tab__assigned-to">{task.assignedTo}</span>
                  )}
                  <span className={`tasks-tab__status tasks-tab__status--${task.status}`}>
                    {task.status.replace('_', ' ')}
                  </span>
                </div>
              </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Enhanced Add Task Form */}
      {showAddForm && (
        <div className="tasks-tab__add-form">
          <div className="tasks-tab__form-group">
            <label className="tasks-tab__form-label" htmlFor="task-title">Title *</label>
            <input
              id="task-title"
              type="text"
              className="tasks-tab__add-input"
              placeholder="What needs to be done?"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div className="tasks-tab__form-group">
            <label className="tasks-tab__form-label" htmlFor="task-assigned-to">Assigned to</label>
            <input
              id="task-assigned-to"
              type="text"
              className="tasks-tab__add-input"
              placeholder="Name or email"
              value={formAssignedTo}
              onChange={(e) => setFormAssignedTo(e.target.value)}
            />
          </div>

          <div className="tasks-tab__form-group">
            <label className="tasks-tab__form-label" htmlFor="task-notes">Notes</label>
            <textarea
              id="task-notes"
              className="tasks-tab__add-textarea"
              placeholder="Additional details..."
              rows={3}
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
            />
          </div>

          <div className="tasks-tab__form-group">
            <label className="tasks-tab__form-label" htmlFor="task-due-date">Due date</label>
            <input
              id="task-due-date"
              type="date"
              className="tasks-tab__add-input"
              value={formDueDate}
              onChange={(e) => setFormDueDate(e.target.value)}
            />
          </div>

          <div className="tasks-tab__form-group">
            <label className="tasks-tab__form-label">Priority</label>
            <div className="tasks-tab__priority-selector">
              {priorities.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  className={`tasks-tab__priority-btn ${formPriority === p.value ? 'tasks-tab__priority-btn--active' : ''}`}
                  data-priority={p.value}
                  onClick={() => setFormPriority(p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="tasks-tab__form-actions">
            <button
              type="button"
              className="tasks-tab__cancel-btn"
              onClick={() => { resetForm(); setShowAddForm(false); }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="tasks-tab__submit-btn"
              disabled={!formTitle.trim() || submitting}
              onClick={handleSubmitTask}
            >
              {submitting ? 'Saving...' : 'Add Task'}
            </button>
          </div>
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
