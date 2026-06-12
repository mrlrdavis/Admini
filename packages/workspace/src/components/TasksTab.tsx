// ---------------------------------------------------------------------------
// TasksTab - Task management interface with CRUD operations.
// ---------------------------------------------------------------------------
// Wired to:
//   - dashboardService.getTasks() for task loading
//   - mergeEvents (calendarMerge) for combining Google + local events
//   - duplicateTask (taskDuplication) for duplicate action
//   - parseLocalDate (@admini/shared) for overdue filtering
//   - getLocalEvents / createLocalEvent (localEventService) for local events
//   - defaultRegistry (@admini/shared) for CategoryRegistry
// Sub-components: TaskFilterBar, TaskCard, CalendarView, OverdueList

import { useState, useEffect, useMemo, useCallback } from 'react';
import { parseLocalDate, defaultRegistry } from '@admini/shared';
import { getTasks } from '../services/dashboardService';
import { mergeEvents } from '../services/calendarMerge';
import { duplicateTask } from '../services/taskDuplication';
import { getLocalEvents, createLocalEvent } from '../services/localEventService';
import { getCalendarEvents } from '../services/googleIntegrationService';
import { getClient } from '../services/getClient';
import { showToast } from './Toast';
import { unlockBadge } from './BadgesPanel';
import { TaskFilterBar, type FilterType } from './TaskFilterBar';
import { TaskCard } from './TaskCard';
import { CalendarView } from './CalendarView';
import { OverdueList } from './OverdueList';
import type { TaskWithSubtasks } from './TaskSection';
import type { DashboardTask } from '../types';
import type { MergedEvent } from '../services/calendarMerge';
import type { TaskService } from '../services/taskDuplication';

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
// TaskService adapter (bridges DashboardTask persistence for duplicateTask)
// ---------------------------------------------------------------------------

