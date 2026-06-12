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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CalendarView({ mergedEvents, tasks, onAddEvent, overdueSlot }: CalendarViewProps) {
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
                    {dayTasks.slice(0, 3).map(task => (
                      <span
                        key={task.id}
                        className="calendar-view__cell-item calendar-view__cell-item--task"
                        title={task.title}
                      >
                        {task.title}
                      </span>
                    ))}
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
