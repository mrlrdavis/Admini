import { getClient } from './getClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationAction = 'created' | 'updated';
export type NotificationReaction = 'seen' | 'on_it' | 'thanks';

export const NOTIFICATIONS_UPDATED_EVENT = 'admini-notifications-updated';

export interface TaskNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  metadata: {
    task_id?: string;
    action?: NotificationAction;
    flagged?: boolean;
    reaction?: NotificationReaction;
    reacted_at?: string;
    [key: string]: unknown;
  };
  read: boolean;
  createdAt: string;
}

interface NotificationPayload {
  taskId: string;
  assigneeId: string;
  action: NotificationAction;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class NotificationServiceError extends Error {
  public readonly code: string;

  constructor(message: string, code = 'NOTIFICATION_ERROR') {
    super(message);
    this.name = 'NotificationServiceError';
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getApiBase(): string {
  return (
    (typeof import.meta !== 'undefined' &&
      (import.meta as any).env?.VITE_CLOUDFLARE_API_BASE_URL) ||
    ''
  );
}

function notifyNotificationsUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_UPDATED_EVENT));
}

function normalizeMetadata(metadata: TaskNotification['metadata'] | null | undefined): TaskNotification['metadata'] {
  return (metadata ?? {}) as TaskNotification['metadata'];
}

async function updateNotificationMetadata(
  notificationId: string,
  metadata: TaskNotification['metadata'],
): Promise<TaskNotification['metadata']> {
  const client = getClient();
  const { data, error } = await client
    .from('notifications')
    .update({ metadata })
    .eq('id', notificationId)
    .select('metadata')
    .single<{ metadata: TaskNotification['metadata'] }>();

  if (error) {
    throw new NotificationServiceError(
      `Failed to update notification: ${error.message}`,
      'UPDATE_METADATA_FAILED',
    );
  }

  notifyNotificationsUpdated();
  return normalizeMetadata(data?.metadata);
}

async function recordNotificationReactionActivity(
  notification: TaskNotification,
  reaction: NotificationReaction,
): Promise<void> {
  const taskId = typeof notification.metadata.task_id === 'string' ? notification.metadata.task_id : null;
  if (!taskId) return;

  const client = getClient();
  const { data: userData } = await client.auth.getUser();
  const actorId = userData.user?.id;
  if (!actorId) return;

  const { data: task, error: taskError } = await client
    .from('tasks')
    .select('organization_id')
    .eq('id', taskId)
    .maybeSingle<{ organization_id: string }>();

  if (taskError || !task?.organization_id) return;

  await client.from('sync_events').insert({
    organization_id: task.organization_id,
    actor_id: actorId,
    entity_type: 'task',
    entity_id: taskId,
    action: 'react',
  });

  void reaction;
}

// ---------------------------------------------------------------------------
// Service Functions
// ---------------------------------------------------------------------------

/**
 * Notify an assignee about a task action (created or updated).
 *
 * Sends the notification via Cloudflare Worker endpoint.
 * Falls back to Supabase edge function if the Worker endpoint is unavailable.
 *
 * This is a best-effort operation. If the notification fails, the error is
 * thrown but should not block the primary task action from completing.
 */
