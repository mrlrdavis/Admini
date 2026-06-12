// ---------------------------------------------------------------------------
// MiniCalendar - Compact month grid with task-day dot indicators
// ---------------------------------------------------------------------------
// Requirements: 5.1, 5.2, 5.3, 5.4

import { useMemo, useState } from 'react';
import { parseLocalDate } from '@admini/shared';
import type { DashboardTask } from '../types';
import '../styles/mini-calendar.css';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MiniCalendarProps {
  tasks: DashboardTask[];
  currentMonth?: Date; // defaults to today
  onMonthChange?: (month: Date) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MiniCalendar({ tasks, currentMonth, onMonthChange }: MiniCalendarProps) {
  const [internalMonth, setInternalMonth] = useState(() => {
    if (currentMonth) return new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Use controlled or internal month
  const displayMonth = currentMonth
    ? new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
    : internalMonth;

  const today = useMemo(() => new Date(), []);

  // Build a Set of day-of-month numbers that have tasks for this month
  const taskDays = useMemo(() => {
    const days = new Set<number>();
    const year = displayMonth.getFullYear();
    const month = displayMonth.getMonth();

    for (const task of tasks) {
      if (!task.dueAt) continue;
      const due = parseLocalDate(task.dueAt);
      if (due.getFullYear() === year && due.getMonth() === month) {
        days.add(due.getDate());
      }
    }
    return days;
  }, [tasks, displayMonth]);

  // Calendar grid data
  const { year, month, firstDayOffset, daysInMonth } = useMemo(() => {
    const y = displayMonth.getFullYear();
    const m = displayMonth.getMonth();
    const firstDay = new Date(y, m, 1).getDay(); // 0=Sun
    const dim = new Date(y, m + 1, 0).getDate();
    return { year: y, month: m, firstDayOffset: firstDay, daysInMonth: dim };
  }, [displayMonth]);

  const monthLabel = displayMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  // Navigation handlers
  function goToPrevMonth() {
    const prev = new Date(year, month - 1, 1);
    if (onMonthChange) {
      onMonthChange(prev);
    } else {
      setInternalMonth(prev);
    }
  }

  function goToNextMonth() {
    const next = new Date(year, month + 1, 1);
    if (onMonthChange) {
      onMonthChange(next);
    } else {
      setInternalMonth(next);
    }
  }

  // Build day cells
  const dayCells: React.ReactNode[] = [];

  // Leading days from previous month (muted)
  const prevMonthDays = new Date(year, month, 0).getDate(); // last day of previous month
  for (let i = firstDayOffset - 1; i >= 0; i--) {
    const dayNum = prevMonthDays - i;
    dayCells.push(
      <span key={'prev-' + dayNum} className="mini-calendar__day mini-calendar__day--muted" aria-hidden="true">
        {dayNum}
      </span>,
    );
  }

  // Current month day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const isToday = isSameDay(date, today);
    const hasTasks = taskDays.has(d);

    const classNames = [
      'mini-calendar__day',
      isToday ? 'mini-calendar__day--today' : '',
      hasTasks ? 'mini-calendar__day--has-tasks' : '',
    ]
      .filter(Boolean)
      .join(' ');

    const label = date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
      + (isToday ? ', today' : '')
      + (hasTasks ? ', has tasks' : '');

    dayCells.push(
      <span
        key={d}
        className={classNames}
        aria-label={label}
      >
        {d}
      </span>,
    );
  }

  // Trailing days from next month (muted) - fill to complete the last week row
  const totalCells = firstDayOffset + daysInMonth;
  const trailingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= trailingCells; i++) {
    dayCells.push(
      <span key={'next-' + i} className="mini-calendar__day mini-calendar__day--muted" aria-hidden="true">
        {i}
      </span>,
    );
  }

  return (
    <div className="mini-calendar" role="region" aria-label="Mini calendar">
      {/* Header with month navigation */}
      <div className="mini-calendar__header">
        <button
          type="button"
          className="mini-calendar__nav"
          onClick={goToPrevMonth}
          aria-label="Previous month"
        >
          &#8249;
        </button>
        <span className="mini-calendar__month-label">{monthLabel}</span>
        <button
          type="button"
          className="mini-calendar__nav"
          onClick={goToNextMonth}
          aria-label="Next month"
        >
          &#8250;
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="mini-calendar__grid">
        {DAY_HEADERS.map((day) => (
          <span key={day} className="mini-calendar__dow">
            {day}
          </span>
        ))}
        {dayCells}
      </div>
    </div>
  );
}
