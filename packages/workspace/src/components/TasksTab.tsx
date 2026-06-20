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
import { listOrgMembers } from '../services/organizationService';
import { mergeEvents } from '../services/calendarMerge';
import { duplicateTask } from '../services/taskDuplication';
import { getLocalEvents, createLocalEvent } from '../services/localEventService';
import { getCalendarEvents } from '../services/googleIntegrationService';
import { getClient } from '../services/getClient';
import { showToast } from './Toast';
import { unlockBadge } from './BadgesPanel';
import { notifyAssignee } from '../services/notificationService';
import { TaskFilterBar, type FilterType } from './TaskFilterBar';
import { TaskCard } from './TaskCard';
import { CalendarView } from './CalendarView';
import { OverdueList } from './OverdueList';
import type { TaskWithSubtasks } from './TaskSection';
import type { DashboardTask, OrgMember } from '../types';
import type { MergedEvent } from '../services/calendarMerge';
import type { TaskService } from '../services/taskDuplication';

// ---------------------------------------------------------------------------
// Subtask database helpers
// ---------------------------------------------------------------------------

type SubtaskRow = { id: string; title: string; completed: boolean; assignee?: string; dueAt?: string; priority?: string; sortOrder?: number };

type DbSubtaskRow = {
  id: string;
  title: string;
  completed: boolean;
  due_at: string | null;
  assignee: string | null;
  priority: string | null;
  sort_order: number | null;
};

function mapSubtaskRow(row: DbSubtaskRow): SubtaskRow {
  return {
    id: row.id,
    title: row.title,
    completed: row.completed,
    assignee: row.assignee ?? undefined,
    dueAt: row.due_at ?? undefined,
    priority: row.priority ?? undefined,
    sortOrder: row.sort_order ?? undefined,
  };
}

async function fetchSubtasks(taskId: string): Promise<SubtaskRow[]> {
  try {
    const client = getClient();
    const { data, error } = await client
      .from('task_subtasks')
      .select('id, title, completed, due_at, assignee, priority, sort_order')
      .eq('task_id', taskId)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => mapSubtaskRow(row as DbSubtaskRow));
  } catch {
    // Fallback to localStorage for migration period
    try {
      const raw = localStorage.getItem('admini_subtasks_' + taskId);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }
}

