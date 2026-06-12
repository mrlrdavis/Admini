// ---------------------------------------------------------------------------
// OverdueList - Lists overdue tasks with title and due date
// ---------------------------------------------------------------------------
// Pure presentational component. Receives pre-filtered tasks (dueAt < today
// && status !== 'completed') and renders them as a list.
// Requirements: 9.3

import { parseLocalDate } from '@admini/shared';
import type { DashboardTask } from '../types';
import '../styles/overdue-list.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OverdueListProps {
  tasks: DashboardTask[]; // pre-filtered: dueAt < today && status !== 'completed'
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDueDate(dueAt: string): string {
  const date = parseLocalDate(dueAt);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OverdueList({ tasks }: OverdueListProps) {
  return (
    <section className="overdue-list" aria-label="Overdue tasks">
      <h3 className="overdue-list__title">
        <span className="overdue-list__title-icon" aria-hidden="true">&#x26A0;</span>
        Overdue
        {tasks.length > 0 && (
          <span className="overdue-list__count" aria-label={`${tasks.length} overdue`}>
            {tasks.length}
          </span>
        )}
      </h3>

      {tasks.length === 0 ? (
        <p className="overdue-list__empty">No overdue tasks</p>
      ) : (
        <ul className="overdue-list__items">
          {tasks.map((task) => (
            <li key={task.id} className="overdue-list__item">
              <span className="overdue-list__item-title">{task.title}</span>
              {task.dueAt && (
                <span className="overdue-list__item-due">
                  {formatDueDate(task.dueAt)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
