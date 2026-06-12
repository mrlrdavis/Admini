/**
 * Shared types used by utility functions.
 */

/**
 * Calendar event used for filtering and display.
 */
export interface CalendarEvent {
  id: string;
  summary: string;
  start: string; // ISO date or datetime
  end: string;
  source?: 'google' | 'local';
}

/**
 * Activity event representing an action taken on an entity.
 */
export interface ActivityEvent {
  id: string;
  organizationId: string;
  actorId: string;
  entityType: string;
  entityId: string;
  action: string;
  createdAt: string;
}
