// ---------------------------------------------------------------------------
// ActivityFeed - Reverse-chronological list of recent activity (max 7 items)
// ---------------------------------------------------------------------------
// Pure presentational component. Receives pre-sorted, pre-capped items
// (Algorithm 2 applied upstream). Renders colored icons and timestamps.
// Requirements: 7.1, 7.2, 7.3

import type { ActivityEvent } from '../types';
import '../styles/activity-feed.css';

export interface ActivityFeedProps {
  items: ActivityEvent[]; // pre-sorted and capped by Algorithm 2
}

/**
 * Returns a human-readable label for an activity event action + entity type.
 */
function formatAction(event: ActivityEvent): string {
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
    : event.action;

  return `${actionLabel} a ${entityLabel}`;
}

/**
 * Formats a createdAt ISO string as a relative or short absolute timestamp.
 */
function formatTimestamp(createdAt: string): string {
  const date = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  // Fall back to short absolute date
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Returns the appropriate icon character for the activity action.
 * - 'create' actions get a green checkmark
 * - 'update' actions get a blue circle
 * - Other actions default to a neutral circle
 */
function getIconForAction(action: string): { char: string; className: string } {
  if (action === 'create') {
    return { char: '\u2713', className: 'activity-feed__icon--create' };
  }
  if (action === 'update') {
    return { char: '\u25CF', className: 'activity-feed__icon--update' };
  }
  return { char: '\u25CF', className: 'activity-feed__icon--default' };
}

/**
 * ActivityFeed renders a list of recent activity items with colored icons
 * and timestamps. Data is pre-sorted descending by createdAt and capped
 * at 7 items (Algorithm 2 applied upstream).
 */
export function ActivityFeed({ items }: ActivityFeedProps) {
  if (items.length === 0) {
    return (
      <section className="activity-feed" aria-label="Activity feed">
        <h2 className="activity-feed__title">Activity Feed</h2>
        <p className="activity-feed__empty">No recent activity</p>
      </section>
    );
  }

  return (
    <section className="activity-feed" aria-label="Activity feed">
      <h2 className="activity-feed__title">Activity Feed</h2>
      <ul className="activity-feed__list" role="list">
        {items.map((event) => {
          const icon = getIconForAction(event.action);
          return (
            <li key={event.id} className="activity-feed__item">
              <span
                className={`activity-feed__icon ${icon.className}`}
                aria-hidden="true"
              >
                {icon.char}
              </span>
              <div className="activity-feed__body">
                <span className="activity-feed__action">{formatAction(event)}</span>
                <time
                  className="activity-feed__time"
                  dateTime={event.createdAt}
                >
                  {formatTimestamp(event.createdAt)}
                </time>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}