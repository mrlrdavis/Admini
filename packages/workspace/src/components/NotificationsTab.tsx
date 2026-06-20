import { useEffect, useState } from 'react';
import {
  listNotifications,
  markNotificationRead,
  type TaskNotification,
} from '../services/notificationService';
import { loadNotificationPreferences } from '../services/notificationPreferences';
import { showToast } from './Toast';
import '../styles/notifications-tab.css';

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

  async function openNotification(notification: TaskNotification) {
    if (!notification.read) {
      setNotifications((current) =>
        current.map((item) => item.id === notification.id ? { ...item, read: true } : item),
      );
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
        <ul className="notifications-tab__list">
          {notifications.map((notification) => (
            <li key={notification.id}>
              <button
                type="button"
                className={`notifications-tab__item${notification.read ? '' : ' notifications-tab__item--unread'}`}
                onClick={() => openNotification(notification)}
              >
                <span className="notifications-tab__item-main">
                  <span className="notifications-tab__item-title">{notification.title}</span>
                  <span className="notifications-tab__item-body">{notification.body}</span>
                </span>
                <span className="notifications-tab__item-time">
                  {formatNotificationTime(notification.createdAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
