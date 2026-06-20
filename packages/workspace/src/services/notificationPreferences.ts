import { getClient } from './getClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotificationPreferences {
  pushNotifications: boolean;
  activityDigest: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  pushNotifications: true,
  activityDigest: false,
};

// ---------------------------------------------------------------------------
// LocalStorage Helpers
// ---------------------------------------------------------------------------

/**
 * Get the localStorage key for a given user.
 */
function getLocalStorageKey(userId: string): string {
  return `admini_notification_prefs_${userId}`;
}

/**
 * Try to load preferences from localStorage as a fallback.
 */
function loadFromLocalStorage(userId: string): NotificationPreferences {
  try {
    const raw = localStorage.getItem(getLocalStorageKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          pushNotifications:
            typeof parsed.pushNotifications === 'boolean'
              ? parsed.pushNotifications
              : DEFAULT_PREFERENCES.pushNotifications,
          activityDigest:
            typeof parsed.activityDigest === 'boolean'
              ? parsed.activityDigest
              : DEFAULT_PREFERENCES.activityDigest,
        };
      }
    }
  } catch {
    // localStorage unavailable or corrupt data
  }
  return { ...DEFAULT_PREFERENCES };
}

/**
 * Save preferences to localStorage.
 */
function saveToLocalStorage(userId: string, prefs: NotificationPreferences): void {
  try {
    localStorage.setItem(getLocalStorageKey(userId), JSON.stringify(prefs));
  } catch {
    // localStorage unavailable - silently ignore
  }
}

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
 *
 * Falls back to localStorage if Supabase is unavailable.
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

    // If there's an error (e.g., column doesn't exist), fall back to localStorage
    if (error) {
      return loadFromLocalStorage(userId);
    }

    const stored = data?.notification_preferences;

    if (!stored || typeof stored !== 'object') {
      return loadFromLocalStorage(userId);
    }

    return {
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
    // Network or unexpected error - fall back to localStorage
    return loadFromLocalStorage(userId);
  }
}

/**
 * Save notification preferences to the profiles table's
 * `notification_preferences` JSONB column.
 *
 * Merges the provided preferences with existing ones so partial updates
 * don't wipe out other fields. Falls back to localStorage if Supabase fails.
 */
export async function saveNotificationPreferences(
  userId: string,
  prefs: NotificationPreferences,
): Promise<void> {
  const client = getClient();

  // Load existing preferences to merge with
  const existing = await loadNotificationPreferences(userId);
  const merged: NotificationPreferences = {
    pushNotifications: prefs.pushNotifications ?? existing.pushNotifications,
    activityDigest: prefs.activityDigest ?? existing.activityDigest,
  };

  try {
    const { error } = await client
      .from('profiles')
      .update({ notification_preferences: merged })
      .eq('id', userId);

    if (error) {
      // Save to localStorage as fallback and don't throw
      saveToLocalStorage(userId, merged);
      return;
    }
  } catch {
    // Network or unexpected error - save to localStorage as fallback
    saveToLocalStorage(userId, merged);
  }
}

// ---------------------------------------------------------------------------
// Legacy aliases (backward compatibility)
// ---------------------------------------------------------------------------

/** @deprecated Use loadNotificationPreferences instead */
export const getNotificationPreferences = loadNotificationPreferences;
