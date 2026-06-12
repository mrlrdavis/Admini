/**
 * Task Duplication Service
 *
 * Implements Algorithm 3: Task Duplication from the app-ui-overhaul spec.
 * Deep clones a source task, resets specific fields, and persists the clone.
 */

/**
 * Represents a subtask within a task.
 */
export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  dueAt?: string;
}

/**
 * Represents a task with subtasks and extended metadata.
 */
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

/**
 * Service interface for persisting tasks. Injected for testability.
 */
export interface TaskService {
  create(task: TaskWithSubtasks): Promise<TaskWithSubtasks>;
}

/**
 * Duplicates a task following Algorithm 3:
 *
 * 1. Deep clone sourceTask via structuredClone()
 * 2. Fields COPIED (preserved as-is): title, description, priority, category, dueAt, assignee
 * 3. Fields RESET:
 *    - id -> crypto.randomUUID()
 *    - status -> 'open'
 *    - completedAt -> undefined
 *    - createdAt -> new Date().toISOString()
 *    - updatedAt -> new Date().toISOString()
 *    - staleDays -> 0
 *    - blockReason -> undefined
 *    - subtasks[*].id -> crypto.randomUUID() (each subtask gets new ID)
 *    - subtasks[*].completed -> false
 * 4. Persist cloned task via taskService.create(clone)
 * 5. Return persisted task
 */
export async function duplicateTask(
  sourceTask: TaskWithSubtasks,
  taskService: TaskService,
): Promise<TaskWithSubtasks> {
  // Step 1: Deep clone
  const clone = structuredClone(sourceTask);

  // Step 2: Fields copied as-is (already preserved by structuredClone):
  // title, description, priority, category, dueAt, assignee

  // Step 3: Reset fields
  const now = new Date().toISOString();
  clone.id = crypto.randomUUID();
  clone.status = 'open';
  clone.completedAt = undefined;
  clone.createdAt = now;
  clone.updatedAt = now;
  clone.staleDays = 0;
  clone.blockReason = undefined;

  // Reset each subtask's ID and completed status
  for (const subtask of clone.subtasks) {
    subtask.id = crypto.randomUUID();
    subtask.completed = false;
  }

  // Step 4: Persist
  const persisted = await taskService.create(clone);

  // Step 5: Return persisted task
  return persisted;
}
