import { getClient } from './getClient';
import { mapSupabaseError } from '@admini/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotificationPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  activityDigest: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  emailNotifications: false,
  pushNotifications: false,
  activityDigest: false,
};

// ---------------------------------------------------------------------------
// Service Functions
// ---------------------------------------------------------------------------

/**
 * Retrieve the current user's notification preferences from auth user_metadata.
 * Returns defaults (all false) if no preferences have been saved yet.
 */
export async function getNotificationPreferences(
  userId: string,
): Promise<NotificationPreferences> {
  const client = getClient();
  const { data, error } = await client.auth.getUser();

  if (error || !data.user) {
    throw new Error(mapSupabaseError(error ?? { message: 'Not authenticated' }));
  }

  const stored = data.user.user_metadata?.notification_preferences;

  if (!stored || typeof stored !== 'object') {
    return { ...DEFAULT_PREFERENCES };
  }

  return {
    emailNotifications:
      typeof stored.emailNotifications === 'boolean'
        ? stored.emailNotifications
        : DEFAULT_PREFERENCES.emailNotifications,
    pushNotifications:
      typeof stored.pushNotifications === 'boolean'
        ? stored.pushNotifications
        : DEFAULT_PREFERENCES.pushNotifications,
    activityDigest:
      typeof stored.activityDigest === 'boolean'
        ? stored.activityDigest
        : DEFAULT_PREFERENCES.activityDigest,
  };
}

/**
 * Save (merge) notification preferences into the user's auth metadata.
 * Only the provided fields are updated; existing fields are preserved.
 */
export async function saveNotificationPreferences(
  userId: string,
  prefs: Partial<NotificationPreferences>,
): Promise<void> {
  const client = getClient();

  // Read existing preferences first so we merge rather than overwrite
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) {
    throw new Error(mapSupabaseError(userError ?? { message: 'Not authenticated' }));
  }

  const existing = userData.user.user_metadata?.notification_preferences ?? {};
  const merged: NotificationPreferences = {
    emailNotifications:
      prefs.emailNotifications ?? existing.emailNotifications ?? DEFAULT_PREFERENCES.emailNotifications,
    pushNotifications:
      prefs.pushNotifications ?? existing.pushNotifications ?? DEFAULT_PREFERENCES.pushNotifications,
    activityDigest:
      prefs.activityDigest ?? existing.activityDigest ?? DEFAULT_PREFERENCES.activityDigest,
  };

  const { error } = await client.auth.updateUser({
    data: { notification_preferences: merged },
  });

  if (error) {
    throw new Error(mapSupabaseError(error));
  }
}
