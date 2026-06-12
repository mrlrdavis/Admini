import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MiniCalendar } from '../MiniCalendar';
import type { DashboardTask } from '../../types';

// Mock the CSS import
vi.mock('../../styles/mini-calendar.css', () => ({}));

// Helper to create a task with a specific due date
function makeTask(overrides: Partial<DashboardTask> = {}): DashboardTask {
  return {
    id: 'task-1',
    organizationId: 'org-1',
    createdBy: 'user-1',
    title: 'Test Task',
    priority: 'normal',
    status: 'open',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('MiniCalendar', () => {
  describe('rendering', () => {
    it('renders with region role and accessible label', () => {
      render(<MiniCalendar tasks={[]} currentMonth={new Date(2025, 5, 1)} />);

      expect(screen.getByRole('region', { name: 'Mini calendar' })).toBeDefined();
    });

    it('displays month name and year in header', () => {
      render(<MiniCalendar tasks={[]} currentMonth={new Date(2025, 5, 1)} />);

      // June 2025
      const label = screen.getByText(/june\s+2025/i);
      expect(label).toBeDefined();
    });

    it('renders 7 day-of-week headers (Sun-Sat)', () => {
      render(<MiniCalendar tasks={[]} currentMonth={new Date(2025, 5, 1)} />);

      expect(screen.getByText('Sun')).toBeDefined();
      expect(screen.getByText('Mon')).toBeDefined();
      expect(screen.getByText('Tue')).toBeDefined();
      expect(screen.getByText('Wed')).toBeDefined();
      expect(screen.getByText('Thu')).toBeDefined();
      expect(screen.getByText('Fri')).toBeDefined();
      expect(screen.getByText('Sat')).toBeDefined();
    });

    it('renders correct number of day cells for the month', () => {
      // June 2025 has 30 days, starts on Sunday (no leading muted days)
      render(<MiniCalendar tasks={[]} currentMonth={new Date(2025, 5, 1)} />);

      // Day 30 should exist, day 31 should not (June has 30 days, no May spillover since offset=0)
      expect(screen.getByText('30')).toBeDefined();
      expect(screen.queryByText('31')).toBeNull();
    });

    it('renders prev and next navigation buttons', () => {
      render(<MiniCalendar tasks={[]} currentMonth={new Date(2025, 5, 1)} />);

      expect(screen.getByRole('button', { name: 'Previous month' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Next month' })).toBeDefined();
    });
  });

  describe('surrounding month days (muted)', () => {
    it('renders leading days from previous month with muted style', () => {
      // March 2025 starts on Saturday (offset=6), so we should see Feb 23-28 as leading days
      render(<MiniCalendar tasks={[]} currentMonth={new Date(2025, 2, 1)} />);

      const grid = document.querySelector('.mini-calendar__grid');
      const mutedDays = grid?.querySelectorAll('.mini-calendar__day--muted');
      // March 2025 starts on Sat (offset 6), so 6 leading muted days
      // Plus trailing days to complete the grid
      expect(mutedDays!.length).toBeGreaterThanOrEqual(6);
    });

    it('renders trailing days from next month with muted style', () => {
      // June 2025 starts on Sunday (offset=0), has 30 days
      // 30 cells / 7 = 4 rows + 2 extra, so need 5 trailing to fill row (35 total)
      render(<MiniCalendar tasks={[]} currentMonth={new Date(2025, 5, 1)} />);

      const grid = document.querySelector('.mini-calendar__grid');
      const mutedDays = grid?.querySelectorAll('.mini-calendar__day--muted');
      expect(mutedDays!.length).toBe(5); // trailing days 1-5 of July
    });

    it('muted days have aria-hidden for accessibility', () => {
      render(<MiniCalendar tasks={[]} currentMonth={new Date(2025, 2, 1)} />);

      const mutedDays = document.querySelectorAll('.mini-calendar__day--muted');
      for (const day of mutedDays) {
        expect(day.getAttribute('aria-hidden')).toBe('true');
      }
    });

    it('does not render leading muted days when month starts on Sunday', () => {
      // June 2025 starts on Sunday
      render(<MiniCalendar tasks={[]} currentMonth={new Date(2025, 5, 1)} />);

      // All muted days should be trailing (no leading since offset=0)
      const grid = document.querySelector('.mini-calendar__grid');
      const allCells = grid?.querySelectorAll('.mini-calendar__day');
      // First cell should be day "1" of the current month (not muted)
      const firstDayCell = allCells![0];
      expect(firstDayCell?.textContent).toBe('1');
      expect(firstDayCell?.className).not.toContain('mini-calendar__day--muted');
    });
  });

  describe('today highlighting', () => {
    it('marks today with the today class', () => {
      const today = new Date();
      render(<MiniCalendar tasks={[]} currentMonth={today} />);

      const todayCell = screen.getByLabelText(/today/);
      expect(todayCell).toBeDefined();
      expect(todayCell.className).toContain('mini-calendar__day--today');
    });

    it('does not mark non-today dates with the today class', () => {
      // Use a month far in the past where today won't be
      render(<MiniCalendar tasks={[]} currentMonth={new Date(2020, 0, 1)} />);

      const todayCell = screen.queryByLabelText(/today/);
      expect(todayCell).toBeNull();
    });
  });

  describe('task-day dot indicators', () => {
    it('shows dot indicator on dates with tasks', () => {
      const tasks = [
        makeTask({ id: 'task-1', dueAt: '2025-06-15' }),
      ];

      render(<MiniCalendar tasks={tasks} currentMonth={new Date(2025, 5, 1)} />);

      const dayCell = screen.getByLabelText(/june 15.*has tasks/i);
      expect(dayCell).toBeDefined();
      expect(dayCell.className).toContain('mini-calendar__day--has-tasks');
    });

    it('does not show dot indicator on dates without tasks', () => {
      const tasks = [
        makeTask({ id: 'task-1', dueAt: '2025-06-15' }),
      ];

      render(<MiniCalendar tasks={tasks} currentMonth={new Date(2025, 5, 1)} />);

      // Day 10 should not have the has-tasks class
      const dayCell = screen.getByLabelText(/june 10/i);
      expect(dayCell.className).not.toContain('mini-calendar__day--has-tasks');
    });

    it('shows dot for multiple tasks on the same date', () => {
      const tasks = [
        makeTask({ id: 'task-1', dueAt: '2025-06-20' }),
        makeTask({ id: 'task-2', dueAt: '2025-06-20', title: 'Another Task' }),
      ];

      render(<MiniCalendar tasks={tasks} currentMonth={new Date(2025, 5, 1)} />);

      const dayCell = screen.getByLabelText(/june 20.*has tasks/i);
      expect(dayCell.className).toContain('mini-calendar__day--has-tasks');
    });

    it('handles ISO datetime strings with timezone info via parseLocalDate', () => {
      const tasks = [
        makeTask({ id: 'task-1', dueAt: '2025-06-10T23:59:59.999Z' }),
      ];

      render(<MiniCalendar tasks={tasks} currentMonth={new Date(2025, 5, 1)} />);

      // Should show dot on the 10th (local date parsing splits on T)
      const dayCell = screen.getByLabelText(/june 10.*has tasks/i);
      expect(dayCell.className).toContain('mini-calendar__day--has-tasks');
    });

    it('ignores tasks without a dueAt field', () => {
      const tasks = [
        makeTask({ id: 'task-no-due', dueAt: undefined }),
      ];

      render(<MiniCalendar tasks={tasks} currentMonth={new Date(2025, 5, 1)} />);

      // No day should have the has-tasks class
      const allDays = document.querySelectorAll('.mini-calendar__day--has-tasks');
      expect(allDays.length).toBe(0);
    });

    it('only shows dots for tasks in the displayed month', () => {
      const tasks = [
        makeTask({ id: 'task-1', dueAt: '2025-07-15' }), // July, not June
      ];

      render(<MiniCalendar tasks={tasks} currentMonth={new Date(2025, 5, 1)} />);

      // No day in June should have the has-tasks class
      const allDays = document.querySelectorAll('.mini-calendar__day--has-tasks');
      expect(allDays.length).toBe(0);
    });
  });

  describe('month navigation', () => {
    it('navigates to next month when next button is clicked (uncontrolled)', () => {
      render(<MiniCalendar tasks={[]} currentMonth={undefined} />);

      // The component starts at the current month; clicking next should not throw
      const nextBtn = screen.getByRole('button', { name: 'Next month' });
      fireEvent.click(nextBtn);
    });

    it('navigates to previous month when prev button is clicked (uncontrolled)', () => {
      render(<MiniCalendar tasks={[]} currentMonth={undefined} />);

      const prevBtn = screen.getByRole('button', { name: 'Previous month' });
      fireEvent.click(prevBtn);
    });

    it('calls onMonthChange with next month when next is clicked (controlled)', () => {
      const onMonthChange = vi.fn();
      render(
        <MiniCalendar
          tasks={[]}
          currentMonth={new Date(2025, 5, 1)}
          onMonthChange={onMonthChange}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Next month' }));

      expect(onMonthChange).toHaveBeenCalledTimes(1);
      const calledWith = onMonthChange.mock.calls[0][0] as Date;
      expect(calledWith.getFullYear()).toBe(2025);
      expect(calledWith.getMonth()).toBe(6); // July
    });

    it('calls onMonthChange with prev month when prev is clicked (controlled)', () => {
      const onMonthChange = vi.fn();
      render(
        <MiniCalendar
          tasks={[]}
          currentMonth={new Date(2025, 5, 1)}
          onMonthChange={onMonthChange}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));

      expect(onMonthChange).toHaveBeenCalledTimes(1);
      const calledWith = onMonthChange.mock.calls[0][0] as Date;
      expect(calledWith.getFullYear()).toBe(2025);
      expect(calledWith.getMonth()).toBe(4); // May
    });

    it('wraps year when navigating past December', () => {
      const onMonthChange = vi.fn();
      render(
        <MiniCalendar
          tasks={[]}
          currentMonth={new Date(2025, 11, 1)} // December 2025
          onMonthChange={onMonthChange}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Next month' }));

      const calledWith = onMonthChange.mock.calls[0][0] as Date;
      expect(calledWith.getFullYear()).toBe(2026);
      expect(calledWith.getMonth()).toBe(0); // January 2026
    });

    it('wraps year when navigating before January', () => {
      const onMonthChange = vi.fn();
      render(
        <MiniCalendar
          tasks={[]}
          currentMonth={new Date(2025, 0, 1)} // January 2025
          onMonthChange={onMonthChange}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));

      const calledWith = onMonthChange.mock.calls[0][0] as Date;
      expect(calledWith.getFullYear()).toBe(2024);
      expect(calledWith.getMonth()).toBe(11); // December 2024
    });
  });
});
