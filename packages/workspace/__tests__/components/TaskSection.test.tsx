import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createElement } from 'react';
import {
  TaskSection,
  type TaskSectionProps,
  type TaskWithSubtasks,
} from '../../src/components/TaskSection';
import { createRegistry, type CategoryRegistry } from '@admini/shared';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const testRegistry: CategoryRegistry = createRegistry([
  { id: 'compliance', label: 'Compliance', colorToken: '--color-category-orange', colorHex: '#E8A838' },
  { id: 'scheduling', label: 'Scheduling', colorToken: '--color-category-yellow', colorHex: '#E6C84D' },
  { id: 'students', label: 'Students', colorToken: '--color-category-green', colorHex: '#7BAF7B' },
  { id: 'blocked', label: 'Blocked', colorToken: '--color-category-red', colorHex: '#D63031' },
]);

function makeTask(overrides?: Partial<TaskWithSubtasks>): TaskWithSubtasks {
  return {
    id: 'task-1',
    title: 'Test Task',
    priority: 'high',
    status: 'open',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    subtasks: [],
    ...overrides,
  };
}

function defaultProps(overrides?: Partial<TaskSectionProps>): TaskSectionProps {
  return {
    title: 'High Priority',
    tasks: [makeTask()],
    registry: testRegistry,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Rendering basics
// ---------------------------------------------------------------------------

describe('TaskSection - rendering', () => {
  it('renders nothing when tasks array is empty', () => {
    const { container } = render(createElement(TaskSection, defaultProps({ tasks: [] })));
    expect(container.innerHTML).toBe('');
  });

  it('renders a section with the provided title', () => {
    render(createElement(TaskSection, defaultProps({ title: 'Due Today' })));
    expect(screen.getByText('Due Today')).toBeDefined();
  });

  it('renders a section with the correct aria-label', () => {
    render(createElement(TaskSection, defaultProps({ title: 'Coming Due' })));
    const section = screen.getByRole('region', { name: 'Coming Due tasks' });
    expect(section).toBeDefined();
  });

  it('renders task titles for all provided tasks', () => {
    const tasks = [
      makeTask({ id: '1', title: 'First Task' }),
      makeTask({ id: '2', title: 'Second Task' }),
      makeTask({ id: '3', title: 'Third Task' }),
    ];
    render(createElement(TaskSection, defaultProps({ tasks })));
    expect(screen.getByText('First Task')).toBeDefined();
    expect(screen.getByText('Second Task')).toBeDefined();
    expect(screen.getByText('Third Task')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 2. Category tags (Req 1.5)
// ---------------------------------------------------------------------------

describe('TaskSection - category tags', () => {
  it('renders a category tag when task has a registered category', () => {
    const task = makeTask({
      category: { id: 'compliance', label: 'Compliance', color: '#E8A838' },
    });
    render(createElement(TaskSection, defaultProps({ tasks: [task] })));
    expect(screen.getByText('Compliance')).toBeDefined();
  });

  it('applies the category color token as background', () => {
    const task = makeTask({
      category: { id: 'students', label: 'Students', color: '#7BAF7B' },
    });
    const { container } = render(createElement(TaskSection, defaultProps({ tasks: [task] })));
    const tag = container.querySelector('.task-section__category-tag') as HTMLElement;
    expect(tag).not.toBeNull();
    expect(tag.style.backgroundColor).toContain('--color-category-green');
  });

  it('does not render a category tag when task has no category', () => {
    const task = makeTask({ category: undefined });
    const { container } = render(createElement(TaskSection, defaultProps({ tasks: [task] })));
    const tag = container.querySelector('.task-section__category-tag');
    expect(tag).toBeNull();
  });

  it('does not render a category tag when category is not in registry', () => {
    const task = makeTask({
      category: { id: 'unknown-category', label: 'Unknown', color: '#000' },
    });
    const { container } = render(createElement(TaskSection, defaultProps({ tasks: [task] })));
    const tag = container.querySelector('.task-section__category-tag');
    expect(tag).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. Blocked tasks - block reason and stale badge (Req 1.6)
// ---------------------------------------------------------------------------

describe('TaskSection - blocked tasks', () => {
  it('shows block reason text when title is Blocked and task has blockReason', () => {
    const task = makeTask({ blockReason: 'Waiting on approval' });
    render(createElement(TaskSection, defaultProps({ title: 'Blocked', tasks: [task] })));
    expect(screen.getByText('Waiting on approval')).toBeDefined();
  });

  it('does not show block reason when title is not Blocked', () => {
    const task = makeTask({ blockReason: 'Waiting on approval' });
    render(createElement(TaskSection, defaultProps({ title: 'High Priority', tasks: [task] })));
    expect(screen.queryByText('Waiting on approval')).toBeNull();
  });

  it('shows stale badge with day count for blocked tasks', () => {
    const task = makeTask({ staleDays: 5 });
    render(createElement(TaskSection, defaultProps({ title: 'Blocked', tasks: [task] })));
    expect(screen.getByText('Stale 5d')).toBeDefined();
  });

  it('does not show stale badge when staleDays is 0', () => {
    const task = makeTask({ staleDays: 0 });
    const { container } = render(
      createElement(TaskSection, defaultProps({ title: 'Blocked', tasks: [task] }))
    );
    const badge = container.querySelector('.task-section__stale-badge');
    expect(badge).toBeNull();
  });

  it('does not show stale badge when title is not Blocked', () => {
    const task = makeTask({ staleDays: 5 });
    const { container } = render(
      createElement(TaskSection, defaultProps({ title: 'Due Today', tasks: [task] }))
    );
    const badge = container.querySelector('.task-section__stale-badge');
    expect(badge).toBeNull();
  });

  it('applies blocked CSS modifier class when title is Blocked', () => {
    const task = makeTask();
    const { container } = render(
      createElement(TaskSection, defaultProps({ title: 'Blocked', tasks: [task] }))
    );
    const card = container.querySelector('.task-section__card--blocked');
    expect(card).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. Scheduled time display for Due Today (Req 1.7)
// ---------------------------------------------------------------------------

describe('TaskSection - scheduled time (Due Today)', () => {
  it('shows formatted time when title is Due Today and task has time in dueAt', () => {
    const task = makeTask({ dueAt: '2025-03-15T14:30:00Z' });
    render(createElement(TaskSection, defaultProps({ title: 'Due Today', tasks: [task] })));
    expect(screen.getByText('2:30 PM')).toBeDefined();
  });

  it('shows 12:00 AM for midnight hour', () => {
    const task = makeTask({ dueAt: '2025-03-15T00:00:00Z' });
    render(createElement(TaskSection, defaultProps({ title: 'Due Today', tasks: [task] })));
    expect(screen.getByText('12:00 AM')).toBeDefined();
  });

  it('shows 12:30 PM for noon', () => {
    const task = makeTask({ dueAt: '2025-03-15T12:30:00Z' });
    render(createElement(TaskSection, defaultProps({ title: 'Due Today', tasks: [task] })));
    expect(screen.getByText('12:30 PM')).toBeDefined();
  });

  it('does not show time when title is not Due Today', () => {
    const task = makeTask({ dueAt: '2025-03-15T14:30:00Z' });
    const { container } = render(
      createElement(TaskSection, defaultProps({ title: 'High Priority', tasks: [task] }))
    );
    const timeEl = container.querySelector('.task-section__scheduled-time');
    expect(timeEl).toBeNull();
  });

  it('does not show time when dueAt has no time component', () => {
    const task = makeTask({ dueAt: '2025-03-15' });
    const { container } = render(
      createElement(TaskSection, defaultProps({ title: 'Due Today', tasks: [task] }))
    );
    const timeEl = container.querySelector('.task-section__scheduled-time');
    expect(timeEl).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5. Subtask progress display
// ---------------------------------------------------------------------------

describe('TaskSection - subtask progress', () => {
  it('displays subtask progress when task has subtasks', () => {
    const task = makeTask({
      subtasks: [
        { id: 's1', title: 'Sub A', completed: true },
        { id: 's2', title: 'Sub B', completed: false },
        { id: 's3', title: 'Sub C', completed: true },
      ],
    });
    render(createElement(TaskSection, defaultProps({ tasks: [task] })));
    expect(screen.getByText('2/3 subtasks')).toBeDefined();
  });

  it('does not display progress section when task has no subtasks', () => {
    const task = makeTask({ subtasks: [] });
    const { container } = render(createElement(TaskSection, defaultProps({ tasks: [task] })));
    const progress = container.querySelector('.task-section__progress');
    expect(progress).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 6. Action callback
// ---------------------------------------------------------------------------

describe('TaskSection - onTaskAction callback', () => {
  it('renders action button when onTaskAction is provided', () => {
    const onTaskAction = vi.fn();
    render(createElement(TaskSection, defaultProps({ onTaskAction })));
    const btn = screen.getByRole('button', { name: /Complete task/i });
    expect(btn).toBeDefined();
  });

  it('does not render action button when onTaskAction is not provided', () => {
    const { container } = render(createElement(TaskSection, defaultProps({ onTaskAction: undefined })));
    const btn = container.querySelector('.task-section__action-btn');
    expect(btn).toBeNull();
  });

  it('calls onTaskAction with task id and complete action on click', () => {
    const onTaskAction = vi.fn();
    const task = makeTask({ id: 'task-abc', title: 'My Task' });
    render(createElement(TaskSection, defaultProps({ tasks: [task], onTaskAction })));
    const btn = screen.getByRole('button', { name: 'Complete task My Task' });
    fireEvent.click(btn);
    expect(onTaskAction).toHaveBeenCalledWith('task-abc', 'complete');
  });

  it('calls onTaskAction with correct task id for each task', () => {
    const onTaskAction = vi.fn();
    const tasks = [
      makeTask({ id: 'a', title: 'Alpha' }),
      makeTask({ id: 'b', title: 'Beta' }),
    ];
    render(createElement(TaskSection, defaultProps({ tasks, onTaskAction })));

    fireEvent.click(screen.getByRole('button', { name: 'Complete task Alpha' }));
    fireEvent.click(screen.getByRole('button', { name: 'Complete task Beta' }));

    expect(onTaskAction).toHaveBeenCalledTimes(2);
    expect(onTaskAction).toHaveBeenCalledWith('a', 'complete');
    expect(onTaskAction).toHaveBeenCalledWith('b', 'complete');
  });
});
