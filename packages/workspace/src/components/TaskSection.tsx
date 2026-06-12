// ---------------------------------------------------------------------------
// TaskSection - Dashboard task cards with category tags and status indicators
// ---------------------------------------------------------------------------
// Pure presentational component. Renders a section of task cards using
// the metadata-driven CategoryRegistry for colors.
// Requirements: 1.2, 1.5, 1.6, 1.7

import type { CategoryRegistry, CategoryConfig } from '@admini/shared';
import { getCategoryStyle } from '@admini/shared';
import '../styles/task-section.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  dueAt?: string;
}

export interface TaskWithSubtasks {
  id: string;
  title: string;
  description?: string;
  priority: string;
  status: string;
  category?: { id: string; label: string; color: string };
  dueAt?: string;
  assignee?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  staleDays?: number;
  blockReason?: string;
  subtasks: Subtask[];
}

export type TaskAction = 'complete' | 'duplicate' | 'edit' | 'delete';

export interface TaskSectionProps {
  title: string; // "High Priority" | "Due Today" | "Coming Due" | "Blocked" | "Suggested"
  tasks: TaskWithSubtasks[];
  registry: CategoryRegistry;
  onTaskAction?: (taskId: string, action: TaskAction) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(dueAt?: string): string | null {
  if (!dueAt || !dueAt.includes('T')) return null;
  const timePart = dueAt.split('T')[1]!;
  const [hourStr, minStr] = timePart.split(':');
  const hour = parseInt(hourStr!, 10);
  const min = minStr || '00';
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${min} ${period}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TaskSection({ title, tasks, registry, onTaskAction }: TaskSectionProps) {
  if (tasks.length === 0) return null;

  return (
    <section className="task-section" aria-label={`${title} tasks`}>
      <h3 className="task-section__title">{title}</h3>
      <div className="task-section__list">
        {tasks.map((task) => {
          const categoryStyle: CategoryConfig | undefined = task.category
            ? getCategoryStyle(task.category.id, registry)
            : undefined;

          const isBlocked = title === 'Blocked';
          const isDueToday = title === 'Due Today';
          const scheduledTime = isDueToday ? formatTime(task.dueAt) : null;

          return (
            <div
              key={task.id}
              className={`task-section__card${isBlocked ? ' task-section__card--blocked' : ''}`}
            >
              <div className="task-section__card-header">
                <span className="task-section__task-title">
                  {task.title}
                  {scheduledTime && (
                    <span className="task-section__scheduled-time"> {scheduledTime}</span>
                  )}
                </span>
                {categoryStyle && (
                  <span
                    className="task-section__category-tag"
                    style={{
                      backgroundColor: `var(${categoryStyle.colorToken}, ${categoryStyle.colorHex})`,
                    }}
                  >
                    {categoryStyle.label}
                  </span>
                )}
              </div>

              {isBlocked && task.blockReason && (
                <p className="task-section__block-reason">{task.blockReason}</p>
              )}

              {isBlocked && task.staleDays !== undefined && task.staleDays > 0 && (
                <span className="task-section__stale-badge">
                  Stale {task.staleDays}d
                </span>
              )}

              {task.subtasks.length > 0 && (
                <div className="task-section__progress">
                  {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length} subtasks
                </div>
              )}

              {onTaskAction && (
                <div className="task-section__actions">
                  <button
                    type="button"
                    className="task-section__action-btn"
                    onClick={() => onTaskAction(task.id, 'complete')}
                    aria-label={`Complete task ${task.title}`}
                  >
                    ✓
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
