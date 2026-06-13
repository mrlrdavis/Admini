import type { ReactNode } from 'react';
// ---------------------------------------------------------------------------
// CalendarView - Monthly grid with tasks and events overlaid
// ---------------------------------------------------------------------------
// Pure presentational component. Renders a monthly calendar grid showing
// tasks and merged events. Includes a left legend and "Add Event" button.
// Requirements: 9.1, 9.2, 9.4, 9.5

import { useState, useMemo } from 'react';
import type { MergedEvent } from '../services/calendarMerge';
import type { DashboardTask } from '../types';
import '../styles/calendar-view.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CalendarViewProps {
  mergedEvents: MergedEvent[];
  tasks: DashboardTask[];
  onAddEvent: (date: string, time?: string) => void;
  onTaskClick?: (taskId: string) => void;
  overdueSlot?: ReactNode;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getCalendarDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Monday start
  const days: Date[] = [];
  for (let i = -startDay; i < 42 - startDay; i++) {
    days.push(new Date(year, month, 1 + i));
  }
  return days;
}

function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function extractDatePart(isoStr: string): string {
  return isoStr.split('T')[0] ?? isoStr;
}

function loadSubtasks(taskId: string): { id: string; title: string; completed: boolean }[] {
  try {
    const raw = localStorage.getItem('admini_subtasks_' + taskId);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function buildTaskTooltip(task: DashboardTask): string {
  const lines: string[] = [task.title];
  
  if (task.description) {
    lines.push('');
    lines.push(task.description.length > 100 ? task.description.slice(0, 100) + '...' : task.description);
  }
  
  if (task.assignedTo) {
    lines.push('');
    lines.push('Assigned: ' + task.assignedTo);
  }
  
  if (task.priority && task.priority !== 'normal') {
    lines.push('Priority: ' + task.priority);
  }
  
  if (task.status === 'archived') {
    lines.push('');
    lines.push('BLOCKED: ' + (task.description || 'Waiting on dependency'));
  }
  
  const subtasks = loadSubtasks(task.id);
  if (subtasks.length > 0) {
    lines.push('');
    const completed = subtasks.filter(s => s.completed).length;
    lines.push('Subtasks: ' + completed + '/' + subtasks.length + ' completed');
    subtasks.slice(0, 5).forEach(st => {
      lines.push((st.completed ? '  [X] ' : '  [ ] ') + st.title);
    });
    if (subtasks.length > 5) {
      lines.push('  ...and ' + (subtasks.length - 5) + ' more');
    }
  }
  
  lines.push('');
  lines.push('Click to view in task list');
  
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CalendarView({ mergedEvents, tasks, onAddEvent, onTaskClick, overdueSlot }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const days = useMemo(() => getCalendarDays(year, month), [year, month]);

  const todayStr = toLocalDateStr(new Date());

  // Index tasks by local date
  const tasksByDate = useMemo(() => {
    const map = new Map<string, DashboardTask[]>();
    for (const task of tasks) {
      if (!task.dueAt) continue;
      const dateKey = extractDatePart(task.dueAt);
      const existing = map.get(dateKey) ?? [];
      existing.push(task);
      map.set(dateKey, existing);
    }
    return map;
  }, [tasks]);

  // Index events by local date
  const eventsByDate = useMemo(() => {
    const map = new Map<string, MergedEvent[]>();
    for (const event of mergedEvents) {
      const dateKey = extractDatePart(event.start);
      const existing = map.get(dateKey) ?? [];
      existing.push(event);
      map.set(dateKey, existing);
    }
    return map;
  }, [mergedEvents]);

  function handlePrevMonth() {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }

  function handleNextMonth() {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }

  function handleTaskClick(taskId: string) {
    if (onTaskClick) {
      onTaskClick(taskId);
    } else {
      // Default: store task ID and navigate would happen via parent
      localStorage.setItem('admini_expand_task', taskId);
    }
  }

  const monthLabel = currentMonth.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="calendar-view">
      {/* Legend */}
      <aside className="calendar-view__legend" aria-label="Calendar legend">
        <h3 className="calendar-view__legend-title">Legend</h3>
        <ul className="calendar-view__legend-list">
          <li className="calendar-view__legend-item">
            <span className="calendar-view__legend-dot calendar-view__legend-dot--task" />
            Task
          </li>
          <li className="calendar-view__legend-item">
            <span className="calendar-view__legend-dot calendar-view__legend-dot--subtask" />
            Subtask
          </li>
          <li className="calendar-view__legend-item">
            <span className="calendar-view__legend-dot calendar-view__legend-dot--assigned" />
            Assigned
          </li>
          <li className="calendar-view__legend-item">
            <span className="calendar-view__legend-dot calendar-view__legend-dot--priority" />
            Priority
          </li>
        </ul>
        {overdueSlot && <div className="calendar-view__legend-overdue">{overdueSlot}</div>}
      </aside>

      {/* Main calendar area */}
      <div className="calendar-view__main">
        {/* Header with navigation and Add Event */}
        <div className="calendar-view__header">
          <span className="calendar-view__month-label">{monthLabel}</span>
          <div className="calendar-view__nav-group">
            <button
              type="button"
              className="calendar-view__nav-btn"
              onClick={handlePrevMonth}
              aria-label="Previous month"
            >
              &#x2190;
            </button>
            <button
              type="button"
              className="calendar-view__nav-btn"
              onClick={handleNextMonth}
              aria-label="Next month"
            >
              &#x2192;
            </button>
            <button
              type="button"
              className="calendar-view__add-event-btn"
              onClick={() => onAddEvent(toLocalDateStr(new Date()))}
            >
              + Add Event
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="calendar-view__grid" role="grid" aria-label="Calendar grid">
          {/* Day-of-week headers */}
          {DOW_LABELS.map(dow => (
            <div key={dow} className="calendar-view__dow" role="columnheader">
              {dow}
            </div>
          ))}

          {/* Day cells */}
          {days.map((day, i) => {
            const dateStr = toLocalDateStr(day);
            const isCurrentMonth = day.getMonth() === month;
            const isToday = dateStr === todayStr;
            const dayTasks = tasksByDate.get(dateStr) ?? [];
            const dayEvents = eventsByDate.get(dateStr) ?? [];

            const cellClass = [
              'calendar-view__cell',
              !isCurrentMonth && 'calendar-view__cell--other-month',
              isToday && 'calendar-view__cell--today',
            ].filter(Boolean).join(' ');

            return (
              <div key={i} className={cellClass} role="gridcell" aria-label={dateStr}>
                <span className="calendar-view__cell-date">{day.getDate()}</span>
                {(dayTasks.length > 0 || dayEvents.length > 0) && (
                  <div className="calendar-view__cell-items">
                    {dayTasks.slice(0, 3).map(task => {
                      const subtasks = loadSubtasks(task.id);
                      const hasSubtasks = subtasks.length > 0;
                      const isAssigned = !!task.assignedTo;
                      const isHighPriority = task.priority === 'high' || task.priority === 'urgent';
                      const isBlocked = task.status === 'archived';
                      const tooltipText = buildTaskTooltip(task);
                      return (
                        <span
                          key={task.id}
                          className={'calendar-view__cell-item calendar-view__cell-item--task' + (isBlocked ? ' calendar-view__cell-item--blocked' : '')}
                          title={tooltipText}
                          onClick={(e) => { e.stopPropagation(); handleTaskClick(task.id); }}
                          style={{ cursor: 'pointer' }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleTaskClick(task.id); }}
                        >
                          <span className="calendar-view__cell-item-dots">
                            {hasSubtasks && <span className="calendar-view__dot calendar-view__dot--subtask" title={'Has ' + subtasks.length + ' subtask(s)'} />}
                            {isAssigned && <span className="calendar-view__dot calendar-view__dot--assigned" title={'Assigned to ' + task.assignedTo} />}
                            {isHighPriority && <span className="calendar-view__dot calendar-view__dot--priority" title={task.priority} />}
                            {isBlocked && <span className="calendar-view__dot calendar-view__dot--blocked" title="Blocked" />}
                          </span>
                          <span className="calendar-view__cell-item-text">{task.title}</span>
                        </span>
                      );
                    })}
                    {dayEvents.slice(0, 2).map(event => (
                      <span
                        key={event.id}
                        className="calendar-view__cell-item calendar-view__cell-item--event"
                        title={event.summary}
                      >
                        {event.summary}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}