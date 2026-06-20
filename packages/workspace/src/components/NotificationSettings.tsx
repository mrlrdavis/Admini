// ---------------------------------------------------------------------------
// NotificationSettings - Toggle switches for notification preferences.
// Renders in-app notifications and activity digest toggles.
// ---------------------------------------------------------------------------

export interface NotificationSettingsProps {
  /** Whether in-app notifications are enabled */
  pushNotifications?: boolean;
  /** Whether the weekly activity digest is enabled */
  activityDigest?: boolean;
  /** Called when a toggle changes. Receives the preference key and new value. */
  onChange: (key: string, value: boolean) => void;
  /** When true, disables all toggles during a save operation. */
  saving?: boolean;
  /** Error message to display. */
  error?: string | null;
  /** Called when the user clicks the Retry button after a save failure. */
  onRetry?: () => void;
}

export function NotificationSettings({
  pushNotifications = false,
  activityDigest = false,
  onChange,
  saving,
  error,
  onRetry,
}: NotificationSettingsProps) {
  return (
    <div className="notification-settings" role="region" aria-label="Notification settings">
      {error && (
        <div className="notification-settings__error-container" role="alert">
          <p className="notification-settings__error">
            {error}
          </p>
          {onRetry && (
            <button
              type="button"
              className="notification-settings__retry-btn"
              onClick={onRetry}
              disabled={saving}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* In-app Notifications */}
      <div className="notification-settings__row">
        <label
          className="notification-settings__label"
          htmlFor="toggle-push-notifications"
        >
          <span className="notification-settings__title">In-app Notifications</span>
          <span className="notification-settings__description">
            Show task assignment notifications in the Notifications menu
          </span>
        </label>
        <button
          id="toggle-push-notifications"
          type="button"
          role="switch"
          aria-checked={pushNotifications}
          className={`notification-settings__toggle${pushNotifications ? ' notification-settings__toggle--active' : ''}`}
          onClick={() => onChange('pushNotifications', !pushNotifications)}
          disabled={saving}
        >
          <span className="notification-settings__toggle-thumb" />
        </button>
      </div>

      {/* Activity Digest */}
      <div className="notification-settings__row">
        <label
          className="notification-settings__label"
          htmlFor="toggle-activity-digest"
        >
          <span className="notification-settings__title">Activity Digest</span>
          <span className="notification-settings__description">
            Weekly summary of workspace activity
          </span>
        </label>
        <button
          id="toggle-activity-digest"
          type="button"
          role="switch"
          aria-checked={activityDigest}
          className={`notification-settings__toggle${activityDigest ? ' notification-settings__toggle--active' : ''}`}
          onClick={() => onChange('activityDigest', !activityDigest)}
          disabled={saving}
        >
          <span className="notification-settings__toggle-thumb" />
        </button>
      </div>
    </div>
  );
}
