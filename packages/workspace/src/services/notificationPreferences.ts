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
  emailNotifications: true,
  pushNotifications: true,
  activityDigest: false,
};

// ---------------------------------------------------------------------------
// Service Functions
// ---------------------------------------------------------------------------

/**
 * Load notification preferences from the profiles table's
 * `notification_preferences` JSONB column.
 *
 * Returns defaults if:
 * - The column doesn't exist yet (graceful fallback)
 * - The column value is null/empty
 * - Individual fields are missing or invalid
 */
export async function loadNotificationPreferences(
  userId: string,
): Promise<NotificationPreferences> {
  const client = getClient();

  try {
    const { data, error } = await client
      .from('profiles')
      .select('notification_preferences')
      .eq('id', userId)
      .single();

    // If there's an error (e.g., column doesn't exist), return defaults
    if (error) {
      return { ...DEFAULT_PREFERENCES };
    }

    const stored = data?.notification_preferences;

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
  } catch {
    // Network or unexpected error - return defaults
    return { ...DEFAULT_PREFERENCES };
  }
}

/**
 * Save notification preferences to the profiles table's
 * `notification_preferences` JSONB column.
 *
 * Merges the provided preferences with existing ones so partial updates
 * don't wipe out other fields.
 */
export async function saveNotificationPreferences(
  userId: string,
  prefs: NotificationPreferences,
): Promise<void> {
  const client = getClient();

  // Load existing preferences to merge with
  const existing = await loadNotificationPreferences(userId);
  const merged: NotificationPreferences = {
    emailNotifications: prefs.emailNotifications ?? existing.emailNotifications,
    pushNotifications: prefs.pushNotifications ?? existing.pushNotifications,
    activityDigest: prefs.activityDigest ?? existing.activityDigest,
  };

  const { error } = await client
    .from('profiles')
    .update({ notification_preferences: merged })
    .eq('id', userId);

  if (error) {
    throw new Error(mapSupabaseError(error));
  }
}

// ---------------------------------------------------------------------------
// Legacy aliases (backward compatibility)
// ---------------------------------------------------------------------------

/** @deprecated Use loadNotificationPreferences instead */
export const getNotificationPreferences = loadNotificationPreferences;