function loadSubtasks(taskId: string): SubtaskRow[] {
  // Synchronous fallback for initial render - returns cached or empty
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
  resolveAssignee?: (assignee?: string) => string | undefined,
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

      // Save subtasks to database
      if (task.subtasks.length > 0) {
        const subtaskRows = task.subtasks.map((s, idx) => ({
          task_id: data.id,
          title: s.title,
          completed: s.completed || false,
          assignee: s.assignee || null,
          due_at: s.dueAt || null,
          priority: s.priority || null,
          sort_order: idx,
        }));
        await client.from('task_subtasks').insert(subtaskRows);

        for (const subtask of task.subtasks) {
          if (subtask.assignee) {
            notifyAssignee(data.id, resolveAssignee?.(subtask.assignee) ?? subtask.assignee, 'created', task.title + ': ' + subtask.title)
              .catch((err) => showToast(err instanceof Error ? err.message : 'Failed to notify subtask assignee'));
          }
        }
      }

      // Award badges
      unlockBadge('first-task');
      if (task.assignee) {
        unlockBadge('first-assign');
        // Best-effort assignee notification with real task title
        notifyAssignee(data.id, resolveAssignee?.(task.assignee) ?? task.assignee, 'created', task.title)
          .catch((err) => showToast(err instanceof Error ? err.message : 'Failed to notify assignee'));
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
function toTaskWithSubtasks(task: DashboardTask, subtasks?: SubtaskRow[]): TaskWithSubtasks {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    dueAt: task.dueAt,
    assignee: task.assignedTo,
    blockReason: task.blockReason,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    subtasks: subtasks ?? loadSubtasks(task.id),
  };
}

/** Map FilterType values to DashboardTask filtering logic.
 *  Returns { status, priority, dateFilter } for flexible filtering. */
interface TaskFilterCriteria {
  status: string | null;
  priority: string | null;
  dateFilter: 'due' | 'coming-due' | null;
}

function getFilterCriteria(filter: FilterType): TaskFilterCriteria {
  switch (filter) {
    case 'all': return { status: null, priority: null, dateFilter: null };
    case 'open': return { status: 'open', priority: null, dateFilter: null };
    case 'in-progress': return { status: 'in_progress', priority: null, dateFilter: null };
    case 'completed': return { status: 'completed', priority: null, dateFilter: null };
    case 'blocked': return { status: 'archived', priority: null, dateFilter: null };
    case 'due': return { status: null, priority: null, dateFilter: 'due' };
    case 'coming-due': return { status: null, priority: null, dateFilter: 'coming-due' };
    case 'high': return { status: null, priority: 'high', dateFilter: null };
    case 'normal': return { status: null, priority: 'normal', dateFilter: null };
    case 'low': return { status: null, priority: 'low', dateFilter: null };
    default: return { status: null, priority: null, dateFilter: null };
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface TasksTabProps {
  userId?: string;
  organizationId?: string;
  userRole?: string;
}

export function TasksTab({ userId, organizationId, userRole = 'staff' }: TasksTabProps) {
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [subtasksMap, setSubtasksMap] = useState<Record<string, SubtaskRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [filterDate, setFilterDate] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<'low'|'normal'|'high'|'urgent'>('normal');
  const [newDue, setNewDue] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newAssignee, setNewAssignee] = useState('');
  const [newSubtasks, setNewSubtasks] = useState<{title:string;assignee:string;dueAt:string}[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

  // Staff roster for assignee suggestions
  const [staffRoster, setStaffRoster] = useState<string[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);

  // Calendar event state
  const [mergedEvents, setMergedEvents] = useState<MergedEvent[]>([]);

  // Task service adapter for duplicateTask
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

  // Load real org members for assignee auto-suggest. The local roster is only
  // a fallback for older observation-only data.
  useEffect(() => {
    let cancelled = false;
    if (organizationId) {
      listOrgMembers(organizationId)
        .then((members) => {
          if (cancelled) return;
          setOrgMembers(members);
          setStaffRoster(Array.from(new Set(members.flatMap((member) => [
            member.displayName,
            member.email,
          ].filter(Boolean)))));
        })
        .catch(() => {});
    }

    try {
      const rosterRaw = localStorage.getItem('admini_roster_full');
      if (rosterRaw && !organizationId) {
        const roster = JSON.parse(rosterRaw) as { name: string; type: 'student' | 'staff' }[];
        // Filter to only staff (teachers, admin, principal)
        setStaffRoster(roster.filter(r => r.type === 'staff').map(r => r.name));
      }
    } catch {}
    return () => { cancelled = true; };
  }, [organizationId]);

  function resolveAssigneeMember(assignee?: string): OrgMember | undefined {
    const normalized = assignee?.trim().toLowerCase();
    if (!normalized) return undefined;
    return orgMembers.find((member) =>
      member.email.toLowerCase() === normalized
      || member.displayName.toLowerCase() === normalized
    );
  }

  function resolveAssigneeProfileId(assignee?: string): string | undefined {
    return resolveAssigneeMember(assignee)?.profileId;
  }

  function getAssigneeSaveValue(assignee?: string): string | undefined {
    const trimmed = assignee?.trim();
    if (!trimmed) return undefined;
    const member = resolveAssigneeMember(trimmed);
    return member?.displayName || trimmed;
  }

  function notifySubtaskAssignee(taskId: string, taskTitle: string, subtaskTitle: string, assignee?: string, action: 'created' | 'updated' = 'updated'): void {
    if (!assignee) return;
    const assigneeMember = resolveAssigneeMember(assignee);
    notifyAssignee(taskId, assigneeMember?.profileId ?? assignee, action, taskTitle + ': ' + subtaskTitle)
      .catch((err) => showToast(err instanceof Error ? err.message : 'Failed to notify subtask assignee'));
  }

  function canEditTask(task: DashboardTask): boolean {
    return userRole === 'admin' || userRole === 'principal' || task.createdBy === userId;
  }

  const taskService = useMemo(
    () => createTaskServiceAdapter(userId, organizationId, resolveAssigneeProfileId),
    [userId, organizationId, orgMembers],
  );

  async function loadSubtasksForTask(taskId: string): Promise<SubtaskRow[]> {
    const subtasks = await fetchSubtasks(taskId);
    setSubtasksMap((current) => ({ ...current, [taskId]: subtasks }));
    return subtasks;
  }

  // Auto-expand a specific task when navigated from dashboard
  useEffect(() => {
    const target = localStorage.getItem('admini_expand_task');
    if (target) {
      localStorage.removeItem('admini_expand_task');
      setExpandedTaskIds(new Set([target]));
      loadSubtasksForTask(target).catch(() => undefined);
    }
  }, []);

  // Apply filter from dashboard navigation
  useEffect(() => {
    const savedFilter = localStorage.getItem('admini_task_filter');
    if (savedFilter) {
      localStorage.removeItem('admini_task_filter');
      setActiveFilter(savedFilter as FilterType);
    }
    const savedDate = localStorage.getItem('admini_task_filter_date');
    if (savedDate) {
      localStorage.removeItem('admini_task_filter_date');
      setFilterDate(savedDate);
    }
    const savedView = localStorage.getItem('admini_tasks_view');
    if (savedView) {
      localStorage.removeItem('admini_tasks_view');
      if (savedView === 'calendar') setViewMode('calendar');
    }
  }, []);

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
    const criteria = getFilterCriteria(activeFilter);
    let result = tasks;
    if (criteria.status) {
      result = result.filter(t => t.status === criteria.status);
    }
    if (criteria.priority) {
      const priorityValues = criteria.priority === 'high' ? ['high', 'urgent'] : [criteria.priority];
      result = result.filter(t => priorityValues.includes(t.priority));
    }
    if (criteria.dateFilter === 'due') {
      const targetStr = filterDate ? new Date(filterDate).toDateString() : new Date().toDateString();
      result = result.filter(t => t.status !== 'completed' && t.dueAt && parseLocalDate(t.dueAt).toDateString() === targetStr);
    } else if (criteria.dateFilter === 'coming-due') {
      const now = new Date();
      const in7 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
      result = result.filter(t => {
        if (t.status === 'completed' || !t.dueAt) return false;
        const due = parseLocalDate(t.dueAt);
        return due > now && due <= in7;
      });
    }
    return result;
  }, [tasks, activeFilter, filterDate]);

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
    const shouldLoad = !expandedTaskIds.has(taskId) && !subtasksMap[taskId];
    setExpandedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
    if (shouldLoad) {
      loadSubtasksForTask(taskId).catch(() => undefined);
    }
  }

  async function handleDuplicate(task: DashboardTask) {
    if (!canEditTask(task)) {
      showToast('Only task creators, admins, and principals can duplicate this task');
      return;
    }
    try {
      const taskWithSubs = toTaskWithSubtasks(task, subtasksMap[task.id]);
      await duplicateTask(taskWithSubs, taskService);
      // Refresh the task list to show the new task
      await loadTaskList();
      showToast('Task duplicated');
    } catch {
      showToast('Failed to duplicate task');
    }
  }

  async function handleCreateTask() {
    if (!newTitle.trim()) return;
    try {
      await taskService.create({
        id: '', title: newTitle.trim(), description: newDescription.trim() || undefined, priority: newPriority,
        status: 'open', dueAt: newDue || undefined, assignee: getAssigneeSaveValue(newAssignee),
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        subtasks: newSubtasks.filter(s => s.title.trim()).map(s => ({ id: crypto.randomUUID(), title: s.title.trim(), assignee: getAssigneeSaveValue(s.assignee), dueAt: s.dueAt || undefined, completed: false })),
      });
      setNewTitle(''); setNewPriority('normal'); setNewDue(''); setNewDescription(''); setNewAssignee(''); setNewSubtasks([]); setNewFiles([]); setShowAddForm(false);
      await loadTaskList();
      showToast('Task created');
    } catch { showToast('Failed to create task'); }
  }

  async function handleEditTask(taskId: string, updates: { title?: string; description?: string; dueAt?: string; priority?: string; assignee?: string; blockReason?: string }) {
    const task = tasks.find(t => t.id === taskId);
    const normalizedAssignee = updates.assignee !== undefined ? getAssigneeSaveValue(updates.assignee) : undefined;
    if (task && !canEditTask(task)) {
      showToast('Only task creators, admins, and principals can edit this task');
      return;
    }
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? {
      ...t,
      title: updates.title ?? t.title,
      description: updates.description ?? t.description,
      dueAt: updates.dueAt ?? t.dueAt,
      priority: (updates.priority as typeof t.priority) ?? t.priority,
      assignedTo: updates.assignee !== undefined ? normalizedAssignee : t.assignedTo,
      blockReason: updates.blockReason ?? t.blockReason,
    } : t));
    try {
      const client = getClient();
      const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.description !== undefined) payload.description = updates.description || null;
      if (updates.dueAt !== undefined) payload.due_at = updates.dueAt || null;
      if (updates.priority !== undefined) payload.priority = updates.priority;
      if (updates.assignee !== undefined) payload.assigned_to = normalizedAssignee || null;
      if (updates.blockReason !== undefined) payload.block_reason = updates.blockReason || null;
      await client.from('tasks').update(payload).eq('id', taskId);
      if (updates.assignee) {
        const assigneeMember = resolveAssigneeMember(updates.assignee);
        notifyAssignee(taskId, assigneeMember?.profileId ?? updates.assignee, 'updated', updates.title ?? task?.title)
          .catch((err) => showToast(err instanceof Error ? err.message : 'Failed to notify assignee'));
      }
      showToast('Task updated');
    } catch {
      showToast('Failed to update task');
      await loadTaskList();
    }
  }

  async function handleDeleteTask(taskId: string) {
    const task = tasks.find(t => t.id === taskId);
    if (task && !canEditTask(task)) {
      showToast('Only task creators, admins, and principals can delete this task');
      return;
    }
    const prev = tasks;
    setTasks(p => p.filter(t => t.id !== taskId));
    try {
      const client = getClient();
      await client.from('tasks').delete().eq('id', taskId);
      // Subtasks cascade-deleted from task_subtasks table
      showToast('Task deleted');
    } catch {
      showToast('Failed to delete task');
      setTasks(prev);
    }
  }

  async function handleStatusChange(taskId: string, status: string) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    if (!canEditTask(task)) {
      showToast('Only task creators, admins, and principals can change this task');
      return;
    }

    // Block completion if subtasks aren't all done
    if (status === 'completed') {
      let st: SubtaskRow[] = [];
      try {
        st = await fetchSubtasks(taskId);
      } catch {
        st = loadSubtasks(taskId);
      }
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
      if (completedCount >= 50) unlockBadge('fifty-tasks');
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

  async function handleSubtaskToggle(taskId: string, subtaskId: string) {
    const task = tasks.find(t => t.id === taskId);
    if (task && !canEditTask(task)) {
      showToast('Only task creators, admins, and principals can update subtasks');
      return;
    }
    // Optimistic update
    setSubtasksMap((current) => ({
      ...current,
      [taskId]: (current[taskId] ?? loadSubtasks(taskId)).map((subtask) =>
        subtask.id === subtaskId ? { ...subtask, completed: !subtask.completed } : subtask
      ),
    }));
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, updatedAt: new Date().toISOString() } : t));
    try {
      const client = getClient();
      const { data, error: readError } = await client.from('task_subtasks').select('completed').eq('id', subtaskId).single();
      if (readError) throw readError;
      const { error } = await client.from('task_subtasks').update({ completed: !(data?.completed) }).eq('id', subtaskId);
      if (error) throw error;
    } catch {
      // Fallback to localStorage
      const st = loadSubtasks(taskId);
      const updated = st.map(s => s.id === subtaskId ? { ...s, completed: !s.completed } : s);
      localStorage.setItem('admini_subtasks_' + taskId, JSON.stringify(updated));
      setSubtasksMap((current) => ({ ...current, [taskId]: updated }));
    }
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, updatedAt: new Date().toISOString() } : t));
  }

  async function handleSubtaskEdit(taskId: string, subtaskId: string, updates: { title?: string; assignee?: string; dueAt?: string; priority?: string }) {
    const task = tasks.find(t => t.id === taskId);
    if (task && !canEditTask(task)) {
      showToast('Only task creators, admins, and principals can edit subtasks');
      return;
    }
    const existingSubtask = (subtasksMap[taskId] ?? loadSubtasks(taskId)).find((subtask) => subtask.id === subtaskId);
    const normalizedUpdates = { ...updates };
    if (updates.assignee !== undefined) {
      normalizedUpdates.assignee = getAssigneeSaveValue(updates.assignee);
    }
    setSubtasksMap((current) => ({
      ...current,
      [taskId]: (current[taskId] ?? loadSubtasks(taskId)).map((subtask) =>
        subtask.id === subtaskId ? { ...subtask, ...normalizedUpdates } : subtask
      ),
    }));
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, updatedAt: new Date().toISOString() } : t));
    try {
      const client = getClient();
      const payload: Record<string, unknown> = {};
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.assignee !== undefined) payload.assignee = normalizedUpdates.assignee || null;
      if (updates.dueAt !== undefined) payload.due_at = updates.dueAt || null;
      if (updates.priority !== undefined) payload.priority = updates.priority || null;
      const { error } = await client.from('task_subtasks').update(payload).eq('id', subtaskId);
      if (error) throw error;
    } catch {
      // Fallback to localStorage
      const st = loadSubtasks(taskId);
      const updated = st.map(s => s.id === subtaskId ? { ...s, ...normalizedUpdates } : s);
      localStorage.setItem('admini_subtasks_' + taskId, JSON.stringify(updated));
      setSubtasksMap((current) => ({ ...current, [taskId]: updated }));
    }
    if (updates.assignee) {
      notifySubtaskAssignee(taskId, task?.title ?? 'Task', normalizedUpdates.title ?? existingSubtask?.title ?? 'Subtask', normalizedUpdates.assignee, 'updated');
    }
    showToast('Subtask updated');
  }

  async function handleSubtaskAdd(taskId: string, subtask: { title: string; assignee?: string; dueAt?: string; priority?: string }) {
    const task = tasks.find(t => t.id === taskId);
    if (task && !canEditTask(task)) {
      showToast('Only task creators, admins, and principals can add subtasks');
      return;
    }
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, updatedAt: new Date().toISOString() } : t));
    try {
      const client = getClient();
      const { data, error } = await client.from('task_subtasks').insert({
        task_id: taskId,
        title: subtask.title,
        completed: false,
        assignee: getAssigneeSaveValue(subtask.assignee) || null,
        due_at: subtask.dueAt || null,
        priority: subtask.priority || null,
        sort_order: 0,
      }).select('id, title, completed, due_at, assignee, priority, sort_order').single<DbSubtaskRow>();
      if (error) throw error;
      const inserted = data ? mapSubtaskRow(data) : undefined;
      if (inserted) {
        setSubtasksMap((current) => ({
          ...current,
          [taskId]: [...(current[taskId] ?? loadSubtasks(taskId)), inserted],
        }));
      }
    } catch {
      // Fallback to localStorage
      const st = loadSubtasks(taskId);
      const newSubtask = { id: crypto.randomUUID(), title: subtask.title, completed: false, assignee: getAssigneeSaveValue(subtask.assignee), dueAt: subtask.dueAt, priority: subtask.priority };
      const updated = [...st, newSubtask];
      localStorage.setItem('admini_subtasks_' + taskId, JSON.stringify(updated));
      setSubtasksMap((current) => ({ ...current, [taskId]: updated }));
    }
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, updatedAt: new Date().toISOString() } : t));
    if (subtask.assignee) {
      notifySubtaskAssignee(taskId, task?.title ?? 'Task', subtask.title, getAssigneeSaveValue(subtask.assignee), 'created');
    }
    showToast('Subtask added');
  }

  async function handleSubtaskDelete(taskId: string, subtaskId: string) {
    const task = tasks.find(t => t.id === taskId);
    if (task && !canEditTask(task)) {
      showToast('Only task creators, admins, and principals can delete subtasks');
      return;
    }
    const previousSubtasks = subtasksMap[taskId] ?? loadSubtasks(taskId);
    setSubtasksMap((current) => ({
      ...current,
      [taskId]: previousSubtasks.filter((subtask) => subtask.id !== subtaskId),
    }));
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, updatedAt: new Date().toISOString() } : t));
    try {
      const client = getClient();
      const { error } = await client.from('task_subtasks').delete().eq('id', subtaskId);
      if (error) throw error;
    } catch {
      // Fallback to localStorage
      const st = loadSubtasks(taskId);
      const updated = st.filter(s => s.id !== subtaskId);
      localStorage.setItem('admini_subtasks_' + taskId, JSON.stringify(updated));
      setSubtasksMap((current) => ({ ...current, [taskId]: updated }));
    }
    showToast('Subtask removed');
  }

  function handleTaskClickFromCalendar(taskId: string) {
    // Expand the task and switch to list view
    setExpandedTaskIds(new Set([taskId]));
    setViewMode('list');
    showToast('Showing task details');
  }

  function handleAddEvent(date: string, time?: string) {
    const summary = prompt('Event name:');
    if (!summary) return;
    const desc = prompt('Description (optional):') || '';
    const endTime = prompt('End time (HH:MM, optional):') || '';
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

  async function handleImportTasks() {
    if (!importFile) return;
    showToast('Importing tasks...');
    try {
      const text = await importFile.text();
      const lines = text.split('\n').filter(l => l.trim());
      let imported = 0;
      for (const line of lines) {
        const parts = line.split(',');
        const title = parts[0]?.trim();
        if (title) {
          await taskService.create({
            id: '', title, description: parts[1]?.trim() || undefined,
            priority: (parts[2]?.trim() as any) || 'normal', status: 'open',
            dueAt: parts[3]?.trim() || undefined, assignee: parts[4]?.trim() || undefined,
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), subtasks: []
          });
          imported++;
        }
      }
      showToast(imported + ' task(s) imported');
      setShowImport(false);
      setImportFile(null);
      await loadTaskList();
    } catch {
      showToast('Failed to import tasks');
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="tasks-tab">
      {/* Header */}
      <header className="tasks-tab__header">
        <h1 className="tasks-tab__title">Tasks</h1>
        <button type="button" className="tasks-tab__import-btn" onClick={() => setShowImport(v => !v)}>
          📥 Import Tasks
        </button>
      </header>

      {showImport && (
        <div className="tasks-tab__import-section">
          <p>Upload a CSV file with columns: title, description, priority, due date, assignee</p>
          <input type="file" accept=".txt,.csv" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
          <div className="tasks-tab__import-actions">
            <button type="button" onClick={handleImportTasks} disabled={!importFile}>Import</button>
            <button type="button" onClick={() => { setShowImport(false); setImportFile(null); }}>Cancel</button>
          </div>
        </div>
      )}
      {/* Add Task */}
      {showAddForm && (
        <div className="tasks-tab__add-form">
          <input className="tasks-tab__add-input" placeholder="Task title..." value={newTitle} onChange={(e) => setNewTitle(e.target.value)} autoFocus />
          <textarea className="tasks-tab__add-textarea" placeholder="Description (optional)" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
          <div className="tasks-tab__form-row">
            <input type="date" className="tasks-tab__add-input" value={newDue} onChange={(e) => setNewDue(e.target.value)} />
            <select className="tasks-tab__priority-btn" value={newPriority} onChange={(e) => setNewPriority(e.target.value as any)}>
              <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
            </select>
          </div>
          <input className="tasks-tab__add-input" placeholder="Assignee (email or name)" value={newAssignee} onChange={(e) => setNewAssignee(e.target.value)} list="assignee-suggestions" />
          {staffRoster.length > 0 && (
            <datalist id="assignee-suggestions">
              {staffRoster.map((name) => <option key={name} value={name} />)}
            </datalist>
          )}
          <div className="tasks-tab__subtasks-list">
            {newSubtasks.map((st, i) => (
              <div key={i} className="tasks-tab__subtask-row">
                <input className="tasks-tab__subtask-input" placeholder="Subtask title" value={st.title} onChange={(e) => setNewSubtasks(s => s.map((x, j) => j === i ? {...x, title: e.target.value} : x))} />
                <input className="tasks-tab__subtask-input" placeholder="Assignee" value={st.assignee} onChange={(e) => setNewSubtasks(s => s.map((x, j) => j === i ? {...x, assignee: e.target.value} : x))} style={{maxWidth:120}} list="assignee-suggestions" />
                <input type="date" className="tasks-tab__subtask-input" value={st.dueAt} onChange={(e) => setNewSubtasks(s => s.map((x, j) => j === i ? {...x, dueAt: e.target.value} : x))} style={{maxWidth:130}} />
                <button type="button" className="tasks-tab__subtask-remove" onClick={() => setNewSubtasks(s => s.filter((_x, j) => j !== i))}>X</button>
              </div>
            ))}
            <button type="button" className="tasks-tab__subtask-add" onClick={() => setNewSubtasks(s => [...s, {title:'',assignee:'',dueAt:''}])}>+ Add subtask</button>
          </div>
          <div className="tasks-tab__file-upload">
            <label className="tasks-tab__file-upload-btn">
              📎 Attach Files
              <input type="file" multiple style={{display:'none'}} onChange={(e) => { if (e.target.files) setNewFiles(prev => [...prev, ...Array.from(e.target.files!)]); }} />
            </label>
            {newFiles.length > 0 && (
              <ul className="tasks-tab__file-list">
                {newFiles.map((f, i) => (
                  <li key={i} className="tasks-tab__file-item">
                    <span>{f.name}</span>
                    <button type="button" onClick={() => setNewFiles(prev => prev.filter((_, j) => j !== i))} aria-label={'Remove ' + f.name}>×</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="tasks-tab__form-actions">
            <button type="button" className="tasks-tab__cancel-btn" onClick={() => setShowAddForm(false)}>Cancel</button>
            <button type="button" className="tasks-tab__submit-btn" onClick={handleCreateTask} disabled={!newTitle.trim()}>Create Task</button>
          </div>
        </div>
      )}
      {!showAddForm && (
        <button type="button" className="tasks-tab__fab" onClick={() => setShowAddForm(true)} aria-label="Create new task">+</button>
      )}

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
            onTaskClick={handleTaskClickFromCalendar}
            overdueSlot={<OverdueList tasks={overdueTasks} />}
          />
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
                const taskWithSubs = toTaskWithSubtasks(task, subtasksMap[task.id]);
                const editable = canEditTask(task);
                return (
                  <li key={task.id}>
                    <TaskCard
                      task={taskWithSubs}
                      registry={defaultRegistry}
                      isExpanded={expandedTaskIds.has(task.id)}
                      onToggleExpand={() => handleToggleExpand(task.id)}
                      onSubtaskToggle={editable ? (subtaskId) => handleSubtaskToggle(task.id, subtaskId) : undefined}
                      onSubtaskEdit={editable ? (subtaskId, updates) => handleSubtaskEdit(task.id, subtaskId, updates) : undefined}
                      onSubtaskAdd={editable ? (subtask) => handleSubtaskAdd(task.id, subtask) : undefined}
                      onSubtaskDelete={editable ? (subtaskId) => handleSubtaskDelete(task.id, subtaskId) : undefined}
                      onDuplicate={editable ? () => handleDuplicate(task) : undefined}
                      onStatusChange={editable ? (status) => handleStatusChange(task.id, status) : undefined}
                      onEdit={editable ? (updates) => handleEditTask(task.id, updates) : undefined}
                      onDelete={editable ? () => handleDeleteTask(task.id) : undefined}
                      staffRoster={staffRoster}
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