export async function notifyAssignee(
  taskId: string,
  assigneeId: string,
  action: NotificationAction,
  taskTitle?: string,
): Promise<void> {
  if (!taskId || !assigneeId) {
    throw new NotificationServiceError(
      'Task ID and assignee ID are required for notification.',
      'MISSING_PARAMS',
    );
  }

  let recipientId = assigneeId;

  // Task assignees are entered as free text in the UI. If the value looks like
  // an email or display name, resolve it to a profile id before inserting.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assigneeId)) {
    const client = getClient();
    const normalized = assigneeId.trim().toLowerCase();
    const emailMatch = await client
      .from('profiles')
      .select('id')
      .eq('email', normalized)
      .limit(1)
      .maybeSingle<{ id: string }>();
    const data = emailMatch.data ?? (await client
      .from('profiles')
      .select('id')
      .ilike('display_name', assigneeId.trim())
      .limit(1)
      .maybeSingle<{ id: string }>()).data;
    if (!data?.id) {
      throw new NotificationServiceError(
        `Could not find an org profile for assignee "${assigneeId}".`,
        'ASSIGNEE_NOT_FOUND',
      );
    }
    recipientId = data.id;
  }

  const payload: NotificationPayload = {
    taskId,
    assigneeId: recipientId,
    action,
    timestamp: new Date().toISOString(),
  };

  const payloadWithTitle = { ...payload, taskTitle };

  const apiBase = getApiBase();

  // Try Cloudflare Worker endpoint first
  if (apiBase) {
    try {
      const response = await fetch(`${apiBase}/api/notifications/task-assigned`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadWithTitle),
      });

      if (response.ok) {
        return; // notification sent successfully
      }

      // If Worker returns a non-OK response, fall through to Supabase fallback
    } catch {
      // Network error reaching Worker - fall through to Supabase fallback
    }
  }

  // Fallback: persist notification via Supabase (edge function or direct insert)
  try {
    const client = getClient();
    const { error } = await client.from('notifications').insert({
      recipient_id: recipientId,
      type: 'task_assignment',
      title: action === 'created' ? 'New task assigned' : 'Task updated',
      body: taskTitle
        ? `"${taskTitle}" has been ${action} and assigned to you.`
        : `A task has been ${action} and assigned to you.`,
      metadata: { task_id: taskId, action },
      read: false,
      created_at: payload.timestamp,
    });

    if (error) {
      throw new NotificationServiceError(
        `Failed to persist notification: ${error.message}`,
        'PERSIST_FAILED',
      );
    }

    notifyNotificationsUpdated();
  } catch (err) {
    if (err instanceof NotificationServiceError) throw err;
    throw new NotificationServiceError(
      err instanceof Error
        ? `Notification delivery failed: ${err.message}`
        : 'Failed to send notification.',
      'DELIVERY_FAILED',
    );
  }
}

export async function listNotifications(limit = 25): Promise<TaskNotification[]> {
  const client = getClient();
  const { data, error } = await client
    .from('notifications')
    .select('id, type, title, body, metadata, read, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new NotificationServiceError(
      `Failed to load notifications: ${error.message}`,
      'LIST_FAILED',
    );
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    metadata: normalizeMetadata(row.metadata),
    read: row.read,
    createdAt: row.created_at,
  }));
}

export async function getUnreadNotificationCount(): Promise<number> {
  const client = getClient();
  const { count, error } = await client
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('read', false);

  if (error) {
    throw new NotificationServiceError(
      `Failed to load unread notification count: ${error.message}`,
      'COUNT_FAILED',
    );
  }

  return count ?? 0;
}

export async function setNotificationRead(notificationId: string, read: boolean): Promise<void> {
  const client = getClient();
  const { error } = await client
    .from('notifications')
    .update({ read })
    .eq('id', notificationId);

  if (error) {
    throw new NotificationServiceError(
      `Failed to mark notification ${read ? 'read' : 'unread'}: ${error.message}`,
      read ? 'MARK_READ_FAILED' : 'MARK_UNREAD_FAILED',
    );
  }

  notifyNotificationsUpdated();
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await setNotificationRead(notificationId, true);
}

export async function markNotificationUnread(notificationId: string): Promise<void> {
  await setNotificationRead(notificationId, false);
}

export async function setNotificationFlag(
  notification: TaskNotification,
  flagged: boolean,
): Promise<TaskNotification['metadata']> {
  return updateNotificationMetadata(notification.id, {
    ...normalizeMetadata(notification.metadata),
    flagged,
  });
}

export async function setNotificationReaction(
  notification: TaskNotification,
  reaction: NotificationReaction | null,
): Promise<TaskNotification['metadata']> {
  const currentMetadata = normalizeMetadata(notification.metadata);
  const metadata: TaskNotification['metadata'] = { ...currentMetadata };

  if (reaction) {
    metadata.reaction = reaction;
    metadata.reacted_at = new Date().toISOString();
  } else {
    delete metadata.reaction;
    delete metadata.reacted_at;
  }

  const updatedMetadata = await updateNotificationMetadata(notification.id, metadata);

  if (reaction) {
    recordNotificationReactionActivity({ ...notification, metadata: updatedMetadata }, reaction).catch(() => undefined);
  }

  return updatedMetadata;
}
