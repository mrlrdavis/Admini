// ---------------------------------------------------------------------------
// TaskCard - Collapsible task card with subtask checkboxes
// ---------------------------------------------------------------------------
// Pure presentational component. Renders a task card that can be expanded
// to show subtasks, category tag, and block reason.
// Property 9: Parent checkbox disabled when any subtask.completed === false
// Requirements: 8.1, 8.3, 8.4, 8.5, 8.6

import type { CategoryRegistry } from '@admini/shared';
import { getCategoryStyle } from '@admini/shared';
import type { TaskWithSubtasks } from './TaskSection';
import '../styles/task-card.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TaskCardProps {
  task: TaskWithSubtasks;
  registry: CategoryRegistry;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSubtaskToggle: (subtaskId: string) => void;
  onDuplicate: () => void;
  onStatusChange: (status: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDueDate(dueAt?: string): string | null {
  if (!dueAt) return null;
  const datePart = dueAt.split('T')[0] ?? dueAt;
  const [y, m, d] = datePart.split('-').map(Number);
  const date = new Date(y!, m! - 1, d!);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function isDueDateOverdue(dueAt?: string): boolean {
  if (!dueAt) return false;
  const datePart = dueAt.split('T')[0] ?? dueAt;
  const [y, m, d] = datePart.split('-').map(Number);
  const dueDate = new Date(y!, m! - 1, d!);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dueDate < today;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TaskCard({
  task,
  registry,
  isExpanded,
  onToggleExpand,
  onSubtaskToggle,
  onDuplicate,
  onStatusChange,
}: TaskCardProps) {
  const completedSubtasks = task.subtasks.filter(s => s.completed).length;
  const totalSubtasks = task.subtasks.length;
  const allSubtasksComplete = totalSubtasks > 0 && completedSubtasks === totalSubtasks;
  const hasIncompleteSubtasks = totalSubtasks > 0 && !allSubtasksComplete;

  const categoryStyle = task.category
    ? getCategoryStyle(task.category.id, registry)
    : undefined;

  const dueDateStr = formatDueDate(task.dueAt);
  const overdue = isDueDateOverdue(task.dueAt) && task.status !== 'completed';

  return (
    <article
      className={`task-card task-card--priority-${task.priority}`}
      aria-label={`Task: ${task.title}`}
    >
      {/* Collapsed header - always visible */}
      <div className="task-card__header" onClick={onToggleExpand}>
        <button
          type="button"
          className={`task-card__expand-btn${isExpanded ? ' task-card__expand-btn--expanded' : ''}`}
          onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Collapse task' : 'Expand task'}
        >
          &#x25B6;
        </button>

        <input
          type="checkbox"
          className="task-card__parent-checkbox"
          checked={task.status === 'completed'}
          disabled={hasIncompleteSubtasks}
          onChange={() => onStatusChange(task.status === 'completed' ? 'open' : 'completed')}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Mark "${task.title}" as ${task.status === 'completed' ? 'open' : 'completed'}`}
          title={hasIncompleteSubtasks ? 'Complete all subtasks first' : undefined}
        />

        <span className="task-card__title">{task.title}</span>

        <div className="task-card__meta">
          {dueDateStr && (
            <span className={`task-card__due-date${overdue ? ' task-card__due-date--overdue' : ''}`}>
              {dueDateStr}
            </span>
          )}
          {totalSubtasks > 0 && (
            <span className="task-card__progress">
              {completedSubtasks}/{totalSubtasks}
            </span>
          )}
        </div>
      </div>

      {/* Expanded body */}
      {isExpanded && (
        <div className="task-card__body">
          {/* Subtask checkboxes */}
          {totalSubtasks > 0 && (
            <ul className="task-card__subtasks" aria-label="Subtasks">
              {task.subtasks.map((subtask) => (
                <li key={subtask.id} className="task-card__subtask">
                  <input
                    type="checkbox"
                    className="task-card__subtask-checkbox"
                    checked={subtask.completed}
                    onChange={() => onSubtaskToggle(subtask.id)}
                    aria-label={`Subtask: ${subtask.title}`}
                  />
                  <span
                    className={`task-card__subtask-label${subtask.completed ? ' task-card__subtask-label--completed' : ''}`}
                  >
                    {subtask.title}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* Category tag */}
          {categoryStyle && (
            <span
              className="task-card__category-tag"
              style={{
                backgroundColor: `var(${categoryStyle.colorToken}, ${categoryStyle.colorHex})`,
              }}
            >
              {categoryStyle.label}
            </span>
          )}

          {/* Block reason */}
          {task.blockReason && (
            <p className="task-card__block-reason">{task.blockReason}</p>
          )}

          {/* Actions */}
          <div className="task-card__actions">
            <button
              type="button"
              className="task-card__action-btn"
              onClick={onDuplicate}
              aria-label={`Duplicate task "${task.title}"`}
            >
              Duplicate
            </button>
            <select
              className="task-card__status-select"
              value={task.status}
              onChange={(e) => onStatusChange(e.target.value)}
              aria-label="Change task status"
            >
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
      )}
    </article>
  );
}
