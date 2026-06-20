/**
 * Activity utility functions for the AdminI application.
 * Provides formatting for activity feed events.
 */

import type { ActivityEvent } from './types';

/**
 * Formats an ActivityEvent into a human-readable action string.
 *
 * Maps entity types and actions to readable labels:
 * - entityType: capture, task, integration, invitation -> displayed as-is
 * - action: create -> "Created", update -> "Updated", delete -> "Deleted", accept -> "Accepted"
 *
 * @param event - The activity event to format
 * @returns A formatted string like "Created a capture" or "Updated a task"
 */
export function formatActivityAction(event: ActivityEvent): string {
  const entityLabel =
    event.entityType === 'capture' ? 'capture'
    : event.entityType === 'task' ? 'task'
    : event.entityType === 'integration' ? 'integration'
    : event.entityType === 'invitation' ? 'invitation'
    : event.entityType;

  const actionLabel =
    event.action === 'create' ? 'Created'
    : event.action === 'update' ? 'Updated'
    : event.action === 'delete' ? 'Deleted'
    : event.action === 'accept' ? 'Accepted'
    : event.action === 'react' ? 'Reacted to'
    : event.action;

  return `${actionLabel} a ${entityLabel}`;
}

