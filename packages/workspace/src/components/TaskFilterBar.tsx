// ---------------------------------------------------------------------------
// TaskFilterBar - Filter pills and view toggle for the Tasks tab
// ---------------------------------------------------------------------------
// Pure presentational component. Renders filter pills and a list/calendar
// view toggle button.
// Requirements: 8.2

import '../styles/task-filter-bar.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FilterType = 'all' | 'open' | 'in-progress' | 'completed' | 'blocked' | 'due' | 'coming-due' | 'high' | 'normal' | 'low';

export interface TaskFilterBarProps {
  activeFilter: FilterType;
  onFilterChange: (filter: string) => void;
  activeView: 'list' | 'calendar';
  onViewToggle: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROGRESS_FILTERS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'due', label: 'Due' },
  { value: 'coming-due', label: 'Coming Due' },
];

const TYPE_FILTERS: { value: FilterType; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TaskFilterBar({
  activeFilter,
  onFilterChange,
  activeView,
  onViewToggle,
}: TaskFilterBarProps) {
  return (
    <div className="task-filter-bar" role="toolbar" aria-label="Task filters">
      <div className="task-filter-bar__pills" role="group" aria-label="Filter by status">
        {PROGRESS_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={'task-filter-bar__pill' + (activeFilter === value ? ' task-filter-bar__pill--active' : '')}
            onClick={() => onFilterChange(value)}
            aria-pressed={activeFilter === value}
          >
            {label}
          </button>
        ))}
        <span className="task-filter-bar__separator" aria-hidden="true">|</span>
        {TYPE_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={'task-filter-bar__pill' + (activeFilter === value ? ' task-filter-bar__pill--active' : '')}
            onClick={() => onFilterChange(value)}
            aria-pressed={activeFilter === value}
          >
            {label}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="task-filter-bar__view-toggle"
        onClick={onViewToggle}
        aria-label={'Switch to ' + (activeView === 'list' ? 'calendar' : 'list') + ' view'}
      >
        {activeView === 'list' ? (
          <span className="task-filter-bar__view-icon" aria-hidden="true">&#x1F4C5;</span>
        ) : (
          <span className="task-filter-bar__view-icon" aria-hidden="true">&#x2630;</span>
        )}
        <span className="task-filter-bar__view-label">
          {activeView === 'list' ? 'Calendar' : 'List'}
        </span>
      </button>
    </div>
  );
}