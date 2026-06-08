// ---------------------------------------------------------------------------
// TasksTab - Task management interface with CRUD operations.
// ---------------------------------------------------------------------------

import { useState, useEffect } from 'react';
import { getClient } from '../services/getClient';
import { showToast } from './Toast';

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
  const [formPriority, setFormPriority] = useState<TaskPriority>('normal');
  const [submitting, setSubmitting] = useState(false);

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
    setFormPriority('normal');
    setEditingTaskId(null);
  }

  function handleEditTask(task: Task) {
    setFormTitle(task.title);
    setFormDescription(task.description || '');
    setFormPriority(task.priority);
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
            priority: formPriority,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingTaskId)
          .select()
          .single();

        if (updateError) throw updateError;

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
              </li>
            ))}
          </ul>
        )}
      </section>

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
