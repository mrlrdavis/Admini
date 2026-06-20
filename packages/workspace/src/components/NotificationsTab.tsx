import { useEffect, useMemo, useState } from 'react';
import {
  listNotifications,
  markNotificationRead,
  markNotificationUnread,
  setNotificationFlag,
  setNotificationReaction,
  type NotificationReaction,
  type TaskNotification,
} from '../services/notificationService';
import { loadNotificationPreferences } from '../services/notificationPreferences';
import { showToast } from './Toast';
import '../styles/notifications-tab.css';

const REACTION_OPTIONS: Array<{ value: NotificationReaction; label: string }> = [
  { value: 'seen', label: 'Seen' },
  { value: 'on_it', label: 'On it' },
  { value: 'thanks', label: 'Thanks' },
];

type NotificationFilter = 'all' | 'unread' | 'flagged';

function formatNotificationTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export interface NotificationsTabProps {
  userId: string;
  onTabChange?: (tabId: string) => void;
}

export function NotificationsTab({ userId, onTabChange }: NotificationsTabProps) {
  const [notifications, setNotifications] = useState<TaskNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [savingIds, setSavingIds] = useState<Set<string>>(() => new Set());
  const [filter, setFilter] = useState<NotificationFilter>('all');

  async function loadNotifications() {
    setLoading(true);
    setError(null);
    try {
      const preferences = await loadNotificationPreferences(userId);
      setEnabled(preferences.pushNotifications);
      if (!preferences.pushNotifications) {
        setNotifications([]);
        return;
      }
      setNotifications(await listNotifications());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load notifications');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, [userId]);

  function setNotificationSaving(notificationId: string, saving: boolean) {
    setSavingIds((current) => {
      const next = new Set(current);
      if (saving) next.add(notificationId);
      else next.delete(notificationId);
      return next;
    });
  }

  function patchNotification(notificationId: string, patch: Partial<TaskNotification>) {
    setNotifications((current) =>
      current.map((item) => item.id === notificationId ? { ...item, ...patch } : item),
    );
  }

  async function openNotification(notification: TaskNotification) {
    if (!notification.read) {
      patchNotification(notification.id, { read: true });
      markNotificationRead(notification.id).catch(() => undefined);
    }

    const taskId = notification.metadata.task_id;
    if (taskId && typeof window !== 'undefined') {
      localStorage.setItem('admini_expand_task', taskId);
      onTabChange?.('tasks');
      return;
    }

    showToast('Notification opened');
  }

  async function toggleReadState(notification: TaskNotification) {
    const nextRead = !notification.read;
    patchNotification(notification.id, { read: nextRead });
    setNotificationSaving(notification.id, true);
    try {
      if (nextRead) await markNotificationRead(notification.id);
      else await markNotificationUnread(notification.id);
    } catch (err) {
      patchNotification(notification.id, { read: notification.read });
      showToast(err instanceof Error ? err.message : 'Could not update notification');
    } finally {
      setNotificationSaving(notification.id, false);
    }
  }

  async function toggleFlag(notification: TaskNotification) {
    const flagged = !notification.metadata.flagged;
    patchNotification(notification.id, { metadata: { ...notification.metadata, flagged } });
    setNotificationSaving(notification.id, true);
    try {
      const metadata = await setNotificationFlag(notification, flagged);
      patchNotification(notification.id, { metadata });
      showToast(flagged ? 'Notification flagged' : 'Flag removed');
    } catch (err) {
      patchNotification(notification.id, { metadata: notification.metadata });
      showToast(err instanceof Error ? err.message : 'Could not update flag');
    } finally {
      setNotificationSaving(notification.id, false);
    }
  }

  const unreadCount = useMemo(() => notifications.filter((notification) => !notification.read).length, [notifications]);
  const flaggedCount = useMemo(() => notifications.filter((notification) => notification.metadata.flagged).length, [notifications]);
  const visibleNotifications = useMemo(() => {
    if (filter === 'unread') return notifications.filter((notification) => !notification.read);
    if (filter === 'flagged') return notifications.filter((notification) => notification.metadata.flagged);
    return notifications;
  }, [filter, notifications]);

  async function chooseReaction(notification: TaskNotification, reaction: NotificationReaction) {
    const nextReaction = notification.metadata.reaction === reaction ? null : reaction;
    const optimisticMetadata = { ...notification.metadata };
    if (nextReaction) {
      optimisticMetadata.reaction = nextReaction;
      optimisticMetadata.reacted_at = new Date().toISOString();
    } else {
      delete optimisticMetadata.reaction;
      delete optimisticMetadata.reacted_at;
    }

    patchNotification(notification.id, { metadata: optimisticMetadata });
    setNotificationSaving(notification.id, true);
    try {
      const metadata = await setNotificationReaction(notification, nextReaction);
      patchNotification(notification.id, { metadata });
      showToast(nextReaction ? 'Reaction added' : 'Reaction removed');
    } catch (err) {
      patchNotification(notification.id, { metadata: notification.metadata });
      showToast(err instanceof Error ? err.message : 'Could not save reaction');
    } finally {
      setNotificationSaving(notification.id, false);
    }
  }

  return (
    <section className="notifications-tab" aria-labelledby="notifications-heading">
      <header className="notifications-tab__header">
        <div>
          <h1 id="notifications-heading" className="notifications-tab__title">Notifications</h1>
          <p className="notifications-tab__subtitle">Task assignments and workspace updates.</p>
        </div>
        <button type="button" className="notifications-tab__refresh" onClick={loadNotifications}>
          Refresh
        </button>
      </header>

      {loading && <p className="notifications-tab__empty">Loading alerts...</p>}

      {error && (
        <div className="notifications-tab__error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={loadNotifications}>Try again</button>
        </div>
      )}

      {!loading && !error && !enabled && (
        <p className="notifications-tab__empty">In-app notifications are turned off in Settings.</p>
      )}

      {!loading && !error && enabled && notifications.length === 0 && (
        <p className="notifications-tab__empty">No notifications yet.</p>
      )}

      {!loading && !error && enabled && notifications.length > 0 && (
        <>
          <div className="notifications-tab__filters" role="group" aria-label="Notification filters">
            <button type="button" className={filter === 'all' ? 'notifications-tab__filter-btn notifications-tab__filter-btn--active' : 'notifications-tab__filter-btn'} onClick={() => setFilter('all')}>All <span>{notifications.length}</span></button>
            <button type="button" className={filter === 'unread' ? 'notifications-tab__filter-btn notifications-tab__filter-btn--active' : 'notifications-tab__filter-btn'} onClick={() => setFilter('unread')}>Unread <span>{unreadCount}</span></button>
            <button type="button" className={filter === 'flagged' ? 'notifications-tab__filter-btn notifications-tab__filter-btn--active' : 'notifications-tab__filter-btn'} onClick={() => setFilter('flagged')}>Flagged <span>{flaggedCount}</span></button>
          </div>
          {visibleNotifications.length === 0 ? (
            <p className="notifications-tab__empty">No {filter} notifications.</p>
          ) : (
        <ul className="notifications-tab__list">
          {visibleNotifications.map((notification) => {
            const saving = savingIds.has(notification.id);
            return (
              <li
                key={notification.id}
                className={`notifications-tab__item${notification.read ? '' : ' notifications-tab__item--unread'}${notification.metadata.flagged ? ' notifications-tab__item--flagged' : ''}`}
              >
                <button
                  type="button"
                  className="notifications-tab__item-open"
                  onClick={() => openNotification(notification)}
                >
                  <span className="notifications-tab__item-main">
                    <span className="notifications-tab__item-title">
                      {notification.metadata.flagged && <span className="notifications-tab__flag-label">Flagged</span>}
                      {notification.title}
                    </span>
                    <span className="notifications-tab__item-body">{notification.body}</span>
                  </span>
                  <span className="notifications-tab__item-time">
                    {formatNotificationTime(notification.createdAt)}
                  </span>
                </button>
                <div className="notifications-tab__actions" aria-label={`Actions for ${notification.title}`}>
                  <button type="button" onClick={() => toggleReadState(notification)} disabled={saving}>
                    {notification.read ? 'Mark unread' : 'Mark read'}
                  </button>
                  <button
                    type="button"
                    className={notification.metadata.flagged ? 'notifications-tab__action--active' : undefined}
                    onClick={() => toggleFlag(notification)}
                    disabled={saving}
                  >
                    {notification.metadata.flagged ? 'Unflag' : 'Flag'}
                  </button>
                  <span className="notifications-tab__reaction-group" aria-label="Reactions">
                    {REACTION_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={notification.metadata.reaction === option.value ? 'notifications-tab__action--active' : undefined}
                        onClick={() => chooseReaction(notification, option.value)}
                        disabled={saving}
                      >
                        {option.label}
                      </button>
                    ))}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
          )}
        </>
      )}
    </section>
  );
}
