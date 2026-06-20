import { getClient } from './getClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationAction = 'created' | 'updated';

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
    if (!data?.id) return;
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