function createTaskServiceAdapter(
  userId?: string,
  organizationId?: string,
): TaskService {
  return {
    async create(task: TaskWithSubtasks): Promise<TaskWithSubtasks> {
      const client = getClient();
      const insertPayload: Record<string, unknown> = {
        title: task.title,
        description: task.description || null,
        assigned_to: task.assignee || null,
        due_at: task.dueAt || null,
        priority: task.priority,
        status: 'open',
      };
      if (userId) insertPayload.created_by = userId;
      if (organizationId) insertPayload.organization_id = organizationId;

      const { data, error } = await client
        .from('tasks')
        .insert(insertPayload)
        .select()
        .single();

      if (error) throw error;

      // Save subtasks
      if (task.subtasks.length > 0) {
        saveSubtasks(data.id, task.subtasks);
      }

      return {
        ...task,
        id: data.id,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a DashboardTask into a TaskWithSubtasks for use with TaskCard */
function toTaskWithSubtasks(task: DashboardTask): TaskWithSubtasks {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    dueAt: task.dueAt,
    assignee: task.assignedTo,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    subtasks: loadSubtasks(task.id),
  };
}

/** Map FilterType values to DashboardTask status values */
function filterToStatus(filter: FilterType): string | null {
  switch (filter) {
    case 'all': return null;
    case 'open': return 'open';
    case 'in-progress': return 'in_progress';
    case 'completed': return 'completed';
    case 'blocked': return 'archived';
    default: return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface TasksTabProps {
  userId?: string;
  organizationId?: string;
}

export function TasksTab({ userId, organizationId }: TasksTabProps) {
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());

  // Calendar event state
  const [mergedEvents, setMergedEvents] = useState<MergedEvent[]>([]);

  // Task service adapter for duplicateTask
  const taskService = useMemo(
    () => createTaskServiceAdapter(userId, organizationId),
    [userId, organizationId],
  );

  // -------------------------------------------------------------------------
  // Load tasks via dashboardService
  // -------------------------------------------------------------------------

  const loadTaskList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTasks();
      setTasks(data);
    } catch (err: any) {
      setError(err.message || 'Could not load tasks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTaskList();
  }, [loadTaskList]);

  // -------------------------------------------------------------------------
  // Load and merge calendar events
  // -------------------------------------------------------------------------

  const loadCalendarEvents = useCallback(async () => {
    try {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      let googleEvents: any[] = [];
      try {
        googleEvents = await getCalendarEvents(start, end);
      } catch {
        // Google auth may not be available
      }
      const localEvents = getLocalEvents();
      const merged = mergeEvents(googleEvents, localEvents);
      setMergedEvents(merged);
    } catch {
      // Fallback: local events only
      const localEvents = getLocalEvents();
      const merged = mergeEvents([], localEvents);
      setMergedEvents(merged);
    }
  }, []);

  useEffect(() => {
    loadCalendarEvents();
  }, [loadCalendarEvents]);

  // -------------------------------------------------------------------------
  // Filtering
  // -------------------------------------------------------------------------

  const filteredTasks = useMemo(() => {
    const statusFilter = filterToStatus(activeFilter);
    if (!statusFilter) return tasks;
    return tasks.filter(t => t.status === statusFilter);
  }, [tasks, activeFilter]);

  // -------------------------------------------------------------------------
  // Overdue tasks: parseLocalDate(t.dueAt) < today && status !== 'completed'
  // -------------------------------------------------------------------------

  const overdueTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return tasks.filter(
      t => t.dueAt && t.status !== 'completed' && parseLocalDate(t.dueAt) < today,
    );
  }, [tasks]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  function handleFilterChange(filter: string) {
    setActiveFilter(filter as FilterType);
  }

  function handleViewToggle() {
    setViewMode(prev => (prev === 'list' ? 'calendar' : 'list'));
  }

  function handleToggleExpand(taskId: string) {
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

  async function handleDuplicate(task: DashboardTask) {
    try {
      const taskWithSubs = toTaskWithSubtasks(task);
      await duplicateTask(taskWithSubs, taskService);
      // Refresh the task list to show the new task
      await loadTaskList();
      showToast('Task duplicated');
    } catch {
      showToast('Failed to duplicate task');
    }
  }

  async function handleStatusChange(taskId: string, status: string) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Block completion if subtasks aren't all done
    if (status === 'completed') {
      const st = loadSubtasks(taskId);
      const incomplete = st.filter(s => !s.completed);
      if (incomplete.length > 0) {
        showToast(`Complete all subtasks first (${incomplete.length} remaining)`);
        return;
      }
    }

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: status as any } : t));

    if (status === 'completed') {
      const completedCount = tasks.filter(t => t.status === 'completed').length + 1;
      if (completedCount >= 5) unlockBadge('five-tasks');
      if (completedCount >= 10) unlockBadge('ten-tasks');
      if (completedCount >= 25) unlockBadge('twenty-five');
      showToast('Task completed');
    }

    try {
      const client = getClient();
      await client
        .from('tasks')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', taskId);
    } catch {
      // Revert on error
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: task.status } : t));
    }
  }

  function handleSubtaskToggle(taskId: string, subtaskId: string) {
    const st = loadSubtasks(taskId);
    const updated = st.map(s => s.id === subtaskId ? { ...s, completed: !s.completed } : s);
    saveSubtasks(taskId, updated);
    // Force re-render by touching updatedAt
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, updatedAt: new Date().toISOString() } : t));
  }

  function handleAddEvent(date: string, time?: string) {
    const summary = prompt('Event name:');
    if (!summary) return;
    const start = time ? `${date}T${time}` : `${date}T09:00:00`;
    const end = time ? `${date}T${time}` : `${date}T10:00:00`;
    createLocalEvent({ summary, start, end });
    // Refresh merged events
    loadCalendarEvents();
  }

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
          <button type="button" className="tasks-tab__retry-btn" onClick={loadTaskList}>
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

      {/* TaskFilterBar sub-component */}
      <TaskFilterBar
        activeFilter={activeFilter}
        onFilterChange={handleFilterChange}
        activeView={viewMode}
        onViewToggle={handleViewToggle}
      />

      {/* Calendar View with merged events */}
      {viewMode === 'calendar' && (
        <div className="tasks-tab__calendar-layout">
          <CalendarView
            mergedEvents={mergedEvents}
            tasks={filteredTasks}
            onAddEvent={handleAddEvent}
          />
          {/* Overdue sidebar */}
          <OverdueList tasks={overdueTasks} />
        </div>
      )}

      {/* Task List (TaskCard sub-components) */}
      {viewMode === 'list' && (
        <section className="tasks-tab__list-section">
          {/* Overdue banner */}
          {overdueTasks.length > 0 && (
            <OverdueList tasks={overdueTasks} />
          )}

          {filteredTasks.length === 0 ? (
            <div className="tasks-tab__empty-state">
              <h2 className="tasks-tab__empty-title">No tasks yet</h2>
              <p className="tasks-tab__empty-desc">Tasks you create or are assigned will appear here.</p>
            </div>
          ) : (
            <ul className="tasks-tab__task-list" role="list">
              {filteredTasks.map(task => {
                const taskWithSubs = toTaskWithSubtasks(task);
                return (
                  <li key={task.id}>
                    <TaskCard
                      task={taskWithSubs}
                      registry={defaultRegistry}
                      isExpanded={expandedTaskIds.has(task.id)}
                      onToggleExpand={() => handleToggleExpand(task.id)}
                      onSubtaskToggle={(subtaskId) => handleSubtaskToggle(task.id, subtaskId)}
                      onDuplicate={() => handleDuplicate(task)}
                      onStatusChange={(status) => handleStatusChange(task.id, status)}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
