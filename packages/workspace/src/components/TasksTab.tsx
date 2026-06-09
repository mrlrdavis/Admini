// ---------------------------------------------------------------------------
// TasksTab - Task management interface with CRUD operations.
// ---------------------------------------------------------------------------

import { useState, useEffect, useMemo } from 'react';
import { getClient } from '../services/getClient';
import { showToast } from './Toast';
import { unlockBadge } from './BadgesPanel';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
type TaskStatus = 'open' | 'in_progress' | 'completed' | 'archived';

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueAt?: string;
  createdAt: string;
  updatedAt: string;
  assignedTo?: string;
  subtasks?: { id: string; title: string; completed: boolean }[];
}

// ---------------------------------------------------------------------------
// Subtask localStorage helpers
// ---------------------------------------------------------------------------

function saveSubtasks(taskId: string, subtasks: { id: string; title: string; completed: boolean }[]) {
  localStorage.setItem('admini_subtasks_' + taskId, JSON.stringify(subtasks));
}

function loadSubtasks(taskId: string): { id: string; title: string; completed: boolean }[] {
  try {
    const raw = localStorage.getItem('admini_subtasks_' + taskId);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface TasksTabProps {
  userId?: string;
  organizationId?: string;
}

export function TasksTab({ userId, organizationId }: TasksTabProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | TaskStatus>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAssignedTo, setFormAssignedTo] = useState('');
  const [formDueAt, setFormDueAt] = useState('');
  const [formPriority, setFormPriority] = useState<TaskPriority>('normal');
  const [formSubtasks, setFormSubtasks] = useState<{ id: string; title: string; completed: boolean }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // View mode state
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Monday start
    const days: Date[] = [];
    for (let i = -startDay; i < 42 - startDay; i++) {
      days.push(new Date(year, month, 1 + i));
    }
    return days;
  }, [calendarMonth]);

  // -------------------------------------------------------------------------
  // Load tasks
  // -------------------------------------------------------------------------

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
    setLoading(true);
    setError(null);
    try {
      const client = getClient();
      const { data, error: queryError } = await client
        .from('tasks')
        .select('*')
        .neq('status', 'archived')
        .order('created_at', { ascending: false });

      if (queryError) {
        setError(queryError.message);
        return;
      }

      setTasks(
        (data ?? []).map((row: any) => ({
          id: row.id,
          title: row.title,
          description: row.description ?? undefined,
          priority: row.priority ?? 'normal',
          status: row.status ?? 'open',
          dueAt: row.due_at ?? undefined,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          assignedTo: row.assigned_to ?? undefined,
        }))
      );
    } catch (err: any) {
      setError(err.message || 'Could not connect to database');
    } finally {
      setLoading(false);
    }
  }

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  function resetForm() {
    setFormTitle('');
    setFormDescription('');
    setFormAssignedTo('');
    setFormDueAt('');
    setFormPriority('normal');
    setFormSubtasks([]);
    setEditingTaskId(null);
  }

  function handleEditTask(task: Task) {
    setFormTitle(task.title);
    setFormDescription(task.description || '');
    setFormAssignedTo(task.assignedTo || '');
    setFormDueAt(task.dueAt ? task.dueAt.split('T')[0] ?? '' : '');
    setFormPriority(task.priority);
    setFormSubtasks(loadSubtasks(task.id));
    setEditingTaskId(task.id);
    setShowAddForm(true);
  }

  async function handleSubmitTask() {
    if (!formTitle.trim() || submitting) return;
    setSubmitting(true);

    try {
      const client = getClient();

      if (editingTaskId) {
        // Update existing task
        const { data, error: updateError } = await client
          .from('tasks')
          .update({
            title: formTitle.trim(),
            description: formDescription.trim() || null,
            assigned_to: formAssignedTo.trim() || null,
            due_at: formDueAt || null,
            priority: formPriority,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingTaskId)
          .select()
          .single();

        if (updateError) throw updateError;

        // Save subtasks to localStorage
        saveSubtasks(editingTaskId, formSubtasks);

        setTasks(prev =>
          prev.map(t =>
            t.id === editingTaskId
              ? {
                  ...t,
                  title: data.title,
                  description: data.description ?? undefined,
                  priority: data.priority,
                  updatedAt: data.updated_at,
                }
              : t
          )
        );
      } else {
        // Create new task
        const insertPayload: Record<string, unknown> = {
          title: formTitle.trim(),
          description: formDescription.trim() || null,
          assigned_to: formAssignedTo.trim() || null,
          due_at: formDueAt || null,
          priority: formPriority,
          status: 'open',
        };
        if (userId) insertPayload.created_by = userId;
        if (organizationId) insertPayload.organization_id = organizationId;

        const { data, error: insertError } = await client
          .from('tasks')
          .insert(insertPayload)
          .select()
          .single();

        if (insertError) throw insertError;

        // Save subtasks to localStorage
        if (formSubtasks.length > 0) {
          saveSubtasks(data.id, formSubtasks);
        }

        const newTask: Task = {
          id: data.id,
          title: data.title,
          description: data.description ?? undefined,
          priority: data.priority ?? 'normal',
          status: data.status ?? 'open',
          dueAt: data.due_at ?? undefined,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          assignedTo: data.assigned_to ?? undefined,
        };
        setTasks(prev => [newTask, ...prev]);
        // Check badges
        unlockBadge('first-task');
      }

      resetForm();
      setShowAddForm(false);
    } catch {
      // Silent - form stays open for retry
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleComplete(taskId: string) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newStatus: TaskStatus = task.status === 'completed' ? 'open' : 'completed';
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));

    if (newStatus === 'completed') {
      // Check completion badges
      const completedCount = tasks.filter(t => t.status === 'completed').length + 1;
      if (completedCount >= 5) unlockBadge('five-tasks');
      if (completedCount >= 10) unlockBadge('ten-tasks');
      if (completedCount >= 25) unlockBadge('twenty-five');
      showToast('Task completed', {
        action: { label: 'Undo', onClick: () => handleToggleComplete(taskId) },
      });
    }

    try {
      const client = getClient();
      await client
        .from('tasks')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', taskId);
    } catch {
      // Revert on error
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: task.status } : t));
    }
  }

  async function handleStatusChange(taskId: string, status: string) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: status as TaskStatus } : t));
    try {
      const client = getClient();
      await client.from('tasks').update({ status, updated_at: new Date().toISOString() }).eq('id', taskId);
    } catch {
      // silent
    }
  }

  async function handleDeleteTask(taskId: string) {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    resetForm();
    setShowAddForm(false);
    showToast('Task deleted');
    try {
      const client = getClient();
      await client.from('tasks').delete().eq('id', taskId);
    } catch {
      // Already removed from UI - silent
    }
  }

  // -------------------------------------------------------------------------
  // Filtering
  // -------------------------------------------------------------------------

  const filteredTasks = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);

  // -------------------------------------------------------------------------
  // Render - Loading
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="tasks-tab tasks-tab--loading" aria-busy="true">
        <p>Loading tasks...</p>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render - Error
  // -------------------------------------------------------------------------

  if (error) {
    return (
      <div className="tasks-tab tasks-tab--error">
        <div className="tasks-tab__error-banner">
          <p>{error}</p>
          <button type="button" className="tasks-tab__retry-btn" onClick={loadTasks}>
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
    <div className="tasks-tab">
      {/* Header */}
      <header className="tasks-tab__header">
        <h1 className="tasks-tab__title">Tasks</h1>
      </header>

      {/* Filters */}
      <div className="tasks-tab__filters">
        {(['all', 'open', 'in_progress', 'completed'] as const).map(f => (
          <button
            key={f}
            type="button"
            className={`tasks-tab__filter-pill${filter === f ? ' tasks-tab__filter-pill--active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : f === 'in_progress' ? 'In Progress' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* View Toggle */}
      <div className="tasks-tab__view-toggle">
        <button type="button" className={'tasks-tab__view-btn' + (viewMode === 'list' ? ' tasks-tab__view-btn--active' : '')} onClick={() => setViewMode('list')}>List</button>
        <button type="button" className={'tasks-tab__view-btn' + (viewMode === 'calendar' ? ' tasks-tab__view-btn--active' : '')} onClick={() => setViewMode('calendar')}>Calendar</button>
      </div>

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div className="tasks-tab__calendar">
          <div className="tasks-tab__calendar-header">
            <button type="button" onClick={() => setCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))}>{'\u2190'}</button>
            <span>{calendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
            <button type="button" onClick={() => setCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))}>{'\u2192'}</button>
          </div>
          <div className="tasks-tab__calendar-grid">
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => <span key={d} className="tasks-tab__calendar-day-label">{d}</span>)}
            {calendarDays.map((day, i) => {
              const dayTasks = tasks.filter(t => t.dueAt && new Date(t.dueAt).toDateString() === day.toDateString());
              const isToday = day.toDateString() === new Date().toDateString();
              const isCurrentMonth = day.getMonth() === calendarMonth.getMonth();
              return (
                <div key={i} className={'tasks-tab__calendar-cell' + (isToday ? ' tasks-tab__calendar-cell--today' : '') + (dayTasks.length > 0 ? ' tasks-tab__calendar-cell--has-tasks' : '') + (!isCurrentMonth ? ' tasks-tab__calendar-cell--other-month' : '')}>
                  <span className="tasks-tab__calendar-date">{day.getDate()}</span>
                  {dayTasks.length > 0 && (
                    <ul className="tasks-tab__calendar-task-list">
                      {dayTasks.map(t => (
                        <li key={t.id}>
                          <button
                            type="button"
                            className="tasks-tab__calendar-task-btn"
                            data-priority={t.priority}
                            onClick={() => handleEditTask(t)}
                            aria-label={`Open task: ${t.title}`}
                          >
                            <span className="tasks-tab__calendar-task-title">{t.title}</span>
                            {(() => {
                              const st = loadSubtasks(t.id);
                              if (st.length === 0) return null;
                              const done = st.filter(s => s.completed).length;
                              return <span className="tasks-tab__calendar-task-subtasks">{done}/{st.length}</span>;
                            })()}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Task Form */}
      {showAddForm && (
        <div className="tasks-tab__add-form">
          <div className="tasks-tab__form-group">
            <label className="tasks-tab__form-label" htmlFor="task-title">Title</label>
            <input
              id="task-title"
              className="tasks-tab__add-input"
              type="text"
              placeholder="Task title..."
              value={formTitle}
              onChange={e => setFormTitle(e.target.value)}
            />
          </div>

          <div className="tasks-tab__form-group">
            <label className="tasks-tab__form-label" htmlFor="task-desc">Description</label>
            <textarea
              id="task-desc"
              className="tasks-tab__add-textarea"
              placeholder="Optional description..."
              value={formDescription}
              onChange={e => setFormDescription(e.target.value)}
            />
          </div>

          <div className="tasks-tab__form-group">
            <label className="tasks-tab__form-label" htmlFor="task-assigned">Assign To</label>
            <input
              id="task-assigned"
              className="tasks-tab__add-input"
              type="text"
              placeholder="Name or email"
              value={formAssignedTo}
              onChange={e => setFormAssignedTo(e.target.value)}
            />
          </div>

          <div className="tasks-tab__form-group">
            <label className="tasks-tab__form-label" htmlFor="task-due">Due Date</label>
            <input
              id="task-due"
              className="tasks-tab__add-input"
              type="date"
              value={formDueAt}
              onChange={e => setFormDueAt(e.target.value)}
            />
          </div>

          <div className="tasks-tab__form-group">
            <label className="tasks-tab__form-label">Priority</label>
            <div className="tasks-tab__priority-selector">
              {(['low', 'normal', 'high', 'urgent'] as const).map(p => (
                <button
                  key={p}
                  type="button"
                  className={`tasks-tab__priority-btn${formPriority === p ? ' tasks-tab__priority-btn--active' : ''}`}
                  data-priority={p}
                  onClick={() => setFormPriority(p)}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Subtasks */}
          <div className="tasks-tab__form-group">
            <label className="tasks-tab__form-label">Subtasks</label>
            <div className="tasks-tab__subtasks-list">
              {formSubtasks.map((st, idx) => (
                <div key={st.id} className="tasks-tab__subtask-row">
                  <input
                    type="checkbox"
                    checked={st.completed}
                    onChange={() => setFormSubtasks(prev => prev.map((s, i) => i === idx ? { ...s, completed: !s.completed } : s))}
                  />
                  <input
                    type="text"
                    className="tasks-tab__subtask-input"
                    value={st.title}
                    onChange={(e) => setFormSubtasks(prev => prev.map((s, i) => i === idx ? { ...s, title: e.target.value } : s))}
                    placeholder="Subtask..."
                  />
                  <button type="button" className="tasks-tab__subtask-remove" onClick={() => setFormSubtasks(prev => prev.filter((_, i) => i !== idx))}>{'\u00D7'}</button>
                </div>
              ))}
              <button type="button" className="tasks-tab__subtask-add" onClick={() => setFormSubtasks(prev => [...prev, { id: Date.now().toString(), title: '', completed: false }])}>
                + Add subtask
              </button>
            </div>
          </div>

          <div className="tasks-tab__form-actions">
            {editingTaskId && (
              <button
                type="button"
                className="tasks-tab__delete-btn"
                onClick={() => handleDeleteTask(editingTaskId)}
              >
                Delete
              </button>
            )}
            <button type="button" className="tasks-tab__cancel-btn" onClick={() => { resetForm(); setShowAddForm(false); }}>
              Cancel
            </button>
            <button type="button" className="tasks-tab__submit-btn" disabled={!formTitle.trim() || submitting} onClick={handleSubmitTask}>
              {submitting ? 'Saving...' : editingTaskId ? 'Update' : 'Add Task'}
            </button>
          </div>
        </div>
      )}

      {/* Task List */}
      {viewMode === 'list' && (
        <section className="tasks-tab__list-section">
          {filteredTasks.length === 0 && !showAddForm ? (
            <div className="tasks-tab__empty-state">
              <h2 className="tasks-tab__empty-title">No tasks yet</h2>
              <p className="tasks-tab__empty-desc">Tasks you create or are assigned will appear here.</p>
            </div>
          ) : (
            <ul className="tasks-tab__task-list">
              {filteredTasks.map(task => (
                <li
                  key={task.id}
                  className="tasks-tab__task-card"
                  data-priority={task.priority}
                  data-status={task.status}
                >
                  <div className="tasks-tab__task-header">
                    <span className="tasks-tab__task-title">{task.title}</span>
                    <span className="tasks-tab__priority-pill">{task.priority}</span>
                    <div className="tasks-tab__task-actions">
                      <button
                        type="button"
                        className="tasks-tab__menu-trigger"
                        onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === task.id ? null : task.id); }}
                        aria-label="Task actions"
                      >
                        &#x22EE;
                      </button>
                      {menuOpenId === task.id && (
                        <div className="tasks-tab__menu-dropdown">
                          <button type="button" onClick={() => { handleToggleComplete(task.id); setMenuOpenId(null); }}>
                            {task.status === 'completed' ? 'Mark Incomplete' : 'Mark Complete'}
                          </button>
                          <button type="button" onClick={() => { handleStatusChange(task.id, 'archived'); setMenuOpenId(null); }}>
                            Mark Blocked
                          </button>
                          <button type="button" onClick={() => { handleEditTask(task); setMenuOpenId(null); }}>
                            Edit
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  {task.description && (
                    <p className="tasks-tab__task-description">{task.description}</p>
                  )}
                  <div className="tasks-tab__task-meta">
                    <span className={`tasks-tab__status tasks-tab__status--${task.status}`}>
                      {task.status.replace('_', ' ')}
                    </span>
                    {task.dueAt && (
                      <span className="tasks-tab__due-date">
                        Due {new Date(task.dueAt).toLocaleDateString()}
                      </span>
                    )}
                    {task.assignedTo && (
                      <span className="tasks-tab__assigned-to">{task.assignedTo}</span>
                    )}
                  </div>
                  {(() => {
                    const st = loadSubtasks(task.id);
                    if (st.length === 0) return null;
                    const done = st.filter(s => s.completed).length;
                    return (
                      <div className="tasks-tab__subtask-preview">
                        <span className="tasks-tab__subtask-count">{done}/{st.length} subtasks</span>
                        <ul className="tasks-tab__subtask-preview-list">
                          {st.slice(0, 4).map(s => (
                            <li key={s.id} className={'tasks-tab__subtask-preview-item' + (s.completed ? ' tasks-tab__subtask-preview-item--done' : '')}>
                              <span className="tasks-tab__subtask-check">{s.completed ? '\u2713' : '\u25CB'}</span>
                              <span>{s.title}</span>
                            </li>
                          ))}
                          {st.length > 4 && <li className="tasks-tab__subtask-preview-more">+{st.length - 4} more</li>}
                        </ul>
                      </div>
                    );
                  })()}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* FAB */}
      {!showAddForm && (
        <button
          type="button"
          className="tasks-tab__fab"
          onClick={() => { resetForm(); setShowAddForm(true); }}
          aria-label="Add task"
        >
          +
        </button>
      )}
    </div>
  );
}
